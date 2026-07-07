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
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import callProvider from '../services/callProvider';
import callService from '../services/callService';
import { getCurrentToken } from '../services/authService';

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
  const [callState, setCallState] = useState(null);
  const [muted, setMuted]         = useState(false);
  const [videoOff, setVideoOff]   = useState(false);

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

  // Attach the current remote stream to whichever media elements exist.
  // NOTE: we do NOT gate on call type here — a voice call has only the <audio>
  // element (no <video>), so we just attach to whatever is mounted. This is the
  // key fix for "voice call connects but there's no audio": the stream is stored
  // in a ref and (re)attached on every relevant render, so it can't be missed.
  const attachRemoteStream = useCallback((stream) => {
    if (stream) remoteStreamRef.current = stream;
    const s = remoteStreamRef.current;
    if (!s) return;
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== s) {
      remoteAudioRef.current.srcObject = s;
      remoteAudioRef.current.play?.().catch(() => {});
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== s) {
      remoteVideoRef.current.srcObject = s;
      remoteVideoRef.current.play?.().catch(() => {});
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
      toast.error('Call connect করা গেল না।');
      callProvider.endCall({ callId: incoming.callId });
      setCallState(null);
    }
  }, [ensureSocket, toIncomingState]);

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
      toast.info(missed ? 'Missed call — এই কলটি আর নেই।' : 'এই কলটি আর সক্রিয় নেই।');
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
  }, [acceptIncomingCall, ensureSocket, rejectIncomingCall, toIncomingState]);

  // ─── Subscribe to provider events ──────────────────────────────────────
  useEffect(() => {
    const unsubIncoming = callProvider.onIncomingCall((data) => {
      setCallState(toIncomingState(data, 'ringing'));
    });

    const unsubOutgoing = callProvider.onOutgoingCall((data) => {
      setCallState((prev) => ({
        status: 'ringing',
        direction: 'outgoing',
        callId:      data.callId,
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
          if (status === 'missed' && prev?.direction === 'incoming') {
            toast.error(`Missed call from ${prev.peerName || 'Unknown'}`, {
              action: {
                label: 'Call Back',
                onClick: () => {
                  toast.dismiss();
                  navigate('/messages', { state: { peerUserId: prev.callerId, action: 'call' } });
                }
              },
              duration: 10000,
            });
          } else if (status === 'rejected') {
            toast.error(prev?.direction === 'outgoing' ? 'Call Rejected/Busy' : 'Call Declined');
          } else if (status === 'ended' && prev?.status !== 'accepted') {
            toast.error('Call Cancelled');
          } else if (status === 'ended' && prev?.status === 'accepted') {
            toast.success('Call Ended');
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
  }, [attachLocalStream, attachRemoteStream, toIncomingState]);

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

  const showOverlay = !!callState;
  const isVideoCall = callState?.type === 'video';
  const isInCall    = callState?.status === 'accepted';

  return (
    <>
      {/* Hidden audio element — always mounted whenever there's a call so
          remote audio plays even for outgoing calls handled by ChatSystem. */}
      {callState && <audio ref={remoteAudioRef} autoPlay playsInline />}

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-gray-900/95 backdrop-blur-2xl flex flex-col items-center justify-center text-white p-6"
          >
            {/* Video area when in-call + video */}
            {isInCall && isVideoCall && (
              <div className="absolute inset-0 bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-28 right-4 w-32 h-44 sm:w-40 sm:h-56 object-cover rounded-2xl border-2 border-white/20 shadow-2xl bg-black"
                />
              </div>
            )}

            {/* Avatar / caller info (only visible during ringing or voice-call) */}
            {(!isInCall || !isVideoCall) && (
              <>
                <div className="relative mb-6">
                  {!isInCall && (
                    <>
                      <span className="absolute inset-0 rounded-full border-2 border-[#ba0036]/40 animate-ping"></span>
                      <span className="absolute -inset-3 rounded-full border-2 border-[#ba0036]/20 animate-ping" style={{ animationDelay: '0.4s' }}></span>
                    </>
                  )}
                  <div className="w-32 h-32 rounded-full border-4 border-[#ba0036] p-1 relative">
                    {callState?.peerAvatar ? (
                      <img src={callState.peerAvatar} className="w-full h-full rounded-full object-cover" alt=""/>
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] flex items-center justify-center text-3xl font-black">
                        {(callState?.peerName || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ba0036] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                    {isInCall
                      ? 'In Call'
                      : callState?.direction === 'outgoing' ? 'Calling...' : 'Incoming Call'}
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-1 text-center">{callState?.peerName}</h2>
                <p className="text-gray-400 font-bold mb-10 text-sm">
                  TO-LET PRO HD {isVideoCall ? 'Video' : 'Voice'} Call
                </p>
              </>
            )}

            {/* Controls */}
            <div className={`flex gap-4 sm:gap-8 ${isInCall && isVideoCall ? 'absolute bottom-8 left-1/2 -translate-x-1/2 z-10' : ''}`}>
              {!isInCall ? (
                /* Ringing controls: Accept / Reject for incoming, Hangup for outgoing */
                callState?.direction === 'incoming' ? (
                  <>
                    <button
                      onClick={handleReject}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-all"
                      aria-label="Decline"
                    >
                      <PhoneOff size={28}/>
                    </button>
                    <button
                      onClick={handleAccept}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center shadow-2xl shadow-green-600/40 transition-all animate-bounce"
                      aria-label="Accept"
                    >
                      <Phone size={28}/>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleHangup}
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-all"
                    aria-label="End call"
                  >
                    <PhoneOff size={28}/>
                  </button>
                )
              ) : (
                /* In-call controls: Mute / Hangup / Video toggle */
                <>
                  <button
                    onClick={handleMute}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all border ${
                      muted ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/10 hover:bg-white/20 border-white/10'
                    }`}
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <MicOff size={22}/> : <Mic size={22}/>}
                  </button>
                  <button
                    onClick={handleHangup}
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-all"
                    aria-label="End call"
                  >
                    <PhoneOff size={28}/>
                  </button>
                  {isVideoCall ? (
                    <button
                      onClick={handleVideoToggle}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all border ${
                        videoOff ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/10 hover:bg-white/20 border-white/10'
                      }`}
                      aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {videoOff ? <VideoOff size={22}/> : <Video size={22}/>}
                    </button>
                  ) : (
                    <button
                      className="w-14 h-14 sm:w-16 sm:h-16 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/10"
                      aria-label="Add participant"
                    >
                      <UserPlus size={22}/>
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="mt-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Tap Esc to hang up</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalCallUI;
