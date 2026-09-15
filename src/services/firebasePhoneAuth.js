/** Firebase proves possession; only the backend creates the app session. */
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth, inMemoryPersistence, RecaptchaVerifier, setPersistence,
  signInWithPhoneNumber, signOut,
} from 'firebase/auth';

function authError(code) {
  return Object.assign(new Error(code), { code });
}

function getWebAuth() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) throw authError('firebase_not_configured');
  return getAuth(getApps().length ? getApp() : initializeApp(config));
}

/** One SMS attempt, kept only in memory. Dispose before starting another. */
export function createPhoneVerification({ container, language = 'en', onVerified = () => {}, onError = () => {} }) {
  const native = Capacitor.isNativePlatform();
  let disposed = false;
  let auth;
  let verifier;
  let confirmation;
  let verificationId;
  let phoneNumber;
  let token;
  let startReject;
  let startupTimer;
  const listeners = [];
  const pending = new Set();
  let disposePromise;
  const track = (operation) => {
    const promise = operation();
    pending.add(promise);
    void promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  };

  const assertActive = () => {
    if (disposed) throw authError('auth/cancelled');
  };
  const nativeToken = async (user) => {
    assertActive();
    if (user?.phoneNumber !== phoneNumber) throw authError('firebase_phone_mismatch');
    const result = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
    if (!result.token) throw authError('firebase_token_missing');
    assertActive();
    token = result.token;
    return token;
  };

  return {
    start(number, { resend = false } = {}) {
      return track(async () => {
      assertActive();
      phoneNumber = number;
      if (!native) {
        auth = getWebAuth();
        // A prior Firebase sign-in must never stand in for this attempt's OTP.
        await setPersistence(auth, inMemoryPersistence);
        assertActive();
        await signOut(auth);
        assertActive();
        auth.languageCode = language;
        verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
        try {
          confirmation = await signInWithPhoneNumber(auth, number, verifier);
          assertActive();
        } catch (err) {
          verifier?.clear();
          verifier = null;
          throw err;
        }
        return;
      }

      await FirebaseAuthentication.signOut();
      assertActive();
      await FirebaseAuthentication.setLanguageCode({ languageCode: language });
      assertActive();
      // Android can verify instantly or retrieve the SMS after codeSent. Both
      // must use the native ID token; the JS SDK has no native user session.
      return new Promise((resolve, reject) => {
        startReject = reject;
        let sent = false;
        let failed = false;
        const finish = () => {
          if (disposed || failed) return;
          sent = true;
          clearTimeout(startupTimer);
          startReject = null;
          resolve();
        };
        const fail = (err) => {
          clearTimeout(startupTimer);
          startReject = null;
          if (disposed || failed) return;
          failed = true;
          if (sent) onError(err); else reject(err);
        };
        startupTimer = setTimeout(() => fail(authError('auth/network-request-failed')), 90_000);
        void track(async () => {
          const add = async (event, handler) => {
            const handle = await FirebaseAuthentication.addListener(event, handler);
            if (disposed) { await handle.remove(); assertActive(); }
            listeners.push(handle);
          };
          await add('phoneCodeSent', (event) => {
            if (disposed || failed) return;
            verificationId = event.verificationId;
            finish();
          });
          await add('phoneVerificationCompleted', async (event) => {
            if (disposed || failed) return;
            try {
              const verifiedToken = await nativeToken(event.user);
              if (disposed || failed) return;
              onVerified(verifiedToken);
              finish();
            } catch (err) { fail(err); }
          });
          await add('phoneVerificationFailed', (event) => {
            // Native errors contain provider messages, never display them raw.
            const message = event.message || '';
            const code = /too many|quota|blocked/i.test(message) ? 'auth/too-many-requests'
              : /not authorized|not enabled|configuration|billing/i.test(message) ? 'auth/operation-not-allowed'
                : /invalid.*phone/i.test(message) ? 'auth/invalid-phone-number' : 'auth/sms-send-failed';
            fail(authError(code));
          });
          assertActive();
          await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: number, resendCode: resend, skipNativeAuth: false });
        }).catch(fail);
      });
      });
    },

    confirm(code) {
      return track(async () => {
      assertActive();
      if (token) return token;
      if (!/^\d{6}$/.test(code || '')) throw authError('auth/invalid-verification-code');
      if (native) {
        if (!verificationId) throw authError('auth/session-expired');
        let result;
        try {
          result = await FirebaseAuthentication.confirmVerificationCode({ verificationId, verificationCode: code });
        } catch (err) {
          // The native bridge can omit Firebase's structured error code.
          if (!err.code && /invalid.*code|code.*invalid/i.test(err.message || '')) err.code = 'auth/invalid-verification-code';
          throw err;
        }
        return nativeToken(result.user);
      }
      if (!confirmation) throw authError('auth/session-expired');
      const result = await confirmation.confirm(code);
      if (result.user.phoneNumber !== phoneNumber) throw authError('firebase_phone_mismatch');
      const resultToken = await result.user.getIdToken(true);
      assertActive();
      token = resultToken;
      return token;
      });
    },

    dispose() {
      if (disposePromise) return disposePromise;
      disposed = true;
      token = null;
      confirmation = null;
      clearTimeout(startupTimer);
      startReject?.(authError('auth/cancelled'));
      startReject = null;
      verifier?.clear();
      verifier = null;
      disposePromise = (async () => {
        await Promise.allSettled(listeners.splice(0).map((listener) => listener.remove()));
        // A web confirm/start can finish after cancellation. Wait for it before
        // signing out, so it cannot leave a Firebase session behind or race the
        // next attempt. The caller waits for this same idempotent cleanup.
        await Promise.allSettled([...pending]);
        try {
          if (native) await FirebaseAuthentication.signOut();
          else if (auth) await signOut(auth);
        } catch { /* the app session is independent of Firebase */ }
      })();
      return disposePromise;
    },
  };
}

export function phoneAuthErrorMessage(code, isBn) {
  const messages = {
    'auth/invalid-verification-code': ['That code is not right. Check the SMS and try again.', 'কোডটি সঠিক নয়। এসএমএস দেখে আবার দিন।'],
    'auth/session-expired': ['This code has expired. Request a new code.', 'কোডের মেয়াদ শেষ। নতুন কোড পাঠাতে বলুন।'],
    'auth/code-expired': ['This code has expired. Request a new code.', 'কোডের মেয়াদ শেষ। নতুন কোড পাঠাতে বলুন।'],
    'auth/too-many-requests': ['Too many attempts. Please wait before requesting another code.', 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে নতুন কোড চান।'],
    'auth/quota-exceeded': ['SMS is temporarily unavailable. Please try again later.', 'এসএমএস এখন পাঠানো যাচ্ছে না। পরে আবার চেষ্টা করুন।'],
    'auth/invalid-phone-number': ['Check the country and phone number.', 'দেশ ও ফোন নম্বর দেখে নিন।'],
    'auth/network-request-failed': ['Check your connection and try again.', 'ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'],
    'auth/captcha-check-failed': ['Please complete the security check and try again.', 'নিরাপত্তা যাচাই শেষ করে আবার চেষ্টা করুন।'],
    'auth/invalid-app-credential': ['The security check failed. Reload the page and try again.', 'নিরাপত্তা যাচাই হয়নি। পৃষ্ঠা রিলোড করে আবার চেষ্টা করুন।'],
    'auth/unauthorized-domain': ['SMS verification is not available on this website yet. Please contact support.', 'এই ওয়েবসাইটে এসএমএস যাচাই এখনো চালু হয়নি। সহায়তায় যোগাযোগ করুন।'],
    'auth/operation-not-allowed': ['SMS verification is not available for this number yet. Please contact support.', 'এই নম্বরে এসএমএস যাচাই এখনো চালু হয়নি। সহায়তায় যোগাযোগ করুন।'],
    firebase_not_configured: ['SMS verification is not configured yet. Please contact support.', 'এসএমএস যাচাই এখনো চালু হয়নি। সহায়তায় যোগাযোগ করুন।'],
  };
  return messages[code]?.[isBn ? 1 : 0];
}
