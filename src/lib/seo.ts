import { SITE } from '../config/site';

interface ImageLike {
  src: string;
}

export interface SeoInput {
  siteUrl: string | URL;
  pathname: string;
  title: string;
  description: string;
  pageType?: 'website' | 'article';
  canonical?: string | URL;
  ogImage?: string | ImageLike;
  heroImage?: string | ImageLike;
  publishedAt?: string;
  updatedAt?: string;
}

function imageSource(image: SeoInput['ogImage']): string | undefined {
  return typeof image === 'string' ? image : image?.src;
}

function absoluteUrl(value: string | URL, siteUrl: string | URL): string {
  const url = new URL(value.toString(), siteUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('SEO URLs must use HTTP or HTTPS.');
  }
  return url.toString();
}

export function buildSeo(input: SeoInput) {
  const canonical = input.canonical ? absoluteUrl(input.canonical, input.siteUrl) : absoluteUrl(input.pathname, input.siteUrl);
  const selectedImage = imageSource(input.ogImage) ?? imageSource(input.heroImage) ?? '/og-default.png';

  return {
    canonical,
    image: absoluteUrl(selectedImage, input.siteUrl),
    title: input.title === SITE.name ? SITE.name : `${input.title} | ${SITE.name}`,
    description: input.description,
    ogType: input.pageType === 'article' ? 'article' : 'website',
  } as const;
}

export function buildJsonLd(input: SeoInput): Record<string, unknown> {
  const seo = buildSeo(input);
  const author = {
    '@type': 'Person',
    name: SITE.author,
  };

  if (input.pageType === 'article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: input.title,
      description: input.description,
      url: seo.canonical,
      image: seo.image,
      ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
      ...(input.updatedAt ? { dateModified: input.updatedAt } : {}),
      author,
      publisher: author,
      isPartOf: {
        '@type': 'Blog',
        name: SITE.name,
        url: absoluteUrl('/', input.siteUrl),
      },
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: SITE.name,
    headline: input.title,
    description: input.description,
    url: seo.canonical,
    author,
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
