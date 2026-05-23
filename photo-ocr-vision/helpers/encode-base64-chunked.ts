// telegram-photo-ocr-vision — encode-base64-chunked.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (bytesToBase64)
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// LEZIONE GLOBALE #11 (~/.claude/CLAUDE.md):
//   Encoding base64 chunked a 8192 byte.
//   NO `btoa(String.fromCharCode(...bytes))` su buffer grossi → stack overflow
//   su Deno per immagini > 50KB (V8 spread operator argument limit).
//
// Pattern donor GMR (chunked 0x8000 = 32KB):
//   for (let i = 0; i < bytes.length; i += CHUNK) {
//     str += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
//   }
//   return btoa(str);

/**
 * Encode Uint8Array → base64 stringa (no data URI prefix) in modo chunked.
 *
 * @param bytes I bytes da encodare.
 * @param chunkSize Dimensione chunk (default 8192 byte = lezione globale #11).
 *                  Donor GMR usa 0x8000 (32768) ma 8192 e' piu' conservativo
 *                  e funziona su tutte le runtime (Deno, Node, Bun, browser).
 * @returns Stringa base64 (NO prefix "data:image/...,base64,").
 */
export function encodeBase64Chunked(
  bytes: Uint8Array,
  chunkSize: number = 8192,
): string {
  if (!bytes || bytes.length === 0) return "";

  // Implementazione chunked per evitare stack overflow su buffer grossi.
  // Sicurezza extra: minimo 1024, massimo 32768 per chunkSize.
  const chunk = Math.max(1024, Math.min(32768, chunkSize | 0));

  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    // String.fromCharCode con spread su slice piccola e' safe (≤ 8192 args)
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * Helper: calcola la dimensione approssimativa di un base64 encoding.
 * base64 e' ~4/3 della size raw (33% overhead). Utile per stimare il payload
 * verso Claude API prima dell'encoding (cost & limit pre-flight check).
 */
export function estimateBase64Size(bytesLength: number): number {
  return Math.ceil(bytesLength / 3) * 4;
}

/**
 * Helper: bytes → KB arrotondato per audit / size check.
 */
export function bytesToKb(bytes: Uint8Array | number): number {
  const n = typeof bytes === "number" ? bytes : bytes.byteLength;
  return Math.round(n / 1024);
}
