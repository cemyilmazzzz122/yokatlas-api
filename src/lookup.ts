import { YokAtlasLookupError } from "./errors";

const TR_MAP: Record<string, string> = {
  "İ": "I",
  "ı": "i",
  "Ğ": "G",
  "ğ": "g",
  "Ş": "S",
  "ş": "s",
  "Ç": "C",
  "ç": "c",
  "Ö": "O",
  "ö": "o",
  "Ü": "U",
  "ü": "u",
};

/** Türkçe karakterleri ASCII'ye çevirip küçük harfe indiren, fuzzy eşleşme için kullanılan normalizasyon. */
export function normalizeTurkish(text: string): string {
  const ascii = text.replace(/[İıĞğŞşÇçÖöÜü]/g, (ch) => TR_MAP[ch] ?? ch);
  return ascii.toLowerCase().trim().replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** İki normalize edilmiş string arasındaki benzerlik oranı (0 = alakasız, 1 = birebir aynı). */
export function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Verilen serbest metin sorgusunu, `items` listesindeki en yakın öğeye çözer.
 *
 * Sırasıyla dener: (1) normalize edilmiş tam eşleşme, (2) alt dize (substring)
 * eşleşmesi, (3) Levenshtein tabanlı fuzzy eşleşme (`cutoff` altındaysa reddedilir).
 * Hiçbiri tutmazsa en yakın 3 aday önerisiyle {@link YokAtlasLookupError} fırlatır.
 */
export function resolveByName<T>(
  query: string,
  items: readonly T[],
  nameOf: (item: T) => string,
  kind: "üniversite" | "program" | "il",
  cutoff = 0.6,
): T {
  if (!query || !query.trim()) {
    throw new YokAtlasLookupError(query, { kind });
  }
  const key = normalizeTurkish(query);

  for (const item of items) {
    if (normalizeTurkish(nameOf(item)) === key) return item;
  }

  for (const item of items) {
    const norm = normalizeTurkish(nameOf(item));
    if (norm.includes(key) || key.includes(norm)) return item;
  }

  let best: T | null = null;
  let bestScore = -1;
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const score = similarityRatio(key, normalizeTurkish(nameOf(item)));
    scored.push({ item, score });
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best && bestScore >= cutoff) return best;

  const suggestions = scored
    .sort((x, y) => y.score - x.score)
    .filter((s) => s.score >= 0.4)
    .slice(0, 3)
    .map((s) => nameOf(s.item));
  throw new YokAtlasLookupError(query, { kind, suggestions });
}
