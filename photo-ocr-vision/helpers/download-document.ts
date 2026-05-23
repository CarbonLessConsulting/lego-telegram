// telegram-photo-ocr-vision — download-document.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/crm-ocr-pizzino (PDF support 11/05/2026)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Scarica un Document Telegram (file allegato non compresso).
// Supporta: immagini (jpg/png/webp) inviate come "file" + PDF nativi.
// Claude Sonnet 4.6 accetta PDF nativi come source media_type 'application/pdf'.

import type { MediaDownloadResult, TelegramDocument } from "../types.ts";

interface TgGetFileResponse {
  ok: boolean;
  result?: { file_path?: string; file_size?: number };
  description?: string;
}

/** MIME types supportati dal brick (Claude vision + PDF). */
const SUPPORTED_DOC_MIMES = new Set<string>([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function isSupportedDocumentMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return SUPPORTED_DOC_MIMES.has(mime.toLowerCase());
}

/**
 * Scarica un Document Telegram. Filtra MIME non supportati pre-download
 * (cost saving: non scarichiamo file che non possiamo processare).
 */
export async function downloadDocument(
  botToken: string,
  doc: TelegramDocument,
): Promise<MediaDownloadResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!doc || !doc.file_id) return { ok: false, error: "empty_file_id" };

  if (!isSupportedDocumentMime(doc.mime_type)) {
    return {
      ok: false,
      error: `unsupported_mime: ${doc.mime_type ?? "<undefined>"}`,
    };
  }

  // Step 1: getFile
  let fileInfo: TgGetFileResponse;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(doc.file_id)}`,
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

  return {
    ok: true,
    bytes,
    contentType: doc.mime_type ?? "application/octet-stream",
    filePath,
    fileName: doc.file_name ?? filePath.split("/").pop(),
  };
}
