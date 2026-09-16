import { useSyncExternalStore } from 'react';
import { getNativeExperience, getNativeHome, isNativeApp, saveNativeExperience, subscribeNativeExperience } from '../utils/nativeExperience';

export default function useNativeExperience() {
  const experience = useSyncExternalStore(subscribeNativeExperience, getNativeExperience, () => null);
  return {
    isNative: isNativeApp(), experience,
    role: experience?.role || null,
    mode: experience?.mode || null,
    homePath: getNativeHome(experience),
    selectExperience: saveNativeExperience,
  };
}
