// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/embedding.ts
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

import type { ContactCanonical } from '../types';

const OPENAI_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small'; // 1536 dims, $0.02 / 1M tok

/**
 * Costruisce il testo canonical da embeddare per un contatto.
 *
 * Concatena i campi che identificano semanticamente il contatto:
 * `name + role + company + emails + phones + notes`.
 *
 * Email/phone aiutano il match contro contatti con OCR rumoroso ("Mario Rossi
 * mario.rossi@gmail.com" embedding ≈ "Mario Rossi · mario rossi at gmail").
 */
export function buildContactEmbedText(c: Partial<ContactCanonical>): string {
  const parts: string[] = [];
  if (c.full_name) parts.push(c.full_name);
  if (c.role) parts.push(c.role);
  if (c.company) parts.push(c.company);
  if (c.emails?.length) parts.push(c.emails.join(' '));
  if (c.phones?.length) parts.push(c.phones.join(' '));
  if (c.notes) parts.push(c.notes);
  return parts.filter(Boolean).join(' · ');
}

/**
 * Embed un testo con OpenAI text-embedding-3-small (1536 dim).
 *
 * Richiede env `OPENAI_API_KEY`. Lancia eccezione su 4xx (config error); ritorna
 * `null` su 5xx transient o fetch fail (soft fail — caller decide come degradare).
 *
 * `apiKey` opzionale: se passato, override env. Utile per multi-tenant con API
 * key per tenant.
 */
export async function embedContact(
  text: string,
  opts: { apiKey?: string; retryMs?: number[] } = {},
): Promise<number[] | null> {
  const apiKey = opts.apiKey ?? getEnv('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('[telegram-contact-upsert-fuzzy] embed: missing OPENAI_API_KEY');
    return null;
  }
  if (!text || !text.trim()) return null;

  const retryMs = opts.retryMs ?? [400, 1200, 2400];

  for (let attempt = 0; attempt <= retryMs.length; attempt++) {
    try {
      const resp = await fetch(OPENAI_EMBEDDINGS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: text, model: MODEL }),
      });

      if (resp.ok) {
        const data = await resp.json();
        return data?.data?.[0]?.embedding as number[] ?? null;
      }

      // 4xx (esclusi 429): config error, no retry
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        const body = await resp.text().catch(() => '');
        console.error('[telegram-contact-upsert-fuzzy] embed: 4xx', { status: resp.status, body });
        return null;
      }

      // 429 + 5xx: retry
      if (attempt < retryMs.length) {
        await sleep(retryMs[attempt]);
        continue;
      }
      console.error('[telegram-contact-upsert-fuzzy] embed: exhausted retries', { status: resp.status });
      return null;
    } catch (e) {
      if (attempt < retryMs.length) {
        await sleep(retryMs[attempt]);
        continue;
      }
      console.error('[telegram-contact-upsert-fuzzy] embed: network exhausted', {
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getEnv(name: string): string | undefined {
  // Supporta sia Deno (edge fn) che Node (Next.js server action)
  // @ts-expect-error: Deno present in edge runtime
  if (typeof Deno !== 'undefined' && Deno?.env?.get) return Deno.env.get(name);
  if (typeof process !== 'undefined' && process?.env) return process.env[name];
  return undefined;
}
