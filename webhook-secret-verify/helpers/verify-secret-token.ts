// Donor: pattern lezione globale GOAi #12 + best practice OWASP A07
//        (gomyreference webhook usa pattern equivalente inline)
// Brick: telegram-webhook-secret-verify v0.1.0 (le-GO F-Integrations)
//
// Verifica del header `X-Telegram-Bot-Api-Secret-Token` con constant-time compare.
//
// Lezione globale GOAi #12: Telegram NON manda Bearer JWT — solo
// `X-Telegram-Bot-Api-Secret-Token`. Le edge function webhook DEVONO essere
// deployate con `--no-verify-jwt` e fare il check manuale del secret.

/**
 * Header HTTP standard per il secret token Telegram.
 * Lowercased perché `Headers.get()` normalizza in lowercase.
 */
export const TG_SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * Constant-time string equality.
 *
 * Implementazione XOR-aggregate: tutti i byte sono comparati,
 * il risultato è disponibile solo a fine loop. Previene timing side-channel.
 *
 * IMPORTANTE:
 *  - se le lunghezze differiscono, ritorna `false` MA dopo aver iterato comunque
 *    sulla lunghezza massima → tempo costante anche su mismatch di lunghezza.
 *  - se uno dei due è vuoto, ritorna `false` (fail-closed).
 *
 * @example
 *   constantTimeEqual("abc", "abc")   // → true
 *   constantTimeEqual("abc", "abd")   // → false (tempo identico a sopra)
 *   constantTimeEqual("", "anything") // → false (fail-closed)
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    // Reading past length: charCodeAt → NaN → coerced to 0 via |0
    const ca = (a.charCodeAt(i) | 0);
    const cb = (b.charCodeAt(i) | 0);
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/**
 * Verifica il secret token Telegram di una request webhook.
 *
 * Fail-closed: se `expectedSecret` è vuoto, ritorna `false` (mai accettare
 * webhook quando il secret non è configurato). Stesso comportamento se il
 * header è assente.
 *
 * @param request - Request del Deno.serve handler (o Edge Function handler).
 * @param expectedSecret - Valore atteso (es. `Deno.env.get("TELEGRAM_WEBHOOK_SECRET_GOREF")`).
 * @returns `true` solo se header presente e match constant-time.
 *
 * @example
 *   Deno.serve(async (req) => {
 *     if (!verifySecretToken(req, Deno.env.get("TELEGRAM_WEBHOOK_SECRET_GOREF") ?? "")) {
 *       return new Response("Forbidden", { status: 403 });
 *     }
 *     // ... proceed with handler
 *   });
 */
export function verifySecretToken(request: Request, expectedSecret: string): boolean {
  if (!expectedSecret) {
    // Fail-closed: secret non configurato → mai accettare webhook.
    console.error({ fn: "verifySecretToken", reason: "empty_expected_secret" });
    return false;
  }
  const headerValue = request.headers.get(TG_SECRET_HEADER);
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expectedSecret);
}
