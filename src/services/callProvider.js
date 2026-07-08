/**
 * callProvider.js — Peer-to-peer voice/video calling with plain WebRTC.
 * ───────────────────────────────────────────────────────────────────────────
 * This is a 100% FREE calling stack. There is NO paid provider (ZegoCloud /
 * Agora / Twilio) and no media server to pay for. Two browsers talk directly
 * to each other ("peer-to-peer") using the browser's built-in WebRTC engine.
 *
 * There are only two moving parts:
 *
 *   1. A tiny "signaling" channel (our Socket.IO server, see backend/socket.js).
 *      Signaling is just message-passing: it lets the two phones swap the small
 *      setup messages they need BEFORE the direct media link exists. No audio or
 *      video ever flows through our server — only these little text messages:
 *        • OFFER   — "here's how I'd like to connect" (an SDP description)
 *        • ANSWER  — "ok, here's my matching setup"   (an SDP description)
 *        • ICE     — "here are network routes you can reach me at" (ICE candidates)
 *
 *   2. Free public STUN servers (Google's) that help each phone discover its
 *      own public address so the two sides can find a route to each other. STUN
 *      is free and requires nothing from us — see ICE_SERVERS below.
 *
 * ── The call handshake, start to finish ─────────────────────────────────────
 *   Caller: initiateCall()      → grabs mic/cam, rings the receiver.
 *   Receiver: acceptCall()      → grabs mic/cam, builds its RTCPeerConnection,
 *                                 tells the caller "accepted".
 *   Caller (on CALL_ACCEPTED)   → builds its RTCPeerConnection, creates an OFFER,
 *                                 sends it.
 *   Receiver (on OFFER)         → sets it, creates an ANSWER, sends it back.
 *   Caller (on ANSWER)          → sets it. Now both sides trade ICE candidates
 *                                 and the direct audio/video link comes up.
 *
 * ── A note on NAT / "why STUN" ──────────────────────────────────────────────
 *   Most phones sit behind a router (NAT) and don't know their own public IP.
 *   STUN is a free service that answers the question "what does my address look
 *   like from the outside?" so the two peers can find each other. For the vast
 *   majority of networks, STUN alone is enough. A small number of strict/mobile
 *   networks (symmetric NAT) also need a TURN relay to connect — TURN is NOT
 *   free to run, so we don't use one. If some users on strict networks can't
 *   connect, see the note next to ICE_SERVERS for how to add a TURN server later.
 *
 * ── Public API (imported by GlobalCallUI, ChatSystem, CallQualityOverlay) ────
 *   connect, disconnect, getSocket, isConnected
 *   initiateCall, acceptCall, rejectCall, endCall
 *   onIncomingCall, onOutgoingCall, onCallStateChange, onRemoteStream, onLocalStream
 *   onNetworkQuality, onReconnectStateChange
 *   toggleMute, toggleVideo, switchCamera, getLocalStream, cleanup
 */

import { io } from 'socket.io-client';

// The Socket.IO server lives at the API host WITHOUT the trailing "/api".
// e.g. VITE_API_BASE_URL="http://localhost:5000/api" → socket at "http://localhost:5000".
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')
  : 'http://localhost:5000';

// ─── Free STUN servers (NAT traversal) ──────────────────────────────────────
// These are Google's public STUN servers — free, no signup, no keys. They only
// help each peer learn its own public address; they never see your audio/video.
//
// If you later find that users on strict mobile networks can't connect, add a
// TURN server here as an extra entry (TURN relays media and is NOT free):
//   { urls: 'turn:YOUR_TURN_HOST:3478', username: '...', credential: '...' }
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─── Media quality (kept modest so it works on 3G/4G) ───────────────────────
const VIDEO_CONSTRAINTS = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 360, max: 360 },
  frameRate: { ideal: 15, max: 24 },
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// ─── Auto-reconnect settings (used if the media link drops mid-call) ─────────
const RECONNECT = {
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  maxAttempts: 5,
  backoffMultiplier: 2,
};

// ─── Internal state ──────────────────────────────────────────────────────────
let _socket = null;              // the Socket.IO connection (our signaling channel)
let _localStream = null;         // our own mic/camera stream
let _peerConnection = null;      // the WebRTC connection to the other person
let _pendingIce = [];            // ICE candidates that arrived before we were ready

// Details about the call currently in progress.
let _currentCallId = null;
let _currentRoomId = null;
let _currentCallType = null;     // 'voice' | 'video'
let _currentPeerId = null;       // the OTHER person's user id
let _isCaller = false;           // true if WE started this call

// Camera facing mode for switchCamera() ('user' = front, 'environment' = back).
let _facingMode = 'user';

// Reconnect + quality-monitor timers.
let _reconnectAttempt = 0;
let _reconnectTimer = null;
let _statsTimer = null;

// Listener sets. Using a Set lets multiple components subscribe at once without
// overwriting each other; each subscribe call returns an unsubscribe function.
const _remoteStreamCbs = new Set();
const _localStreamCbs = new Set();
const _callStateCbs = new Set();
const _incomingCallCbs = new Set();
const _outgoingCallCbs = new Set();
const _networkQualityCbs = new Set();
const _reconnectStateCbs = new Set();

function _emit(cbSet, ...args) {
  cbSet.forEach((cb) => {
    try { cb(...args); } catch (e) { console.error('[callProvider] listener error:', e); }
  });
}

function _subscribe(cbSet, cb) {
  if (typeof cb !== 'function') return () => {};
  cbSet.add(cb);
  return () => cbSet.delete(cb);
}

// ─── Signaling connection (Socket.IO) ────────────────────────────────────────

function getSocket() {
  return _socket;
}

function isConnected() {
  return _socket?.connected === true;
}

/**
 * Open the Socket.IO connection. Called once at app start (after login) so the
 * user can receive incoming calls from any page. Safe to call repeatedly — if
 * we're already connected it just returns the existing socket.
 *
 * @param {string} token — the logged-in user's JWT (used to authenticate the socket).
 */
function connect(token) {
  // Reuse the SINGLE existing socket instance. Creating a second io() while the
  // first is still connecting/reconnecting (very common on mobile networks)
  // would (a) attach a duplicate set of event listeners and (b) leave TWO live
  // sockets in the user's room — so every incoming call would ring twice and
  // signaling would race. connect() is called from several places (login,
  // accepting a call, notification launch), so it MUST be idempotent: one
  // socket, one set of handlers, for the whole session.
  if (_socket) {
    if (token) _socket.auth = { token };
    if (!_socket.connected) {
      try { _socket.connect(); } catch { /* already (re)connecting */ }
    }
    return _socket;
  }

  _socket = io(SOCKET_URL, {
    auth: { token },
    // Start on HTTP long-polling, then upgrade to WebSocket only if it holds.
    // Some hosts (e.g. Render's free tier) don't keep a raw WebSocket reliably;
    // "websocket-first" there causes a connect/disconnect loop that breaks calls.
    transports: ['polling', 'websocket'],
    // Keep retrying: a sleeping free-tier server can take ~50s to wake up.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 60000,
  });

  _socket.on('connect', () => {
    console.log('[callProvider] socket connected:', _socket.id);
  });

  // Refresh the token on every reconnect attempt so a socket that comes back
  // after a long drop still authenticates cleanly.
  _socket.io.on('reconnect_attempt', () => {
    const fresh = window.localStorage.getItem('auth:token');
    if (fresh) _socket.auth = { token: fresh };
  });

  _socket.on('disconnect', (reason) => {
    console.warn('[callProvider] socket disconnected:', reason);
    if (reason === 'io server disconnect') _socket.connect();
  });

  // ── Call lifecycle events ─────────────────────────────────────────────────

  // Someone is calling us.
  _socket.on('CALL_RINGING', (data) => {
    console.log('[callProvider] incoming call:', data);
    _emit(_incomingCallCbs, data);
  });

  // The receiver picked up. If WE are the caller, this is our cue to build the
  // peer connection, create the OFFER, and send it (the receiver is now ready).
  _socket.on('CALL_ACCEPTED', async (data) => {
    console.log('[callProvider] call accepted:', data);
    if (data?.roomId && _isCaller) _currentRoomId = data.roomId;

    // Tell the UI the call is accepted FIRST, so the caller's ringtone stops
    // the instant the receiver answers — we must not make that wait on the
    // WebRTC offer/answer negotiation below.
    _emit(_callStateCbs, 'accepted', data);

    if (_isCaller) {
      try {
        await sendOfferAsCaller();
      } catch (err) {
        console.error('[callProvider] caller failed to send offer:', err);
      }
    }
  });

  _socket.on('CALL_REJECTED', (data) => {
    console.log('[callProvider] call rejected:', data);
    cleanup();
    _emit(_callStateCbs, 'rejected', data);
  });

  const onEnded = (data) => {
    console.log('[callProvider] call ended:', data);
    cleanup();
    _emit(_callStateCbs, 'ended', data);
  };
  _socket.on('CALL_ENDED', onEnded);

  _socket.on('CALL_MISSED', (data) => {
    console.log('[callProvider] call missed:', data);
    cleanup();
    _emit(_callStateCbs, 'missed', data);
  });

  // ── WebRTC handshake relay ────────────────────────────────────────────────
  // The server just forwards these between the two peers.

  // Receiver receives the caller's OFFER → answer it.
  _socket.on('OFFER', (data) => handleRemoteOffer(data));

  // Caller receives the receiver's ANSWER → finish the handshake.
  _socket.on('ANSWER', (data) => handleRemoteAnswer(data));

  // Either side receives a network route from the other → add it.
  _socket.on('ICE_CANDIDATE', (data) => handleRemoteIce(data));

  return _socket;
}

function disconnect() {
  cleanup();
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

// ─── Media + peer-connection helpers ─────────────────────────────────────────

/**
 * Ask the browser for the microphone (and camera, for video calls). If the
 * camera fails on a video call we fall back to audio-only so the call can still
 * go through — common on low-end phones.
 */
async function getLocalStream(type) {
  const constraints = {
    audio: AUDIO_CONSTRAINTS,
    video: type === 'video' ? { ...VIDEO_CONSTRAINTS, facingMode: _facingMode } : false,
  };
  try {
    _localStream = await navigator.mediaDevices.getUserMedia(constraints);
    _emit(_localStreamCbs, _localStream, type);
    return _localStream;
  } catch (err) {
    console.error('[callProvider] getUserMedia failed:', err);
    if (type === 'video') {
      console.warn('[callProvider] camera failed — falling back to audio-only');
      _localStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
      _emit(_localStreamCbs, _localStream, 'voice');
      return _localStream;
    }
    throw err;
  }
}

/**
 * Build the RTCPeerConnection — the object that actually holds the direct link
 * to the other person. We attach our media, listen for theirs, and relay ICE
 * candidates through the socket.
 */
function createPeerConnection() {
  _peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // 1. Send our own audio/video tracks to the peer.
  if (_localStream) {
    _localStream.getTracks().forEach((track) => _peerConnection.addTrack(track, _localStream));
  }

  // 2. When the peer's media arrives, hand it up to the UI to render.
  _peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) _emit(_remoteStreamCbs, event.streams[0]);
  };

  // 3. Each time the browser discovers a network route to us, send it over so
  //    the peer can try to reach us there. The server figures out who the peer
  //    is from the callId, so we don't need to include a target here.
  _peerConnection.onicecandidate = (event) => {
    if (event.candidate && _socket) {
      _socket.emit('ICE_CANDIDATE', {
        callId: _currentCallId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  // 4. Watch the health of the media link: drive the "Reconnecting…" banner and
  //    auto-repair the connection if it drops.
  _peerConnection.oniceconnectionstatechange = () => {
    const state = _peerConnection?.iceConnectionState;
    console.log('[callProvider] ICE state:', state);

    if (state === 'disconnected' || state === 'failed') {
      _emit(_reconnectStateCbs, true);
      attemptReconnect();
    } else if (state === 'connected' || state === 'completed') {
      _emit(_reconnectStateCbs, false);
      _reconnectAttempt = 0;
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      startStatsMonitor();
    }
  };

  return _peerConnection;
}

/**
 * CALLER side: create the SDP offer and send it. Runs once the receiver accepts.
 */
async function sendOfferAsCaller() {
  if (!_localStream) await getLocalStream(_currentCallType);
  if (!_peerConnection) createPeerConnection();

  const offer = await _peerConnection.createOffer();
  await _peerConnection.setLocalDescription(offer);
  _socket?.emit('OFFER', { callId: _currentCallId, sdp: offer });
}

/**
 * RECEIVER side: we got the caller's OFFER. Set it, then reply with an ANSWER.
 * (This same handler also processes "re-offers" during an auto-reconnect.)
 */
async function handleRemoteOffer(data) {
  try {
    if (!_peerConnection) createPeerConnection();
    await _peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushPendingIce(); // any ICE that arrived early can be added now

    const answer = await _peerConnection.createAnswer();
    await _peerConnection.setLocalDescription(answer);
    _socket?.emit('ANSWER', { callId: data.callId || _currentCallId, sdp: answer });
  } catch (err) {
    console.error('[callProvider] handleRemoteOffer failed:', err);
  }
}

/**
 * CALLER side: we got the receiver's ANSWER. Setting it completes the handshake.
 */
async function handleRemoteAnswer(data) {
  if (!_peerConnection) return;
  try {
    await _peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushPendingIce();
  } catch (err) {
    console.error('[callProvider] handleRemoteAnswer failed:', err);
  }
}

/**
 * A network route (ICE candidate) arrived from the peer. We can only add a
 * candidate AFTER the remote description (offer/answer) is set — otherwise the
 * browser throws. If it's too early, we stash it and add it in flushPendingIce.
 */
async function handleRemoteIce(data) {
  const candidate = data?.candidate;
  if (!candidate) return;

  const remoteReady = _peerConnection && _peerConnection.remoteDescription && _peerConnection.remoteDescription.type;
  if (!remoteReady) {
    _pendingIce.push(candidate);
    return;
  }
  try {
    await _peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error('[callProvider] addIceCandidate failed:', err);
  }
}

/**
 * Add any ICE candidates that arrived before the remote description was ready.
 */
async function flushPendingIce() {
  if (!_peerConnection) return;
  const queued = _pendingIce;
  _pendingIce = [];
  for (const candidate of queued) {
    try {
      await _peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[callProvider] flush addIceCandidate failed:', err);
    }
  }
}

/**
 * If the media link drops, try to repair it with an "ICE restart" — the caller
 * sends a fresh offer that re-negotiates the network path without dropping the
 * call. Only the caller does this, so both sides don't offer at the same time.
 */
function attemptReconnect() {
  if (!_isCaller) return; // receiver just waits for the caller's fresh offer
  if (_reconnectAttempt >= RECONNECT.maxAttempts) {
    console.warn('[callProvider] max reconnect attempts reached');
    return;
  }

  const delay = Math.min(
    RECONNECT.initialDelayMs * Math.pow(RECONNECT.backoffMultiplier, _reconnectAttempt),
    RECONNECT.maxDelayMs,
  );

  _reconnectTimer = setTimeout(async () => {
    _reconnectAttempt++;
    const state = _peerConnection?.iceConnectionState;
    if (_peerConnection && state !== 'connected' && state !== 'completed') {
      try {
        const offer = await _peerConnection.createOffer({ iceRestart: true });
        await _peerConnection.setLocalDescription(offer);
        _socket?.emit('OFFER', { callId: _currentCallId, sdp: offer });
      } catch (err) {
        console.error('[callProvider] reconnect failed:', err);
        attemptReconnect();
      }
    }
  }, delay);
}

// ─── Optional call-quality monitor (drives CallQualityOverlay) ────────────────
// Reads WebRTC stats every 2s and turns packet loss into a 0–4 level
// (0 = excellent, 4 = unusable). Purely informational; never affects the call.

function startStatsMonitor() {
  if (_statsTimer || !_peerConnection) return;
  let lastLost = 0;
  let lastTotal = 0;

  _statsTimer = setInterval(async () => {
    if (!_peerConnection) return;
    try {
      const stats = await _peerConnection.getStats();
      let packetsLost = 0;
      let packetsReceived = 0;
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && !report.isRemote) {
          packetsLost += report.packetsLost || 0;
          packetsReceived += report.packetsReceived || 0;
        }
      });

      const deltaLost = packetsLost - lastLost;
      const deltaTotal = (packetsReceived + packetsLost) - lastTotal;
      lastLost = packetsLost;
      lastTotal = packetsReceived + packetsLost;

      let level = 0;
      if (deltaTotal > 0) {
        const loss = deltaLost / deltaTotal;
        if (loss > 0.30) level = 4;
        else if (loss > 0.15) level = 3;
        else if (loss > 0.07) level = 2;
        else if (loss > 0.02) level = 1;
        else level = 0;
      }
      _emit(_networkQualityCbs, { level });
    } catch {
      /* getStats can fail transiently — safe to ignore */
    }
  }, 2000);
}

function stopStatsMonitor() {
  if (_statsTimer) { clearInterval(_statsTimer); _statsTimer = null; }
}

// ─── Tear everything down at the end of a call ────────────────────────────────
function cleanup() {
  stopStatsMonitor();
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }

  if (_localStream) {
    _localStream.getTracks().forEach((t) => t.stop());
    _localStream = null;
    _emit(_localStreamCbs, null, null);
  }
  if (_peerConnection) {
    _peerConnection.close();
    _peerConnection = null;
  }

  _pendingIce = [];
  _currentCallId = null;
  _currentRoomId = null;
  _currentCallType = null;
  _currentPeerId = null;
  _isCaller = false;
  _facingMode = 'user';
  _reconnectAttempt = 0;

  // Reset the UI indicators.
  _emit(_reconnectStateCbs, false);
  _emit(_networkQualityCbs, { level: null });
}

// ─── Public call actions ──────────────────────────────────────────────────────

/**
 * Start a call. Creates the Call record via REST, grabs our mic/cam so the
 * caller sees a self-preview while ringing, then rings the receiver over the
 * socket. We build the peer connection + send the OFFER only once the receiver
 * accepts (see the CALL_ACCEPTED handler) — no point negotiating into a phone
 * that hasn't been picked up.
 */
async function initiateCall({ receiverId, type, callerName, callerAvatar, receiverName, receiverAvatar }) {
  const token = window.localStorage.getItem('auth:token');
  const baseUrl = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
    : 'http://localhost:5000/api';

  // 1. Persist the call so it shows up in history and both sides share a roomId.
  const res = await fetch(`${baseUrl}/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receiverId, type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create call');
  }
  const { call } = await res.json();

  // 2. Remember the call details. We are the CALLER.
  _isCaller = true;
  _currentCallId = call.id;
  _currentRoomId = call.roomId;
  _currentCallType = type;
  _currentPeerId = receiverId;

  // 3. Tell our own UI an outgoing call has started.
  _emit(_outgoingCallCbs, {
    callId: call.id,
    receiverId,
    type,
    roomId: call.roomId,
    receiverName,
    receiverAvatar,
  });

  // 4. Grab mic/cam now (fails fast if permissions are denied; gives a preview).
  try {
    await getLocalStream(type);
  } catch (err) {
    console.error('[callProvider] could not access microphone/camera:', err);
  }

  // 5. Ring the receiver over the socket.
  _socket?.emit('CALL_INITIATED', {
    callId: call.id,
    receiverId,
    type,
    roomId: call.roomId,
    callerName,
    callerAvatar,
  });

  return call;
}

/**
 * Accept an incoming call. We grab our mic/cam and build the peer connection so
 * we're ready to answer the caller's OFFER (which arrives right after we tell
 * the caller we've accepted).
 */
async function acceptCall({ callId, callerId, type, roomId }) {
  _isCaller = false;
  _currentCallId = callId;
  _currentRoomId = roomId;
  _currentCallType = type;
  _currentPeerId = callerId;

  await getLocalStream(type);
  createPeerConnection();

  _socket?.emit('CALL_ACCEPTED', { callId });
}

/**
 * Decline an incoming call (or cancel our own outgoing call while it rings).
 */
function rejectCall({ callId }) {
  _socket?.emit('CALL_REJECTED', { callId: callId || _currentCallId });
  cleanup();
}

/**
 * Hang up an active call.
 */
function endCall({ callId }) {
  _socket?.emit('CALL_ENDED', { callId: callId || _currentCallId });
  cleanup();
}

// ─── Event subscriptions (each returns an unsubscribe function) ──────────────

function onRemoteStream(cb)       { return _subscribe(_remoteStreamCbs, cb); }
function onLocalStream(cb)        { return _subscribe(_localStreamCbs, cb); }
function onCallStateChange(cb)    { return _subscribe(_callStateCbs, cb); }
function onIncomingCall(cb)       { return _subscribe(_incomingCallCbs, cb); }
function onOutgoingCall(cb)       { return _subscribe(_outgoingCallCbs, cb); }
function onNetworkQuality(cb)     { return _subscribe(_networkQualityCbs, cb); }
function onReconnectStateChange(cb) { return _subscribe(_reconnectStateCbs, cb); }

// ─── Media controls ───────────────────────────────────────────────────────────

/** Mute/unmute our microphone. Returns true if we are now muted. */
function toggleMute() {
  if (!_localStream) return false;
  const audioTrack = _localStream.getAudioTracks()[0];
  if (!audioTrack) return false;
  audioTrack.enabled = !audioTrack.enabled;
  return !audioTrack.enabled;
}

/** Turn our camera on/off. Returns true if the camera is now off. */
function toggleVideo() {
  if (!_localStream) return false;
  const videoTrack = _localStream.getVideoTracks()[0];
  if (!videoTrack) return false;
  videoTrack.enabled = !videoTrack.enabled;
  return !videoTrack.enabled;
}

/**
 * Switch between the front and back camera on a phone (video calls only).
 * We grab a new stream from the other camera and hot-swap it into the live
 * connection with replaceTrack — no need to renegotiate the whole call.
 * Returns true if it switched.
 */
async function switchCamera() {
  if (_currentCallType !== 'video' || !_localStream) return false;
  const oldTrack = _localStream.getVideoTracks()[0];
  if (!oldTrack) return false;

  _facingMode = _facingMode === 'user' ? 'environment' : 'user';
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { ...VIDEO_CONSTRAINTS, facingMode: _facingMode },
      audio: false,
    });
    const newTrack = newStream.getVideoTracks()[0];
    if (!newTrack) return false;

    // Swap the outgoing track on the live connection.
    const sender = _peerConnection?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(newTrack);

    // Swap it into our local stream too so the self-preview updates.
    oldTrack.stop();
    _localStream.removeTrack(oldTrack);
    _localStream.addTrack(newTrack);
    _emit(_localStreamCbs, _localStream, 'video');
    return true;
  } catch (err) {
    console.warn('[callProvider] switchCamera failed:', err);
    return false;
  }
}

function getLocalStream$exposed() {
  return _localStream;
}

// ─── Export ────────────────────────────────────────────────────────────────────

const callProvider = {
  // Connection
  connect,
  disconnect,
  getSocket,
  isConnected,

  // Call actions
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,

  // Event handlers (each returns an unsubscribe fn)
  onRemoteStream,
  onLocalStream,
  onCallStateChange,
  onIncomingCall,
  onOutgoingCall,
  onNetworkQuality,
  onReconnectStateChange,

  // Media controls
  toggleMute,
  toggleVideo,
  switchCamera,
  getLocalStream: getLocalStream$exposed,

  // Cleanup
  cleanup,
};

// Best-effort hang-up if the tab is closed mid-call.
window.addEventListener('beforeunload', () => {
  if (_currentCallId && _socket) {
    try { _socket.emit('CALL_ENDED', { callId: _currentCallId }); } catch { /* ignore */ }
  }
});

export default callProvider;
