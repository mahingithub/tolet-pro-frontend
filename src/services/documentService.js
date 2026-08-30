/**
 * documentService.js — HTTP client for /api/documents (landlord Document Vault).
 * ──────────────────────────────────────────────────────────────────────────
 * Real backend persistence: files live in Cloudinary, metadata in MongoDB.
 */

import { getCurrentToken } from './authService';
import { directUpload } from './cloudinaryUpload.js';


const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

async function readError(res) {
  const body = await res.json().catch(() => ({}));
  const err = new Error(body.message || `HTTP ${res.status}`);
  err.status = res.status;
  return err;
}

/** Fetch the landlord's documents (optionally filtered by folder). */
export async function listDocuments(folder) {
  const token = getCurrentToken();
  const qs = folder ? `?folder=${encodeURIComponent(folder)}` : '';
  const res = await fetch(`${BASE}/api/documents${qs}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw await readError(res);
  const { documents } = await res.json();
  return documents || [];
}

/**
 * Upload a document. Pass a FormData built like:
 *   const fd = new FormData();
 *   fd.append('file', fileObject);
 *   fd.append('folder', 'agreements');
 *   fd.append('fileName', 'Lease - Araf.pdf');
 */
export async function uploadDocument(formData, onProgress) {
  const file = formData.get('file');
  const folder = formData.get('folder');
  const fileName = formData.get('fileName');
  // Which tenant the file belongs to. These were being appended by the caller
  // and then dropped on the floor right here — read out of the FormData and
  // forwarded below, they are what makes a document show up on the tenant's
  // own card instead of only in the vault.
  const tenantId = formData.get('tenantId');
  const bookingId = formData.get('bookingId');
  const tenantName = formData.get('tenantName');
  const tenantPhone = formData.get('tenantPhone');

  if (!(file instanceof Blob)) throw new Error('Invalid file.');
  
  const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
  
  const result = await directUpload(file, {
    folder: `tolet-pro/documents/direct`,
    resourceType,
    onProgress: (pct) => {
      if (onProgress) onProgress(Math.round(pct * 0.9));
    }
  });

  const token = getCurrentToken();
  const res = await fetch(`${BASE}/api/documents/direct`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) 
    },
    body: JSON.stringify({ 
      secureUrl: result.secureUrl, 
      publicId: result.publicId,
      fileName,
      folder,
      format: result.format || file.name.split('.').pop(),
      bytes: result.bytes || file.size,
      ...(tenantId ? { tenantId } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(tenantName ? { tenantName } : {}),
      ...(tenantPhone ? { tenantPhone } : {}),
    })
  });
  
  if (!res.ok) throw await readError(res);
  const { document } = await res.json();
  
  if (onProgress) onProgress(100);
  return document;
}

/** Permanently delete a document (also removed from Cloudinary). */
export async function deleteDocument(id) {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}/api/documents/${id}`, {
    method: 'DELETE',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

/**
 * Build a "force download" URL from a Cloudinary file URL so the browser
 * saves the file (with the original name) instead of opening it inline.
 * Works for both image and raw (pdf/docx) delivery URLs.
 */
export function downloadUrlFor(fileUrl, fileName) {
  if (!fileUrl) return fileUrl;
  const safe = encodeURIComponent((fileName || 'document').replace(/[^\w.\-]+/g, '_'));
  // Insert fl_attachment right after '/upload/'.
  return fileUrl.replace('/upload/', `/upload/fl_attachment:${safe}/`);
}