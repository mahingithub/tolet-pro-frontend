/**
 * documentService.js — HTTP client for /api/documents (landlord Document Vault).
 * ──────────────────────────────────────────────────────────────────────────
 * Real backend persistence: files live in Cloudinary, metadata in MongoDB.
 */

import { getCurrentToken } from './authService';

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
 *   fd.append('tenantId', '...'); fd.append('tenantName', '...'); fd.append('tenantPhone', '...');
 *   fd.append('fileName', 'Lease - Araf.pdf');
 *
 * IMPORTANT: never set Content-Type yourself — the browser must set the
 * multipart boundary automatically.
 */
export async function uploadDocument(formData) {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!res.ok) throw await readError(res);
  const { document } = await res.json();
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