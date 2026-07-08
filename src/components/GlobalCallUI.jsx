// GlobalCallUI.jsx
//
// App-level call UI that handles BOTH incoming and outgoing calls regardless
// of which page the user is on. Mounted once in AppLayout, listens to
// callProvider events, and shows a full-screen overlay when there's an
// active call.
//
// Features:
//   • Incoming call ringing UI with Accept / Reject (works from any page).
//   • Outgoing call ringing UI when user initiates from ChatSystem.
//   • Audio + Video elements that attach the remote stream after accept.
//   • Local video preview for video calls.
//   • Synthesized ringtone via Web Audio API (no audio file needed).
//   • Mute, hang-up, camera toggle controls.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera } from 'lucide-react';
import { toast } from 'sonner';
import callProvider from '../services/callProvider';
import callService from '../services/callService';
import chatService from '../services/chatService';
import { getCurrentToken } from '../services/authService';
import { useLanguage } from '../context/LanguageContext';
import CallOutcomeToast from './CallOutcomeToast';

// mm:ss / h:mm:ss timer for the connected-call duration.
const fmtDuration = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
};

// ─── Ringtone — Web Audio API synthesized tone, no file needed ──────────────
class Ringtone {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.active = false;
  }
  start({ outgoing = false } = {}) {
    if (this.active) return;
    this.active = true;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }
      // Resume if browser suspended it.
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const beep = () => {
        if (!this.active || !this.ctx || this.ctx.state === 'closed') return;
        try {
          const osc  = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = outgoing ? 420 : 480; // slightly different tone in/out
          const now = this.ctx.currentTime;
          // gentle envelope, ~0.4s beep
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
          gain.gain.setValueAtTime(0.12, now + 0.35);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.45);
        } catch (err) {
          console.warn('[Ringtone] beep failed:', err);
        }
      };
      // ring pattern: short beep, 800ms gap, repeat.
      beep();
      this.timer = setInterval(beep, 1300);
    } catch (e) {
      console.warn('[Ringtone] failed:', e);
    }
  }
  stop() {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

const GlobalCallUI = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // callState shape:
  //   null  — no call
  //   { status: 'ringing'|'accepted', direction: 'incoming'|'outgoing',
  //     callId, callerId, peerName, peerAvatar, type, roomId }
  const { t } = useLanguage();
  const [callState, setCallState] = useState(null);
  const [muted, setMuted]         = useState(false);
  const [videoOff, setVideoOff]   = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);   // connected-call timer
  const [peerOnline, setPeerOnline]   = useState(null); // outgoing: is the callee online?

  // `t` is a fresh Proxy each render — hold it in a ref so the call-outcome
  // toasts (fired from a mount-time subscription) always read current labels.
  const tRef = useRef(t);
  tRef.current = t;

  // Shows one of the premium call-outcome cards (ended / missed / declined /
  // cancelled / failed) via sonner's custom-toast API.
  const showCallToast = useCallback((variant, { title, subtitle, isVideo = false, onCallBack = null, duration = 6000 } = {}) => {
    toast.custom((id) => (
      <CallOutcomeToast
        variant={variant}
        title={title}
        subtitle={subtitle}
        isVideo={isVideo}
        callBackLabel={tRef.current.callBackAction || 'Call back'}
        onCallBack={onCallBack ? () => { toast.dismiss(id); onCallBack(); } : undefined}
        onClose={() => toast.dismiss(id)}
      />
    ), { duration, position: 'top-center' });
  }, []);

  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef  = useRef(null);
  const ringtoneRef    = useRef(null);
  // Hold the remote MediaStream so we can (re)attach it whenever the audio/video
  // elements mount. Without this, a voice call's stream could arrive a beat
  // before the <audio> element existed and then never get attached → no sound.
  const remoteStreamRef = useRef(null);
  const handledNotificationActionsRef = useRef(new Set());

  if (!ringtoneRef.current) ringtoneRef.current = new Ringtone();

  // Attach the current remote stream to EXACTLY ONE media element.
  //
  // A <video> element plays BOTH the video AND the audio track of its stream,
  // while a voice call has only the <audio> element. Attaching the same stream
  // to both a <video> and an <audio> element (the old behaviour) made the remote
  // voice play TWICE on a video call → echo / robotic audio. So we route by
  // whether the stream actually carries a video track:
  //   • has video → <video> element (plays audio+video); detach the <audio>.
  //   • no video  → <audio> element (voice call, or video not mounted yet).
  // The stream is stored in a ref and re-attached on every relevant render, so
  // it can never be missed even if an element mounts a beat late.
  const attachRemoteStream = useCallback((stream) => {
    if (stream) remoteStreamRef.current = stream;
    const s = remoteStreamRef.current;
    if (!s) return;
    const hasVideo = typeof s.getVideoTracks === 'function' && s.getVideoTracks().length > 0;

    if (hasVideo && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== s) {
        remoteVideoRef.current.srcObject = s;
        remoteVideoRef.current.play?.().catch(() => {});
      }
      // Never let the standalone <audio> element ALSO play this stream (echo).
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject = null;
      }
    } else if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== s) {
        remoteAudioRef.current.srcObject = s;
        remoteAudioRef.current.play?.().catch(() => {});
      }
    }
  }, []);

  const attachLocalStream = useCallback((stream, type) => {
    if (type === 'video' && stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play?.().catch(() => {});
    }
  }, []);

  const ensureSocket = useCallback(() => {
    const token = getCurrentToken();
    if (!token) return false;
    callProvider.connect(token);
    return true;
  }, []);

  const toIncomingState = useCallback((data, status = 'ringing') => ({
    status,
    direction: 'incoming',
    callId:      data.callId,
    callerId:    data.callerId,
    peerName:    data.callerName || data.peerName || 'Unknown',
    peerAvatar:  data.callerAvatar || data.peerAvatar || null,
    // Normalise to exactly 'voice' | 'video'. A voice call must NEVER be read as
    // video (that would turn the camera on and stall the connection), so
    // anything that isn't literally 'video' falls back to 'voice'.
    type:        data.type === 'video' ? 'video' : 'voice',
    roomId:      data.roomId,
  }), []);

  const acceptIncomingCall = useCallback(async (incoming) => {
    if (!incoming?.callId) return;
    if (!ensureSocket()) { setCallState(null); return; }

    // Flip to "accepted" IMMEDIATELY so the ringtone stops the instant the user
    // taps Accept — we do NOT wait for the mic/camera to be acquired first.
    // (Previously 'accepted' was set only AFTER acceptCall() resolved, so a slow
    // getUserMedia left the phone ringing even though the call was answered.)
    setCallState(toIncomingState(incoming, 'accepted'));

    try {
      await callProvider.acceptCall({
        callId:   incoming.callId,
        callerId: incoming.callerId,
        type:     incoming.type === 'video' ? 'video' : 'voice',
        roomId:   incoming.roomId,
      });
    } catch (err) {
      console.error('[GlobalCallUI] acceptCall failed:', err);
      showCallToast('failed', {
        title: tRef.current.callFailedTitle || 'Call failed',
        subtitle: tRef.current.callFailedSub || "Couldn't connect the call",
        isVideo: incoming.type === 'video',
      });
      callProvider.endCall({ callId: incoming.callId });
      setCallState(null);
    }
  }, [ensureSocket, toIncomingState, showCallToast]);

  const rejectIncomingCall = useCallback((incoming) => {
    if (!incoming?.callId) return;
    if (!ensureSocket()) {
      setCallState(null);
      return;
    }
    callProvider.rejectCall({ callId: incoming.callId });
    setCallState(null);
  }, [ensureSocket]);

  const handleNotificationLaunch = useCallback(async (incoming, action = 'open') => {
    if (!incoming?.callId) return;

    const key = `${incoming.callId}:${action}:${incoming.roomId || ''}`;
    if (handledNotificationActionsRef.current.has(key)) return;
    handledNotificationActionsRef.current.add(key);

    // Declining is always safe (idempotent, even on a dead call).
    if (action === 'decline') {
      rejectIncomingCall(incoming);
      return;
    }

    // Opening/answering from a notification: the notification can outlive the
    // call (the caller hung up, it went to voicemail/missed, or the other side
    // ended it). Confirm the call is STILL ringing with the server before we
    // show an answerable UI — otherwise tapping a stale "missed call" would open
    // the call screen and let the user "answer" a call that no longer exists.
    let liveStatus = null;
    try {
      const call = await callService.getCall(incoming.callId);
      liveStatus = call?.status || null;
    } catch (err) {
      // 404 (call not found / already cleaned up) → treat as no-longer-active.
      if (err?.status === 404 || err?.code === 'not_found') liveStatus = 'ended';
      // Any other failure (network, auth): fall through and let the socket flow
      // decide, rather than blocking a genuinely-ringing call.
    }

    if (liveStatus && liveStatus !== 'ringing') {
      const missed = liveStatus === 'missed';
      if (missed) {
        showCallToast('missed', {
          title: tRef.current.callMissedTitle || 'Missed call',
          subtitle: incoming.callerName || incoming.peerName || 'Unknown',
          isVideo: incoming.type === 'video',
          duration: 8000,
        });
      } else {
        showCallToast('cancelled', {
          title: tRef.current.callNoLongerActive || 'Call no longer active',
          subtitle: incoming.callerName || incoming.peerName || '',
          isVideo: incoming.type === 'video',
        });
      }
      // Make sure no stale ringing UI is showing.
      setCallState((prev) => (prev?.callId === incoming.callId ? null : prev));
      return;
    }

    if (action === 'accept') {
      acceptIncomingCall(incoming);
      return;
    }

    ensureSocket();
    setCallState(toIncomingState(incoming, 'ringing'));
  }, [acceptIncomingCall, ensureSocket, rejectIncomingCall, toIncomingState, showCallToast]);

  // ─── Subscribe to provider events ──────────────────────────────────────
  useEffect(() => {
    const unsubIncoming = callProvider.onIncomingCall((data) => {
      setCallState((prev) => {
        // Ignore a duplicate/stale ring for a call we're already showing or in
        // (prevents a late CALL_RINGING from resetting an accepted call).
        if (prev && String(prev.callId) === String(data.callId)) return prev;
        return toIncomingState(data, 'ringing');
      });
    });

    const unsubOutgoing = callProvider.onOutgoingCall((data) => {
      setCallState((prev) => ({
        status: 'ringing',
        direction: 'outgoing',
        callId:      data.callId,
        peerId:      data.receiverId || prev?.peerId || null,
        peerName:    data.receiverName || prev?.peerName || 'Unknown',
        peerAvatar:  data.receiverAvatar || prev?.peerAvatar || null,
        type:        data.type === 'video' ? 'video' : 'voice',
        roomId:      data.roomId,
      }));
    });

    const unsubState = callProvider.onCallStateChange((status, data) => {
      if (status === 'accepted') {
        setCallState((prev) => prev ? { ...prev, status: 'accepted', roomId: data?.roomId || prev.roomId } : null);
      } else if (status === 'ended' || status === 'rejected' || status === 'missed') {
        setCallState((prev) => {
          const wasAccepted = prev?.status === 'accepted';
          const isVideo   = prev?.type === 'video';
          const peerName  = prev?.peerName || 'Unknown';
          const T = tRef.current;

          if (status === 'missed' && prev?.direction === 'incoming') {
            const peerId = prev?.callerId || prev?.peerId || null;
            showCallToast('missed', {
              title: T.callMissedTitle || 'Missed call',
              subtitle: peerName,
              isVideo,
              duration: 10000,
              onCallBack: peerId
                ? () => navigate('/messages', { state: { peerUserId: peerId, mode: 'call', callType: isVideo ? 'video' : 'voice' } })
                : null,
            });
          } else if (status === 'rejected') {
            showCallToast('declined', {
              title: prev?.direction === 'outgoing' ? (T.callBusyTitle || 'Call declined') : (T.callDeclinedTitle || 'Call declined'),
              subtitle: peerName,
              isVideo,
            });
          } else if (status === 'ended' && !wasAccepted) {
            showCallToast('cancelled', { title: T.callCancelledTitle || 'Call cancelled', subtitle: peerName, isVideo });
          } else if (status === 'ended' && wasAccepted) {
            const dur = Number(data?.duration);
            const subtitle = Number.isFinite(dur) && dur > 0 ? `${peerName} · ${fmtDuration(dur)}` : peerName;
            showCallToast('ended', { title: T.callEndedTitle || 'Call ended', subtitle, isVideo });
          }
          return null;
        });
        // Drop the finished call's remote stream so a later call can't briefly
        // play the previous call's audio before its own stream attaches.
        remoteStreamRef.current = null;
        setMuted(false);
        setVideoOff(false);
      }
    });

    const unsubRemoteStream = callProvider.onRemoteStream((stream) => {
      attachRemoteStream(stream);
    });

    const unsubLocalStream = callProvider.onLocalStream(attachLocalStream);

    return () => {
      unsubIncoming?.();
      unsubOutgoing?.();
      unsubState?.();
      unsubRemoteStream?.();
      unsubLocalStream?.();
    };
  }, [attachLocalStream, attachRemoteStream, toIncomingState, showCallToast, navigate]);

  useEffect(() => {
    if (callState?.status !== 'accepted' || callState?.type !== 'video') return;
    attachLocalStream(callProvider.getLocalStream(), callState.type);
  }, [attachLocalStream, callState?.status, callState?.type]);

  // Re-attach the remote stream once the call is accepted. The <audio>/<video>
  // elements can mount AFTER the remote stream first arrived (especially on a
  // voice call), so this guarantees the stored stream gets wired to them and
  // audio actually plays.
  useEffect(() => {
    if (callState?.status === 'accepted') attachRemoteStream();
  }, [attachRemoteStream, callState?.status, callState?.type]);

  // Notification click → app launch. The service worker opens /messages with
  // these params when the PWA was closed or in the background.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('incomingCall') !== '1') return;

    const incoming = {
      callId: params.get('callId') || '',
      callerId: params.get('callerId') || '',
      callerName: params.get('callerName') || 'Unknown',
      callerAvatar: params.get('callerAvatar') || '',
      type: params.get('type') || 'voice',
      roomId: params.get('roomId') || '',
    };
    const action = params.get('callAction') || params.get('action') || 'open';

    handleNotificationLaunch(incoming, action);

    [
      'incomingCall',
      'callAction',
      'action',
      'callId',
      'callerId',
      'callerName',
      'callerAvatar',
      'type',
      'roomId',
    ].forEach((key) => params.delete(key));

    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : '',
    }, { replace: true });
  }, [handleNotificationLaunch, location.pathname, location.search, navigate]);

  // Notification click → already-open app tab. This avoids waiting for a route
  // navigation if the browser focuses an existing PWA window.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    const onMessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'TOLET_INCOMING_CALL_NOTIFICATION_CLICK' || msg.type === 'ANSWER_CALL') {
        handleNotificationLaunch(msg.call || msg.payload || {}, msg.action || 'open');
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [handleNotificationLaunch]);

  // Ringtone control — ring while status === 'ringing', stop otherwise.
  useEffect(() => {
    const rt = ringtoneRef.current;
    if (!rt) return;
    if (callState?.status === 'ringing') {
      rt.start({ outgoing: callState.direction === 'outgoing' });
    } else {
      rt.stop();
    }
    return () => rt.stop();
  }, [callState?.status, callState?.direction]);

  // ── Connected-call timer — counts up once the call is accepted ────────────
  useEffect(() => {
    if (callState?.status !== 'accepted') { setCallSeconds(0); return undefined; }
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callState?.status, callState?.callId]);

  // ── Outgoing presence — "Ringing" (peer online) vs "Calling" (offline) ────
  useEffect(() => {
    let cancelled = false;
    if (callState?.direction === 'outgoing' && callState?.status === 'ringing' && callState?.peerId) {
      chatService.getPresence([callState.peerId])
        .then((map) => { if (!cancelled) setPeerOnline(map?.[String(callState.peerId)]?.online ?? null); })
        .catch(() => { if (!cancelled) setPeerOnline(null); });
    } else {
      setPeerOnline(null);
    }
    return () => { cancelled = true; };
  }, [callState?.direction, callState?.status, callState?.peerId]);

  // Hang-up on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && callState) {
        handleHangup();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  const handleAccept = async () => {
    if (!callState || callState.direction !== 'incoming') return;
    acceptIncomingCall(callState);
  };

  const handleReject = () => {
    if (!callState) return;
    rejectIncomingCall(callState);
  };

  const handleHangup = () => {
    if (!callState) return;
    callProvider.endCall({ callId: callState.callId });
    setCallState(null);
    setMuted(false);
    setVideoOff(false);
  };

  const handleMute = () => {
    const isMuted = callProvider.toggleMute();
    setMuted(isMuted);
  };

  const handleVideoToggle = () => {
    const isOff = callProvider.toggleVideo();
    setVideoOff(isOff);
  };

  // Flip between front/back camera on a phone (video calls only). No-op on
  // single-camera devices (the provider returns false and leaves the call as-is).
  const handleSwitchCamera = () => {
    callProvider.switchCamera?.();
  };

  const showOverlay = !!callState;
  const isVideoCall = callState?.type === 'video';
  const isInCall    = callState?.status === 'accepted';

  // Status line: connected → running timer; outgoing → "Ringing" (peer online)
  // vs "Calling" (peer offline); incoming → "Incoming call".
  const statusText = isInCall
    ? fmtDuration(callSeconds)
    : callState?.direction === 'outgoing'
      ? (peerOnline === false ? (t.callCalling || 'Calling…') : (t.callRinging || 'Ringing…'))
      : (t.callIncoming || 'Incoming call');

  return (
    <>
      {/* Hidden audio element — always mounted whenever there's a call so
          remote audio plays even for outgoing calls handled by ChatSystem. */}
      {callState && <audio ref={remoteAudioRef} autoPlay playsInline />}

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[200] flex flex-col items-center text-white overflow-hidden ${isInCall && isVideoCall ? 'bg-black' : ''}`}
          >
            {/* Ambient gradient background (audio / all ringing states). Video call
                gets an indigo accent; voice call gets the brand red accent. */}
            {!(isInCall && isVideoCall) && (
              <div aria-hidden className="absolute inset-0 -z-10">
                <div className={`absolute inset-0 ${isVideoCall ? 'bg-gradient-to-b from-indigo-900 via-gray-900 to-black' : 'bg-gradient-to-b from-[#7a0024] via-gray-900 to-black'}`} />
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-30 bg-[#ba0036]" />
                <div className={`absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30 ${isVideoCall ? 'bg-indigo-500' : 'bg-[#ba0036]'}`} />
              </div>
            )}

            {/* Remote + local video (connected video call) */}
            {isInCall && isVideoCall && (
              <div className="absolute inset-0 bg-black">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {/* Local self-view — mirrored (scale-x-[-1]) like every camera app. */}
                <video ref={localVideoRef} autoPlay playsInline muted className={`absolute bottom-32 right-4 w-28 h-40 sm:w-40 sm:h-56 object-cover rounded-2xl border-2 border-white/25 shadow-2xl bg-black scale-x-[-1] ${videoOff ? 'hidden' : ''}`} />
                {videoOff && (
                  <div className="absolute bottom-32 right-4 w-28 h-40 sm:w-40 sm:h-56 rounded-2xl border-2 border-white/25 shadow-2xl bg-gray-800 flex items-center justify-center">
                    <VideoOff size={26} className="text-white/50" />
                  </div>
                )}
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
              </div>
            )}

            {/* Top bar: call-type chip + (connected video) name + timer */}
            <div className="relative z-10 w-full flex flex-col items-center px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-lg ${
                isVideoCall ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-100' : 'bg-[#ba0036]/30 border-[#ba0036]/60 text-red-100'
              }`}>
                {isVideoCall ? <Video size={14}/> : <Phone size={14}/>}
                {isVideoCall ? (t.callVideoCall || 'Video Call') : (t.callVoiceCall || 'Voice Call')}
              </div>
              {isInCall && isVideoCall && (
                <div className="mt-3 text-center">
                  <h2 className="text-xl font-black drop-shadow">{callState?.peerName}</h2>
                  <p className="text-sm font-bold text-white/80 tabular-nums mt-0.5">{fmtDuration(callSeconds)}</p>
                </div>
              )}
            </div>

            {/* Center: avatar + name + status (hidden while connected video shows) */}
            {!(isInCall && isVideoCall) && (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
                <div className="relative mb-7">
                  {!isInCall && (
                    <>
                      <span className={`absolute inset-0 rounded-full border-2 animate-ping ${isVideoCall ? 'border-indigo-400/40' : 'border-[#ba0036]/40'}`}></span>
                      <span className={`absolute -inset-4 rounded-full border-2 animate-ping ${isVideoCall ? 'border-indigo-400/20' : 'border-[#ba0036]/20'}`} style={{ animationDelay: '0.5s' }}></span>
                    </>
                  )}
                  <div className={`w-36 h-36 rounded-full p-1 relative border-4 shadow-2xl ${isVideoCall ? 'border-indigo-400' : 'border-[#ba0036]'}`}>
                    {callState?.peerAvatar ? (
                      <img src={callState.peerAvatar} className="w-full h-full rounded-full object-cover" alt=""/>
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] flex items-center justify-center text-4xl font-black">
                        {(callState?.peerName || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-2 text-center drop-shadow">{callState?.peerName}</h2>
                <div className="flex items-center gap-2">
                  {!isInCall && <span className={`w-2 h-2 rounded-full animate-pulse ${isVideoCall ? 'bg-indigo-400' : 'bg-[#ba0036]'}`} />}
                  <p className="text-white/85 font-bold text-base tabular-nums">{statusText}</p>
                </div>
                {isInCall && muted && (
                  <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5"><MicOff size={12}/> {t.callMuted || 'You are muted'}</p>
                )}
              </div>
            )}

            {/* Controls */}
            <div className={`relative z-10 flex items-end justify-center gap-5 sm:gap-8 w-full px-6 ${isInCall && isVideoCall ? 'mt-auto' : ''}`} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)' }}>
              {!isInCall ? (
                callState?.direction === 'incoming' ? (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <button onClick={handleReject} className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-all active:scale-95" aria-label={t.callDecline || 'Decline'}><PhoneOff size={26}/></button>
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.callDecline || 'Decline'}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <button onClick={handleAccept} className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center shadow-2xl shadow-green-600/40 transition-all animate-bounce" aria-label={t.callAccept || 'Accept'}><Phone size={26}/></button>
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.callAccept || 'Accept'}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={handleHangup} className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-all active:scale-95" aria-label={t.callCancel || 'Cancel'}><PhoneOff size={26}/></button>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.callCancel || 'Cancel'}</span>
                  </div>
                )
              ) : (
                <>
                  {/* Mute / Unmute */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleMute}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all border active:scale-95 ${muted ? 'bg-white text-gray-900 border-white' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'}`}
                      aria-label={muted ? (t.callUnmute || 'Unmute') : (t.callMute || 'Mute')}
                    >
                      {muted ? <MicOff size={22}/> : <Mic size={22}/>}
                    </button>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{muted ? (t.callUnmute || 'Unmute') : (t.callMute || 'Mute')}</span>
                  </div>
                  {/* Camera toggle (video only) */}
                  {isVideoCall && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handleVideoToggle}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all border active:scale-95 ${videoOff ? 'bg-white text-gray-900 border-white' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'}`}
                        aria-label={videoOff ? (t.callCameraOn || 'Turn camera on') : (t.callCameraOff || 'Turn camera off')}
                      >
                        {videoOff ? <VideoOff size={22}/> : <Video size={22}/>}
                      </button>
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.callCamera || 'Camera'}</span>
                    </div>
                  )}
                  {/* Flip front/back camera (video only, not while camera off) */}
                  {isVideoCall && !videoOff && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handleSwitchCamera}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all border active:scale-95 bg-white/10 hover:bg-white/20 border-white/20 text-white"
                        aria-label={t.callFlipCamera || 'Flip camera'}
                      >
                        <SwitchCamera size={22}/>
                      </button>
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.callFlip || 'Flip'}</span>
                    </div>
                  )}
                  {/* End */}
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={handleHangup} className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-all active:scale-95" aria-label={t.callEnd || 'End call'}><PhoneOff size={26}/></button>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.callEnd || 'End'}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalCallUI;
