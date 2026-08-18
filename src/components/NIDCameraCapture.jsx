/**
 * NIDCameraCapture.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Single-document capture tile used twice by the NID step in
 * VerificationModal (front + back).
 *
 * WHY THIS IS NOT CAMERA-ONLY
 * ---------------------------
 * The first version called getUserMedia() on mount and offered no way out.
 * On a desktop that is a dead end: a tower with no webcam, a blocked
 * permission, or a camera already held by Zoom all produced the same
 * unrecoverable error card — so those users simply could not finish NID
 * verification. Scanners, phone-transferred photos and screenshots are the
 * normal way people supply an ID on a laptop, and every serious KYC flow
 * (Stripe Identity, Onfido, Persona) offers upload alongside capture.
 *
 * So the tile now has three states and TWO always-available paths:
 *
 *   'choose'  → the default. Explicit "take photo" + "upload file" choice.
 *               Nothing touches the camera until the user asks for it, so
 *               desktop users never see a permission prompt they can't
 *               satisfy. The primary button is ordered by device: capture
 *               first on touch-first devices, upload first on pointer
 *               devices.
 *   'camera'  → live stream with an ID-card framing guide. Carries its own
 *               "upload instead" escape hatch, so a failing camera is never
 *               a dead end.
 *   captured  → preview + replace/remove.
 *
 * Both paths converge on the SAME normalisation step (`normalizePicked`):
 * long edge capped at MAX_EDGE and JPEG quality stepped down until the file
 * fits MAX_BYTES. That closes a real hole in the old version — camera
 * captures skipped the modal's 5 MB guard entirely and only failed later,
 * server-side, in verification.controller.js.
 *
 * Props (unchanged contract — VerificationModal needs no edits):
 *   value      { dataUrl, file, name, size, type } | null
 *   onCapture  (payload | null) => void   — null clears the slot
 *   isBn       boolean
 *   labelBn / labelEn  string             — e.g. "NID — Front"
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera, CheckCircle2, RefreshCw, AlertCircle, Loader2,
  Upload, Trash2, ShieldCheck, X, ScanLine,
} from 'lucide-react';

// ── Limits kept in step with the server (verification.controller.js) ─────
const MAX_BYTES       = 5 * 1024 * 1024;
const ACCEPTED_MIMES  = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EDGE        = 1920;   // plenty for OCR / manual review
const MIN_QUALITY     = 0.45;

// ═══════════════════════════════════════════════════════════════════════
//  IMAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════
const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload  = () => resolve(r.result);
  r.onerror = () => reject(new Error('read'));
  r.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload  = () => resolve(img);
  img.onerror = () => reject(new Error('decode'));
  img.src = src;
});

/** Draw a video/image source into a canvas whose long edge is <= MAX_EDGE. */
const drawScaled = (source, sw, sh) => {
  const scale  = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/** Encode a canvas to JPEG, stepping quality down until it fits MAX_BYTES. */
const canvasToFile = async (canvas, name) => {
  let quality = 0.9;
  let blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  while (blob && blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.15);
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  }
  if (!blob) throw new Error('encode');
  if (blob.size > MAX_BYTES) throw new Error('too-large');
  return new File([blob], name, { type: 'image/jpeg' });
};

/**
 * Normalise anything the user supplies — picked file or camera frame — into
 * the { dataUrl, file, name, size, type } payload the wizard expects.
 * Files that are already small enough pass through untouched so we don't
 * needlessly re-compress a clean scan.
 */
const normalizePicked = async (file) => {
  const dataUrl = await readAsDataURL(file);
  const img     = await loadImage(dataUrl);
  const oversizeEdge  = Math.max(img.naturalWidth, img.naturalHeight) > MAX_EDGE;
  const oversizeBytes = file.size > MAX_BYTES;

  if (!oversizeEdge && !oversizeBytes) {
    return { dataUrl, file, name: file.name, size: file.size, type: file.type };
  }

  const canvas  = drawScaled(img, img.naturalWidth, img.naturalHeight);
  const baseName = (file.name || 'nid').replace(/\.[^.]+$/, '') || 'nid';
  const out      = await canvasToFile(canvas, `${baseName}.jpg`);
  return {
    dataUrl: await readAsDataURL(out),
    file: out,
    name: out.name,
    size: out.size,
    type: out.type,
  };
};

// ═══════════════════════════════════════════════════════════════════════
//  CAPABILITY / ERROR HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Touch-first devices get the camera as the primary action, desktops get upload. */
const prefersCameraFirst = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
};

/**
 * Turn a getUserMedia rejection into copy that tells the user what to do.
 * A generic "unable to access camera" is what made the old card feel broken.
 */
const cameraErrorMessage = (err, isBn) => {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return isBn
        ? 'ক্যামেরার অনুমতি বন্ধ আছে। ফাইল আপলোড করুন, অথবা ব্রাউজারের অনুমতি চালু করুন।'
        : 'Camera permission is blocked. Upload a file instead, or allow camera access in your browser.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return isBn
        ? 'এই ডিভাইসে কোনো ক্যামেরা পাওয়া যায়নি। ফাইল আপলোড করুন।'
        : 'No camera found on this device. Please upload a file instead.';
    case 'NotReadableError':
    case 'AbortError':
      return isBn
        ? 'ক্যামেরাটি অন্য অ্যাপ ব্যবহার করছে। সেটি বন্ধ করুন বা ফাইল আপলোড করুন।'
        : 'Another app is using the camera. Close it, or upload a file instead.';
    default:
      return isBn
        ? 'ক্যামেরা চালু করা গেল না। ফাইল আপলোড করুন।'
        : 'Could not start the camera. Please upload a file instead.';
  }
};

// ═══════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const NIDCameraCapture = ({ onCapture, isBn, labelBn, labelEn, value }) => {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const fileRef   = useRef(null);

  const [mode, setMode]                     = useState('choose'); // 'choose' | 'camera'
  const [error, setError]                   = useState(null);
  const [videoReady, setVideoReady]         = useState(false);
  const [busy, setBusy]                     = useState(false);
  // The live stream is kept in state as WELL as in streamRef. The ref is for
  // teardown (always current, survives stale closures); the state exists purely
  // to trigger a re-render so the attach effect below can bind it once <video>
  // is actually in the DOM. Assigning srcObject straight after getUserMedia
  // fails on the retake path, where the captured preview is still mounted and
  // videoRef.current is null at that moment.
  const [stream, setStream]                 = useState(null);
  // null = not probed yet. Optimistic until proven otherwise so we never
  // hide the capture button on a browser that won't enumerate devices.
  const [cameraSupported, setCameraSupported] = useState(null);

  const label      = isBn ? labelBn : labelEn;
  const isCaptured = !!value?.dataUrl;

  // ── Camera teardown. Held in a ref (not state) so the unmount cleanup
  //    always sees the CURRENT stream. The old version closed over a stale
  //    `stream` from a previous render and could leave the webcam light on.
  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setVideoReady(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  // Bind the stream once the <video> element exists. Keyed on `mode` too, so a
  // retake (which remounts the video after the preview unmounts) re-binds.
  useEffect(() => {
    const v = videoRef.current;
    if (v && stream && v.srcObject !== stream) v.srcObject = stream;
  }, [stream, mode]);

  // ── Capability probe. Runs once, never opens the camera: enumerateDevices
  //    reports the `kind` of each device even before permission is granted,
  //    so a webcam-less desktop is detected without a permission prompt.
  useEffect(() => {
    let alive = true;
    (async () => {
      const md = navigator.mediaDevices;
      const secure = typeof window === 'undefined' ? false : window.isSecureContext !== false;
      if (!md?.getUserMedia || !secure) {
        if (alive) setCameraSupported(false);
        return;
      }
      try {
        const devices = await md.enumerateDevices();
        if (alive) setCameraSupported(devices.some((d) => d.kind === 'videoinput'));
      } catch {
        if (alive) setCameraSupported(true); // can't tell — let the user try
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Start the live stream (only ever on an explicit user action) ────────
  const startCamera = useCallback(async () => {
    setError(null);
    setMode('camera');
    setVideoReady(false);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        // `ideal` rather than an exact constraint: a laptop with only a
        // user-facing webcam would reject an exact 'environment' request.
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = s;
      setStream(s); // the attach effect binds it once <video> is mounted
    } catch (err) {
      stopCamera();
      if (err?.name === 'NotFoundError') setCameraSupported(false);
      setError(cameraErrorMessage(err, isBn));
      setMode('choose');
    }
  }, [isBn, stopCamera]);

  const cancelCamera = useCallback(() => {
    stopCamera();
    setError(null);
    setMode('choose');
  }, [stopCamera]);

  // ── Freeze the current frame ───────────────────────────────────────────
  const handleShutter = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
      const file   = await canvasToFile(canvas, 'nid-capture.jpg');
      const dataUrl = await readAsDataURL(file);
      onCapture({ dataUrl, file, name: file.name, size: file.size, type: file.type });
      stopCamera();
      setMode('choose');
    } catch {
      setError(isBn ? 'ছবিটি সংরক্ষণ করা গেল না। আবার চেষ্টা করুন।' : 'Could not save that frame. Try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, isBn, onCapture, stopCamera]);

  // ── File-upload path ──────────────────────────────────────────────────
  const handlePick = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the user re-pick the same file after a remove
    if (!file) return;

    if (!ACCEPTED_MIMES.includes(file.type)) {
      setError(isBn ? 'JPG, PNG বা WEBP ছবি দিন (PDF নয়)।' : 'Use a JPG, PNG or WEBP image (not a PDF).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      onCapture(await normalizePicked(file));
      setMode('choose');
    } catch (err) {
      setError(
        err?.message === 'too-large'
          ? (isBn ? 'ফাইলটি অনেক বড় (সর্বোচ্চ ৫ MB)।' : 'That file is too large (max 5 MB).')
          : (isBn ? 'ছবিটি পড়া গেল না। অন্য একটি ছবি দিন।' : 'Could not read that image. Try another one.')
      );
    } finally {
      setBusy(false);
    }
  }, [isBn, onCapture]);

  const openFilePicker = () => fileRef.current?.click();

  const clearSlot = () => {
    setError(null);
    onCapture(null);
  };

  // Shared hidden input — note the deliberate absence of `capture`, so this
  // opens the file browser / gallery rather than jumping into the camera.
  const hiddenInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={handlePick}
      aria-label={isBn ? `${label} — ফাইল আপলোড` : `${label} — upload file`}
    />
  );

  const errorNote = error ? (
    <div className="mt-2 flex items-start gap-1.5 px-1">
      <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
      <p className="text-[10px] font-bold text-red-300/90 leading-snug">{error}</p>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────
  //  STATE 1 — captured
  //  `mode !== 'camera'` matters: on a retake we keep the existing image in
  //  state (so cancelling is non-destructive) while showing the live view, and
  //  the camera branch has to win that tie or the <video> never mounts.
  // ─────────────────────────────────────────────────────────────────────
  if (isCaptured && mode !== 'camera') {
    return (
      <div>
        {hiddenInput}
        <div className="relative aspect-[1.58] w-full rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <img src={value.dataUrl} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <div className="px-2 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center gap-1">
              <CheckCircle2 size={10} className="text-emerald-400" />
              <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">
                {isBn ? 'সম্পন্ন' : 'Done'}
              </span>
            </div>
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={openFilePicker}
              className="flex-1 px-2.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-black text-white hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Upload size={11} /> {isBn ? 'বদলান' : 'Replace'}
            </button>
            {cameraSupported !== false && (
              <button
                type="button"
                onClick={startCamera}
                className="px-2.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-black text-white hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
                aria-label={isBn ? 'আবার ছবি তুলুন' : 'Retake photo'}
              >
                <RefreshCw size={11} /> {isBn ? 'আবার' : 'Retake'}
              </button>
            )}
            <button
              type="button"
              onClick={clearSlot}
              className="px-2.5 py-1.5 rounded-full bg-red-500/15 backdrop-blur-md border border-red-500/25 text-red-300 hover:bg-red-500/25 transition-all"
              aria-label={isBn ? 'ছবি মুছুন' : 'Remove image'}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] font-black text-white/40 text-center uppercase tracking-widest">{label}</p>
        {errorNote}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  //  STATE 2 — live camera
  // ─────────────────────────────────────────────────────────────────────
  if (mode === 'camera') {
    return (
      <div>
        {hiddenInput}
        <div className="relative w-full aspect-[1.58] bg-slate-900 rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPlaying={() => setVideoReady(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {!videoReady && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 gap-2">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
              <p className="text-white text-[11px] font-bold">
                {isBn ? 'ক্যামেরা চালু হচ্ছে…' : 'Starting camera…'}
              </p>
              <button
                type="button"
                onClick={cancelCamera}
                className="mt-1 text-[10px] font-bold text-white/60 underline hover:text-white"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          )}

          {videoReady && (
            <>
              {/* ID-card framing guide — a transparent window punched out of a
                  dark scrim via an oversized spread shadow. */}
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none overflow-hidden">
                <div
                  className="w-[85%] aspect-[1.58] rounded-xl relative"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)' }}
                >
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                </div>
              </div>

              <div className="absolute top-3 left-0 w-full flex justify-center z-20 px-3 pointer-events-none">
                <p className="inline-flex items-center gap-1.5 bg-black/65 px-3 py-1 rounded-full text-[10px] text-white font-black backdrop-blur-sm uppercase tracking-widest">
                  <ScanLine size={11} /> {label}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelCamera}
                className="absolute top-2.5 right-2.5 z-30 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-black/80 flex items-center justify-center transition-colors"
                aria-label={isBn ? 'ক্যামেরা বন্ধ করুন' : 'Close camera'}
              >
                <X size={13} />
              </button>

              <div className="absolute bottom-3 left-0 right-0 z-30 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleShutter}
                  disabled={busy}
                  className="w-14 h-14 rounded-full bg-white/20 border-[3px] border-white backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors active:scale-95 disabled:opacity-60"
                  aria-label={isBn ? 'ছবি তুলুন' : 'Take photo'}
                >
                  {busy
                    ? <Loader2 className="animate-spin text-white" size={20} />
                    : <span className="w-10 h-10 rounded-full bg-white block" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Escape hatch: a failing or awkward camera never blocks the step. */}
        <button
          type="button"
          onClick={() => { cancelCamera(); openFilePicker(); }}
          className="mt-2 w-full text-[10px] font-black text-white/50 hover:text-white/90 underline underline-offset-2 transition-colors"
        >
          {isBn ? 'বরং ফাইল আপলোড করি' : 'Upload a file instead'}
        </button>
        {errorNote}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  //  STATE 3 — chooser (default). Nothing has touched the camera yet.
  // ─────────────────────────────────────────────────────────────────────
  const cameraFirst = cameraSupported !== false && prefersCameraFirst();

  const CameraButton = (
    <button
      type="button"
      onClick={startCamera}
      disabled={busy}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
        cameraFirst
          ? 'bg-gradient-to-r from-[#ba0036] to-[#e0004d] text-white shadow-[0_6px_18px_-6px_rgba(186,0,54,0.7)]'
          : 'bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/80 hover:text-white'
      }`}
    >
      <Camera size={13} /> {isBn ? 'ছবি তুলুন' : 'Take photo'}
    </button>
  );

  const UploadButton = (
    <button
      type="button"
      onClick={openFilePicker}
      disabled={busy}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
        cameraFirst
          ? 'bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/80 hover:text-white'
          : 'bg-gradient-to-r from-[#ba0036] to-[#e0004d] text-white shadow-[0_6px_18px_-6px_rgba(186,0,54,0.7)]'
      }`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
      {isBn ? 'ফাইল আপলোড' : 'Upload file'}
    </button>
  );

  return (
    <div>
      {hiddenInput}

      {/* Drop-zone-styled placeholder. Clicking the empty area picks a file —
          the safe default that works on every device. */}
      <div
        className="relative aspect-[1.58] w-full rounded-2xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] flex flex-col items-center justify-center gap-2 px-4 text-center transition-colors hover:border-[#ff4d6d]/30"
      >
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
          <ScanLine size={17} className="text-white/35" />
        </div>
        <p className="text-[11px] font-black text-white/70 uppercase tracking-widest">{label}</p>
        <p className="text-[10px] font-bold text-white/35 leading-snug max-w-[22ch]">
          {cameraSupported === false
            ? (isBn ? 'ক্যামেরা নেই — স্ক্যান বা ছবি আপলোড করুন' : 'No camera detected — upload a scan or photo')
            : (isBn ? 'ছবি তুলুন, অথবা স্ক্যান/ছবি আপলোড করুন' : 'Take a photo, or upload a scan')}
        </p>
        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">JPG · PNG · WEBP · ≤ 5MB</p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {cameraSupported === false
          ? UploadButton
          : (cameraFirst
              ? <>{CameraButton}{UploadButton}</>
              : <>{UploadButton}{CameraButton}</>)}
      </div>

      {errorNote}

      {!error && cameraSupported === false && (
        <div className="mt-2 flex items-start gap-1.5 px-1">
          <ShieldCheck size={12} className="text-emerald-400/70 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-white/35 leading-snug">
            {isBn
              ? 'ফোনে তোলা ছবি কম্পিউটারে পাঠিয়ে আপলোড করলেও চলবে।'
              : 'A photo taken on your phone and sent to this computer works fine.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default NIDCameraCapture;
