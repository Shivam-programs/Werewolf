import { useCallback, useRef } from "react";

// Keep audio sources configurable and copyright-safe. Supply local assets through VITE_SOUND_*.
const soundSources = {
  click: import.meta.env.VITE_SOUND_CLICK,
  day: import.meta.env.VITE_SOUND_DAY,
  night: import.meta.env.VITE_SOUND_NIGHT,
  win: import.meta.env.VITE_SOUND_WIN,
  lose: import.meta.env.VITE_SOUND_LOSE,
  death: import.meta.env.VITE_SOUND_DEATH,
};

export function useGameSounds() {
  const enabled = useRef(true);
  const play = useCallback((name) => {
    const source = soundSources[name];
    if (!enabled.current || !source) return;
    const audio = new Audio(source);
    audio.volume = 0.45;
    audio.play().catch(() => { });
  }, []);
  return { play, setEnabled: (value) => { enabled.current = value; } };
}
