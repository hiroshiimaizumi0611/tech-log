const CHARACTERS_PER_MINUTE = 500;

export function readingMinutes(content: string): number {
  const characterCount = content.replace(/\s/gu, '').length;
  return Math.max(1, Math.ceil(characterCount / CHARACTERS_PER_MINUTE));
}
