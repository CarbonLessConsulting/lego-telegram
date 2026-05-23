// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (righe 10-20)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// Escape selettivo per Telegram parse_mode HTML.
//
// IMPORTANTE: il consumer NON deve escapare i tag HTML emessi dal proprio codice
// (es. `<b>`, `<i>`, `<code>`, `<a href>`). escapeHtml() è destinato SOLO a
// contenuti dinamici "ostili" (nomi utente, payload Telegram, output raw LLM,
// stringhe da DB con utf-8 untrusted).

/**
 * Escape 5 caratteri HTML-sensitive per Telegram parse_mode=HTML.
 *
 * Ordine `&` PRIMO obbligatorio: altrimenti `&lt;` viene re-escapato in `&amp;lt;`.
 * `"` e `'` inclusi per quando il testo finisce dentro un attributo (es.
 * `callback_data` rendered all'interno di `<code>`, o `href="..."` con apostrofi).
 *
 * @example
 *   escapeHtml('<script>alert("x")</script>')
 *   // → '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
