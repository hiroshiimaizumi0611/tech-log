export const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

type CloudflareWebAnalyticsOptions = {
  currentHostname: string;
  allowedHostname: string;
  token?: string;
  documentRef?: Document;
};

export function loadCloudflareWebAnalytics({
  currentHostname,
  allowedHostname,
  token,
  documentRef = document,
}: CloudflareWebAnalyticsOptions): boolean {
  const trimmedToken = token?.trim();
  if (!trimmedToken || currentHostname !== allowedHostname) return false;
  if (documentRef.querySelector(`script[src="${CLOUDFLARE_BEACON_SRC}"]`)) return false;

  const script = documentRef.createElement('script');
  script.defer = true;
  script.src = CLOUDFLARE_BEACON_SRC;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: trimmedToken }));
  documentRef.body.appendChild(script);
  return true;
}
