import { describe, expect, it } from 'vitest';

import { CLOUDFLARE_BEACON_SRC, loadCloudflareWebAnalytics } from '../../src/scripts/cloudflare-analytics';

type FakeScript = {
  defer: boolean;
  src: string;
  attributes: Map<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
};

function createFakeDocument() {
  const scripts: FakeScript[] = [];
  const documentRef = {
    createElement(tagName: string) {
      if (tagName !== 'script') throw new Error(`Unexpected element: ${tagName}`);
      const attributes = new Map<string, string>();
      return {
        defer: false,
        src: '',
        attributes,
        setAttribute(name: string, value: string) {
          attributes.set(name, value);
        },
        getAttribute(name: string) {
          return attributes.get(name) ?? null;
        },
      } satisfies FakeScript;
    },
    querySelector(selector: string) {
      if (selector !== `script[src="${CLOUDFLARE_BEACON_SRC}"]`) return null;
      return scripts.find(({ src }) => src === CLOUDFLARE_BEACON_SRC) ?? null;
    },
    body: {
      appendChild(script: FakeScript) {
        scripts.push(script);
        return script;
      },
    },
  };

  return { documentRef: documentRef as unknown as Document, scripts };
}

const matchingOptions = {
  currentHostname: 'techlog.example',
  allowedHostname: 'techlog.example',
  token: 'public-token',
};

describe('loadCloudflareWebAnalytics', () => {
  it('adds one deferred Cloudflare beacon when the hostname matches', () => {
    const { documentRef, scripts } = createFakeDocument();

    expect(loadCloudflareWebAnalytics({ ...matchingOptions, documentRef })).toBe(true);

    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      defer: true,
    });
    expect(JSON.parse(scripts[0]!.getAttribute('data-cf-beacon')!)).toEqual({ token: 'public-token' });
  });

  it.each(['localhost', '127.0.0.1', 'preview.example.workers.dev'])(
    'does not add a beacon for non-matching hostname %s',
    (currentHostname) => {
      const { documentRef, scripts } = createFakeDocument();

      expect(loadCloudflareWebAnalytics({ ...matchingOptions, currentHostname, documentRef })).toBe(false);
      expect(scripts).toHaveLength(0);
    },
  );

  it('does not add a beacon when the token is whitespace-only', () => {
    const { documentRef, scripts } = createFakeDocument();

    expect(loadCloudflareWebAnalytics({ ...matchingOptions, token: '   ', documentRef })).toBe(false);
    expect(scripts).toHaveLength(0);
  });

  it('does not add a duplicate beacon', () => {
    const { documentRef, scripts } = createFakeDocument();

    expect(loadCloudflareWebAnalytics({ ...matchingOptions, documentRef })).toBe(true);
    expect(loadCloudflareWebAnalytics({ ...matchingOptions, documentRef })).toBe(false);
    expect(scripts).toHaveLength(1);
  });
});
