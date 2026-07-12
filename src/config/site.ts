export const CATEGORY_KEYS = ['Cloud', 'Backend', 'Frontend', 'Infrastructure', 'AI', 'Operations'] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES = {
  Cloud: { label: 'クラウド / AWS', slug: 'cloud' },
  Backend: { label: 'バックエンド', slug: 'backend' },
  Frontend: { label: 'フロントエンド', slug: 'frontend' },
  Infrastructure: { label: 'インフラ / IaC', slug: 'infrastructure' },
  AI: { label: 'AI', slug: 'ai' },
  Operations: { label: '運用 / 障害調査', slug: 'operations' },
} as const;

export const SITE = {
  name: 'テックログ',
  author: 'Hiroshi Imaizumi',
  tagline: 'つくる、動かす、改善する。',
  description: 'クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。',
  email: 'hiroshiimaizumi0611@gmail.com',
  github: 'https://github.com/hiroshiimaizumi0611',
  x: '',
  zenn: '',
} as const;
