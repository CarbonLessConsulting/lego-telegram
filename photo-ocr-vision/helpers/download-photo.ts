// telegram-photo-ocr-vision — download-photo.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-photo/index.ts
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (getFile + downloadFileBytes)
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Pattern Telegram: update.message.photo e' un Array di PhotoSize (4 size).
// L'ultima entry (idx -1) e' la risoluzione piu' alta. Per OCR la qualita'
// massima e' essenziale (testo piccolo, biglietti da visita, libretti veicolo).

import type { MediaDownloadResult, TelegramPhotoSize } from "../types.ts";

interface TgGetFileResponse {
  ok: boolean;
  result?: { file_path?: string; file_size?: number };
  description?: string;
}

/**
 * Sceglie la PhotoSize migliore dall'array Telegram photo[].
 * Telegram fornisce thumb (90x90), small (320x320), medium (800x800),
 * large (≤1280x1280). La larga ha la migliore OCR accuracy.
 */
export function pickBestPhotoSize(
  photos: TelegramPhotoSize[],
): TelegramPhotoSize | null {
  if (!photos || photos.length === 0) return null;
  // Sort by (width * height) DESC, prendi la prima
  return [...photos].sort(
    (a, b) => b.width * b.height - a.width * a.height,
  )[0]!;
}

/**
 * Scarica una photo Telegram (best resolution).
 * Accetta o un singolo TelegramPhotoSize (gia' scelto) o l'array completo.
 */
export async function downloadPhoto(
  botToken: string,
  photoOrArray: TelegramPhotoSize | TelegramPhotoSize[],
): Promise<MediaDownloadResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };

  const photo = Array.isArray(photoOrArray)
    ? pickBestPhotoSize(photoOrArray)
    : photoOrArray;

  if (!photo) return { ok: false, error: "no_photo_size_available" };
  if (!photo.file_id) return { ok: false, error: "empty_file_id" };

  // Step 1: getFile
  let fileInfo: TgGetFileResponse;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(photo.file_id)}`,
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

  const ext = (filePath.split(".").pop() ?? "jpg").toLowerCase();
  const contentType = inferPhotoContentType(ext);

  return {
    ok: true,
    bytes,
    contentType,
    filePath,
    fileName: filePath.split("/").pop(),
  };
}

function inferPhotoContentType(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}
