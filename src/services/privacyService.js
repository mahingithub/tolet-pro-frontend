/**
 * privacyService.js
 * ──────────────────────────────────────────────────────────────────────────
 * User-facing data-control surface (the "Privacy Center").
 * Now connected to real backend endpoints.
 */

import { jsPDF } from 'jspdf';
import { broadcast, subscribe } from './_storage.js';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const KEY_PREFS = 'privacy:preferences'; // kept for local broadcast triggers

const getToken = () => window.localStorage.getItem('auth:token');

function authHeaders() {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── EXPORT ───────────────────────────────────────────────────────────────

const BRAND = [186, 0, 54]; // #ba0036

// Human-readable label from a camelCase / snake_case key.
const titleCase = (k) =>
  String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

// Turn any scalar into a readable string, keeping the PDF clean: booleans →
// Yes/No, ISO timestamps → local date, embedded files / very long blobs get
// collapsed so they don't flood the document.
const fmtValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    if (/^data:/i.test(v)) return '[embedded file]';
    if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    if (v.length > 800) return `${v.slice(0, 800)}…`;
    return v;
  }
  return String(v);
};

/**
 * Render the account-export payload into a branded, paginated PDF and return
 * an object-URL for download. Replaces the old raw-JSON download so the file a
 * user gets is something they can actually read.
 */
const buildDataExportPdf = (payload = {}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE_H = 15;

  let y = MARGIN;
  let pageNo = 1;

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(165);
    doc.text('TO-LET PRO — Personal data export', MARGIN, PAGE_H - 20);
    doc.text(`Page ${pageNo}`, PAGE_W - MARGIN, PAGE_H - 20, { align: 'right' });
  };

  const newPage = () => {
    footer();
    doc.addPage();
    pageNo += 1;
    y = MARGIN;
  };

  // Ensure `needed` vertical space is available, else break to a new page.
  const ensure = (needed = LINE_H) => {
    if (y + needed > PAGE_H - MARGIN) newPage();
  };

  // ── Branded header band ──────────────────────────────────────────────
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, PAGE_W, 92, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('TO-LET PRO', MARGIN, 44);
  doc.setFontSize(13);
  doc.text('My data export', MARGIN, 66);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, PAGE_W - MARGIN, 66, { align: 'right' });
  y = 118;

  // Render a single "Label: value" line with wrapping + indentation.
  const renderKV = (label, value, indent) => {
    const x = MARGIN + indent * 14;
    const labelText = `${titleCase(label)}: `;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const labelW = doc.getTextWidth(labelText);
    const wrapped = doc.splitTextToSize(fmtValue(value), Math.max(60, CONTENT_W - (x - MARGIN) - labelW));
    ensure(LINE_H * wrapped.length);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(95);
    doc.text(labelText, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(35);
    doc.text(wrapped, x + labelW, y);
    y += LINE_H * wrapped.length;
  };

  // Recursively render an arbitrary node (object / array / scalar).
  const renderNode = (label, value, indent) => {
    const x = MARGIN + indent * 14;
    if (Array.isArray(value)) {
      ensure();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(70);
      doc.text(`${titleCase(label)} (${value.length})`, x, y);
      y += LINE_H;
      if (value.length === 0) {
        ensure();
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(155);
        doc.text('none', x + 14, y);
        y += LINE_H;
        return;
      }
      value.forEach((item, i) => {
        if (item && typeof item === 'object') {
          ensure();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(130);
          doc.text(`#${i + 1}`, x + 14, y);
          y += LINE_H;
          Object.entries(item).forEach(([k, v]) => renderNode(k, v, indent + 2));
        } else {
          renderKV(`#${i + 1}`, item, indent + 1);
        }
      });
      return;
    }
    if (value && typeof value === 'object') {
      ensure();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(70);
      doc.text(titleCase(label), x, y);
      y += LINE_H;
      Object.entries(value).forEach(([k, v]) => renderNode(k, v, indent + 1));
      return;
    }
    renderKV(label, value, indent);
  };

  const sections = Object.entries(payload || {});
  if (sections.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text('No data available for export.', MARGIN, y);
  }

  sections.forEach(([section, value]) => {
    // Section heading + underline.
    ensure(LINE_H * 2 + 12);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(titleCase(section), MARGIN, y);
    y += 7;
    doc.setDrawColor(228);
    doc.setLineWidth(1);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += LINE_H;

    if (Array.isArray(value)) {
      // Iterate items directly so we don't repeat the section title.
      if (value.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(155);
        ensure();
        doc.text('none', MARGIN, y);
        y += LINE_H;
      }
      value.forEach((item, i) => {
        if (item && typeof item === 'object') {
          ensure();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(130);
          doc.text(`#${i + 1}`, MARGIN, y);
          y += LINE_H;
          Object.entries(item).forEach(([k, v]) => renderNode(k, v, 1));
        } else {
          renderKV(`#${i + 1}`, item, 0);
        }
      });
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => renderNode(k, v, 0));
    } else {
      renderKV(section, value, 0);
    }
    y += 10;
  });

  footer();

  return doc.output('blob');
};

export const exportMyData = async () => {
  const data = await call('/users/me/export');
  // data.payload contains the full account dump — rendered to a readable PDF.
  const blob = buildDataExportPdf(data.payload);
  const downloadUrl = URL.createObjectURL(blob);
  const filename = `tolet-pro-data-${new Date().getTime()}.pdf`;
  return {
    downloadUrl,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    filename,
  };
};

// ─── DELETION ─────────────────────────────────────────────────────────────

export const getPendingDeletion = async () => {
  // If we needed to poll this on mount we could fetch from a /users/me endpoint,
  // but usually it's tied to the user profile which is hydrated via Auth context.
  // For now, we will return null unless managed locally, or we could fetch the user.
  const res = await call('/auth/me');
  return res.user?.pendingDeletion?.scheduledAt ? res.user.pendingDeletion : null;
};

export const requestAccountDeletion = async () => {
  const data = await call('/users/me/delete', { method: 'POST' });
  return data.pendingDeletion;
};

export const cancelAccountDeletion = async () => {
  const data = await call('/users/me/delete/cancel', { method: 'POST' });
  return data;
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────

export const listMySessions = async () => {
  const data = await call('/users/me/sessions');
  return data.sessions;
};

export const revokeSession = async (sessionId) => {
  const data = await call(`/users/me/sessions/${sessionId}`, { method: 'DELETE' });
  return data;
};

export const revokeAllOtherSessions = async () => {
  const data = await call('/users/me/sessions', { method: 'DELETE' });
  return data;
};

// ─── PREFERENCES ──────────────────────────────────────────────────────────

export const getPreferences = async () => {
  const data = await call('/users/me/preferences');
  return data.preferences;
};

export const setPreferences = async (patch) => {
  const data = await call('/users/me/preferences', {
    method: 'PATCH',
    body: patch
  });
  broadcast(KEY_PREFS);
  return data.preferences;
};

export const onPreferencesChanged = (listener) => {
  return subscribe(KEY_PREFS, listener);
};
