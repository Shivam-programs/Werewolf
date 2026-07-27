import { useCallback } from "react";

const soundSources = {
  select: "/gameAudio/select-sound.MP3",
  day: "/gameAudio/day-sound.MP3",
  night: "/gameAudio/night-sound.MP3",
  voting: "/gameAudio/village-vote-phase.MP3",
  voteKick: "/gameAudio/vote-kicked.MP3",
  killed: "/gameAudio/killed-by-werewolf.MP3",
  protected: "/gameAudio/protected-by-knight.MP3",
  seerWolf: "/gameAudio/werewolf-reveal-by-seer.MP3",
  seerVillager: "/gameAudio/villager-reveal-by-seer.MP3",
  winner: "/gameAudio/winner.MP3",
  defeat: "/gameAudio/defeat.MP3",
};

const phaseSoundNames = new Set(["day", "night", "voting"]);

const audioPlayers = Object.fromEntries(
  Object.entries(soundSources).map(([name, source]) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = source;
    audio.volume = 0.45;
    audio.load();
    return [name, audio];
  }),
);

let soundsEnabled = true;

export function useGameSounds() {
  const play = useCallback((name) => {
    const audio = audioPlayers[name];
    if (!soundsEnabled || !audio) return;

    if (phaseSoundNames.has(name)) {
      phaseSoundNames.forEach((phaseSoundName) => {
        if (phaseSoundName === name) return;
        const phaseAudio = audioPlayers[phaseSoundName];
        phaseAudio.pause();
        phaseAudio.currentTime = 0;
      });
    }

    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  }, []);

  const enable = useCallback(() => {
    soundsEnabled = true;
  }, []);

  const disable = useCallback(() => {
    soundsEnabled = false;
    Object.values(audioPlayers).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  return { play, enable, disable };
}
