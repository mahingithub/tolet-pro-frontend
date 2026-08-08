/**
 * cloudinaryUpload.js — Direct browser-to-Cloudinary upload with signed credentials.
 * ──────────────────────────────────────────────────────────────────────────
 * Instead of piping large files through our Node.js backend (which eats RAM
 * and doubles latency), this module:
 *
 *   1. Asks our API for a one-time signed credential   (tiny JSON POST)
 *   2. Uploads the file straight to Cloudinary's edge   (zero server RAM)
 *   3. Returns the resulting secure URL + public_id
 *
 * Supports real-time upload progress via XHR (fetch can't do that yet).
 *
 * Usage:
 *   import { directUpload, privateUpload } from './cloudinaryUpload';
 *
 *   // Public asset (avatar, payment QR, document)
 *   const { secureUrl, publicId } = await directUpload(file, {
 *     folder: `tolet-pro/avatars/${userId}`,
 *     publicId: 'avatar',
 *     onProgress: (pct) => setProgress(pct),
 *   });
 *
 *   // Private/authenticated asset (NID, identity docs)
 *   const { secureUrl, publicId } = await privateUpload(file, {
 *     folder: `tolet-pro/verification/${userId}`,
 *     publicId: 'nid_front',
 *     onProgress: (pct) => setProgress(pct),
 *   });
 */

const API = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}`
  : 'http://localhost:5000/api';

const getToken = () => window.localStorage.getItem('auth:token');

/**
 * Fetch a signed upload credential from our backend.
 * @param {'public'|'private'} mode
 * @param {object} opts - { folder, publicId?, resourceType? }
 * @returns {Promise<object>} - signature payload
 */
async function getSignature(mode, { folder, publicId, resourceType }) {
  const token = getToken();
  if (!token) {
    const err = new Error('NOT_LOGGED_IN');
    err.code = 'unauthenticated';
    throw err;
  }

  const endpoint = mode === 'private'
    ? `${API}/upload/signature/private`
    : `${API}/upload/signature`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ folder, publicId, resourceType }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.message || ''; } catch { /* ignore */ }
    throw new Error(`Signature request failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  return res.json();
}

/**
 * Upload a file directly to Cloudinary using a signed credential.
 * Uses XHR for real-time progress events (fetch can't expose upload progress).
 *
 * @param {File|Blob} file
 * @param {object}    sig       - signature payload from getSignature()
 * @param {object}    [opts]
 * @param {(pct:number)=>void} [opts.onProgress]
 * @returns {Promise<{ secureUrl: string, publicId: string, bytes: number, format: string }>}
 */
function uploadToCloudinary(file, sig, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sig.apiKey);
    fd.append('timestamp', String(sig.timestamp));
    fd.append('signature', sig.signature);
    fd.append('folder', sig.folder);
    if (sig.publicId)  fd.append('public_id', sig.publicId);
    if (sig.type)      fd.append('type', sig.type);  // 'authenticated' for private

    const resourceType = sig.resourceType || 'image';
    const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* ignore */ }

      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        if (typeof onProgress === 'function') onProgress(100);
        resolve({
          secureUrl: data.secure_url,
          publicId:  data.public_id,
          bytes:     data.bytes || 0,
          format:    data.format || '',
        });
      } else {
        const detail = data?.error?.message || '';
        reject(new Error(`Cloudinary upload failed (${xhr.status})${detail ? `: ${detail}` : ''}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error — could not reach Cloudinary. Check your connection.'));
    };

    xhr.onabort = () => {
      const err = new Error('Upload cancelled.');
      err.code = 'upload_aborted';
      reject(err);
    };

    xhr.send(fd);
  });
}

/**
 * Direct upload for PUBLIC assets (avatars, documents, payment QR, etc.).
 * The file goes straight from the browser to Cloudinary — zero server RAM.
 *
 * @param {File|Blob} file
 * @param {object}    opts
 * @param {string}    opts.folder       - Cloudinary folder path
 * @param {string}    [opts.publicId]   - Deterministic public_id (overwrites on re-upload)
 * @param {string}    [opts.resourceType='image']
 * @param {(pct:number)=>void} [opts.onProgress]
 * @returns {Promise<{ secureUrl: string, publicId: string, bytes: number, format: string }>}
 */
export async function directUpload(file, { folder, publicId, resourceType = 'image', onProgress } = {}) {
  if (!(file instanceof Blob)) {
    throw Object.assign(new Error('Invalid file.'), { code: 'invalid_file' });
  }
  const sig = await getSignature('public', { folder, publicId, resourceType });
  return uploadToCloudinary(file, sig, { onProgress });
}

/**
 * Direct upload for PRIVATE / AUTHENTICATED assets (NID scans, identity docs).
 * Uploaded as Cloudinary type:'authenticated' — the resulting URL requires a
 * signed token to view, so even if the URL leaks it's useless without the
 * API secret.
 *
 * @param {File|Blob} file
 * @param {object}    opts
 * @param {string}    opts.folder
 * @param {string}    [opts.publicId]
 * @param {(pct:number)=>void} [opts.onProgress]
 * @returns {Promise<{ secureUrl: string, publicId: string, bytes: number, format: string }>}
 */
export async function privateUpload(file, { folder, publicId, onProgress } = {}) {
  if (!(file instanceof Blob)) {
    throw Object.assign(new Error('Invalid file.'), { code: 'invalid_file' });
  }
  const sig = await getSignature('private', { folder, publicId });
  return uploadToCloudinary(file, sig, { onProgress });
}
