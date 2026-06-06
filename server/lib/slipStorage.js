import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), 'server', 'uploads', 'slips');

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export function getSlipStorageDir() {
  return process.env.SLIP_STORAGE_DIR?.trim() || DEFAULT_STORAGE_DIR;
}

export function getSlipStoragePath(fileName) {
  if (!fileName) return null;
  return path.join(getSlipStorageDir(), fileName);
}

function mimeToExtension(mimeType) {
  return MIME_EXTENSIONS[String(mimeType || '').toLowerCase()] || 'jpg';
}

export async function storeSlipImage({ analysisId, mimeType, base64Data }) {
  const safeId = String(analysisId || '').trim() || crypto.randomUUID();
  const fileName = `${safeId}.${mimeToExtension(mimeType)}`;
  const storageDir = getSlipStorageDir();
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(path.join(storageDir, fileName), Buffer.from(String(base64Data || ''), 'base64'));
  return fileName;
}
