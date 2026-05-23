// telegram-voice-capture-whisper — download-voice.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (getFile + downloadFileBytes)
// Brick: telegram-voice-capture-whisper v0.1.0 (le-GO E-Media)
//
// Scarica un file voice da Telegram via:
//   1. getFile(file_id) → ritorna file_path su CDN Telegram
//   2. download dai server Telegram → Uint8Array
//
// Soft no-throw: ritorna VoiceDownloadResult { ok: false, error } su qualsiasi
// errore (token vuoto, network error, 4xx Telegram, file_path mancante).

import type { VoiceDownloadResult } from "../types.ts";

interface TgGetFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
  };
  description?: string;
}

/**
 * Scarica il binary di un voice message da Telegram.
 *
 * @param botToken Token bot Telegram (NON in chiaro nel codice — sempre via env).
 * @param fileId file_id del voice message (da update.message.voice.file_id).
 * @returns { ok: true, bytes, contentType, filePath } o { ok: false, error }
 */
export async function downloadVoice(
  botToken: string,
  fileId: string,
): Promise<VoiceDownloadResult> {
  if (!botToken) {
    return { ok: false, error: "empty_bot_token" };
  }
  if (!fileId) {
    return { ok: false, error: "empty_file_id" };
  }

  // Step 1: getFile per ottenere file_path
  let fileInfo: TgGetFileResponse;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    fileInfo = (await resp.json()) as TgGetFileResponse;
  } catch (e) {
    return { ok: false, error: `getfile_network_error: ${String(e)}` };
  }

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    return {
      ok: false,
      error: `getfile_failed: ${fileInfo.description ?? "no file_path"}`,
    };
  }

  const filePath = fileInfo.result.file_path;

  // Step 2: download binary
  let bytes: Uint8Array;
  try {
    const dlResp = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
    );
    if (!dlResp.ok) {
      return { ok: false, error: `download_http_${dlResp.status}` };
    }
    bytes = new Uint8Array(await dlResp.arrayBuffer());
  } catch (e) {
    return { ok: false, error: `download_network_error: ${String(e)}` };
  }

  // Inferisci content-type da estensione (Telegram voice di default è ogg).
  const ext = (filePath.split(".").pop() ?? "ogg").toLowerCase();
  const contentType = inferContentType(ext);

  return {
    ok: true,
    bytes,
    contentType,
    filePath,
  };
}

function inferContentType(ext: string): string {
  switch (ext) {
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "webm":
      return "audio/webm";
    default:
      return "audio/ogg";
  }
}
