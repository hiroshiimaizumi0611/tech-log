---
title: 2026年版 Astroで技術ブログを構築した
description: Astroの静的生成、Content Collections、Tailwind CSS v4、Pagefind、Cloudflare Workersを組み合わせる設計と実装上の要点を整理します。
publishedAt: '2026-07-11'
updatedAt: '2026-07-11'
category: Frontend
tags:
  - Astro
  - TypeScript
  - Tailwind CSS
  - Cloudflare
featured: true
featuredCode:
  language: typescript
  filename: src/pages/blog/[id].astro
  code: |-
    import type { GetStaticPaths } from 'astro';
    import { getCollection } from 'astro:content';

    export const getStaticPaths = (async () => {
      const posts = await getCollection('blog');
      return posts.map((post) => ({
        params: { id: post.id },
        props: { post },
      }));
    }) satisfies GetStaticPaths;
---

このブログプロジェクトでは、MarkdownをGitで管理し、ビルド時にHTMLと検索インデックスを作り、生成物を静的アセットとして配信する構成を採用しました。この記事は、その構成を各ツールの公式仕様に照らして説明する実装ガイドです。性能値や本番運用の実績を示すものではありません。

> 先に「記事を静的HTMLへ変換する工程」と「生成済みHTMLを配信する工程」を分けると、構成を判断しやすくなります。

## 採用構成

このプロジェクトで採用した役割分担は次のとおりです。

- Astro: Markdownからページを静的生成する
- Content Collections: frontmatterを検証し、記事データへ型を付ける
- Tailwind CSS v4: Viteプラグイン経由で必要なCSSを生成する
- Pagefind: 完成したHTMLを読み、ブラウザで使う静的検索インデックスを作る
- Cloudflare Workers Static Assets: `dist` のHTML、CSS、画像、検索データを配信する

この分離により、実行時のデータベースや検索サーバーを前提にせず、記事追加時はMarkdownとビルドの検証に集中できます。一方、ログイン状態に応じた表示やリクエスト時に変わる内容が必要なら、静的生成だけで要件を満たせるかを別途検討します。

## Astro静的生成

Astroは既定でページをビルド時にプリレンダリングします。公式の[オンデマンドレンダリングガイド](https://docs.astro.build/en/guides/on-demand-rendering/)でも、サイト全体は既定で静的HTMLとして生成され、必要なルートだけをオンデマンド描画へ切り替えられると説明されています。記事詳細のような動的ルートは、静的モードでは `getStaticPaths()` が返したパスごとにHTMLになります。

```astro
---
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

ビルド時に記事一覧とルートが確定するので、Content Collectionsのschema違反、`getStaticPaths()` のルート生成エラー、記事の描画・buildエラーを公開前に検出できます。外部リンクの到達性はAstro buildの検査対象ではないため、必要なら別工程で検査します。更新を反映するには再ビルドが必要ですが、記事中心のサイトではその境界が明確です。ルーティングの詳細はAstro公式の[ルーティングガイド](https://docs.astro.build/en/guides/routing/)も確認してください。

## Content Collections

ファイルが読めることと、記事として正しいことは別問題です。Content Collectionsでは、loaderで記事を集め、schemaでタイトル、日付、カテゴリ、タグなどを検証できます。Astro公式の[Content Collectionsガイド](https://docs.astro.build/en/guides/content-collections/)と[`glob()` loaderリファレンス](https://docs.astro.build/en/reference/content-loader-reference/#glob-loader)に沿う最小構成は次の形です。

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string().min(1),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string()),
  }),
});

export const collections = { blog };
```

schemaを一か所に置けば、frontmatterのキー漏れや不正な値をビルド時に止められます。日付形式、タグの重複、下書きの扱いなど、サイト固有の規約もここへ寄せると、各ページで同じ防御処理を繰り返さずに済みます。

Tailwind CSS v4はAstroが利用するViteへプラグインとして組み込めます。公式の[Vite導入手順](https://tailwindcss.com/docs/installation/using-vite)どおり `tailwindcss` と `@tailwindcss/vite` を導入し、Astro設定の `vite.plugins` に `tailwindcss()` を追加します。CSS側では `@import "tailwindcss";` を読み込みます。古い統合方法の記事をそのまま転用せず、利用中のメジャーバージョンに対応する公式手順を基準にします。

## Pagefind

PagefindはMarkdownそのものではなく、静的サイトジェネレーターが出力したHTMLを索引化します。公式の[Getting Started](https://pagefind.app/docs/)では、サイトのビルド後、デプロイ前に毎回Pagefindを実行する流れが示されています。Astroの既定出力先が `dist` なら、スクリプトは次のように直列化できます。

```json
{
  "scripts": {
    "build:astro": "astro build",
    "build:search": "pagefind --site dist",
    "build": "npm run build:astro && npm run build:search"
  }
}
```

`--site` は静的HTMLがあるディレクトリを指します。実行後は `dist/pagefind` にブラウザ用の検索バンドルとインデックスが加わります。詳しいCLIの動作は[Running Pagefind](https://pagefind.app/docs/running-pagefind/)で確認できます。開発サーバーだけではインデックスが生成されないため、検索確認には本番同等のbuildを通すことが重要です。

検索対象を本文に絞りたい場合は、レイアウトの本文要素へ `data-pagefind-body` を付けます。全ページ共通のナビゲーションやフッターが検索語として混ざるのを避けるためです。公式の[インデックス対象設定](https://pagefind.app/docs/indexing/)を参照し、除外範囲もHTML属性で明示します。

## Workers

Cloudflare WorkersはWorkerコードだけでなく、静的アセットのディレクトリもデプロイできます。完全にプリレンダリングされたAstroサイトなら、Cloudflare公式の[Astroデプロイガイド](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)は、Astro用アダプターを必須とせず、`dist` を静的アセットとしてアップロードする構成を示しています。

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "tech-blog",
  "compatibility_date": "2026-07-11",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

`assets.directory` がデプロイ対象です。公式の[Static Assetsドキュメント](https://developers.cloudflare.com/workers/static-assets/)によれば、一致する静的アセットは既定でWorkerコードを起動せずに配信されます。APIやリクエスト時レンダリングが不要なら、`main` を持たない静的配信にすると責務が明快です。カスタム404を生成する場合は、`not_found_handling` と出力される `404.html` の対応も検証します。

## 得られた知見

この構成を設計するときに残しておきたい判断基準は次のとおりです。

- コンテンツの正しさはContent Collectionsのschemaで早期に検証する
- 動的ルートは `getStaticPaths()` で列挙し、build結果に記事HTMLがあることを確認する
- Tailwindは利用中のv4に合うViteプラグイン方式を選ぶ
- Pagefindは必ずAstro buildの後、デプロイの前に実行する
- WorkersにはPagefindの成果物を含む `dist` 全体を渡す
- build、型検査、テスト、検索インデックス生成をCIで同じ順序に固定する

静的構成でも、生成工程の順序がずれると検索だけが古い、あるいは記事だけが欠ける状態になり得ます。ツールを増やすことより、各成果物の入力と出力を明示し、最終的な `dist` を一つの配布単位として検証することが重要です。
