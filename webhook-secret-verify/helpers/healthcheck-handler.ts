// Donor: pattern healthcheck canonical agency (GoMyReference + GoNetworker + GoMec)
// Brick: telegram-webhook-secret-verify v0.1.0 (le-GO F-Integrations)
//
// Healthcheck handler per webhook edge function.
//
// Pattern: GET (qualsiasi path) → 200 "ok" senza richiedere secret token.
// Telegram non fa mai GET ai webhook → ogni GET arriva da uptime monitor /
// curl di debug → safe da rispondere 200 senza authentication.

export interface HealthcheckOptions {
  /** Body custom da ritornare (default: "ok"). */
  body?: string;
  /** Status custom (default: 200). */
  status?: number;
  /** Header extra. */
  headers?: Record<string, string>;
}

/**
 * Determina se la request è un healthcheck (GET, HEAD, OPTIONS senza body Telegram).
 */
export function isHealthcheckRequest(request: Request): boolean {
  const m = request.method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

/**
 * Risposta canonical healthcheck.
 *
 * @example
 *   Deno.serve((req) => {
 *     if (isHealthcheckRequest(req)) return healthcheckResponse();
 *     // ... handler webhook reale
 *   });
 */
export function healthcheckResponse(opts: HealthcheckOptions = {}): Response {
  return new Response(opts.body ?? "ok", {
    status: opts.status ?? 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...opts.headers,
    },
  });
}
