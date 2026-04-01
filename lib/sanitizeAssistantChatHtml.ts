/**
 * Turn assistant/AI chat text into safe HTML: escape everything except validated <a href> and <br>.
 */
export function sanitizeAssistantChatHtml(raw: string): string {
  if (!raw) return '';

  const escapeHtml = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

  const allowHref = (h: string) => /^(https?:\/\/|mailto:|tel:)/i.test(h.trim());

  const formatPlainChunk = (s: string) =>
    s.split(/<br\s*\/?>/gi).map((chunk) => escapeHtml(chunk)).join('<br />');

  const parts: string[] = [];
  let last = 0;
  const re = /<a\s+[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    parts.push(formatPlainChunk(raw.slice(last, m.index)));
    const href = (m[2] ?? m[3] ?? '').trim();
    const inner = m[4] ?? '';
    if (allowHref(href)) {
      const safeHref = escapeHtml(href);
      const label = escapeHtml(stripTags(inner)).replace(/\s+/g, ' ').trim() || href;
      parts.push(
        `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
    } else {
      parts.push(escapeHtml(m[0]));
    }
    last = re.lastIndex;
  }
  parts.push(formatPlainChunk(raw.slice(last)));
  return parts.join('');
}
