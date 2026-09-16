"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The app's few sounds, synthesised rather than loaded.
 *
 * Four short tones do not justify four network requests and a cache of audio
 * files that have to be decoded before the first tick can play — by which time
 * the checkbox has been ticked for half a second. Oscillators start instantly,
 * weigh nothing, and can be tuned in a line.
 *
 * The brief: quiet, brief, and pitched where a notification is not. Everything
 * here is a soft sine under 120ms with a fast attack and a long tail, closer to
 * a marimba than a chime — a sound you stop noticing by the second day, which
 * is the only kind worth shipping in something opened daily.
 */

export const SOUND_KEY = "iblearner.sound";

/** The moments worth marking. Deliberately not: typing, navigating, hovering. */
export type Sound = "tick" | "complete" | "send" | "receive" | "error";

interface Tone {
  /** Hz, played in order. Two notes make a direction; three make a jingle. */
  notes: number[];
  /** Seconds per note. */
  length: number;
  /** Peak gain. Nothing here goes near 1 — these play over music. */
  gain: number;
  type?: OscillatorType;
}

/*
 * The notes are from one pentatonic scale, which is what stops two sounds
 * landing together — a tick while a reply arrives — from clashing. There is no
 * interval in a pentatonic scale that sounds like a mistake.
 */
const TONES: Record<Sound, Tone> = {
  // Ticking one thing off: a single soft note, up.
  tick: { notes: [880], length: 0.075, gain: 0.05 },
  // Finishing something: the same note, answered a fifth higher.
  complete: { notes: [880, 1318.5], length: 0.085, gain: 0.055 },
  // Sending: quiet, low, and out of the way of whatever comes back.
  send: { notes: [587.3], length: 0.06, gain: 0.04 },
  // A reply landing: two notes down, so it reads as arriving rather than asking.
  receive: { notes: [987.8, 659.3], length: 0.09, gain: 0.045 },
  // Something refused. A flat third, the one interval allowed to be wrong.
  error: { notes: [329.6, 311.1], length: 0.11, gain: 0.05, type: "triangle" },
};

let context: AudioContext | null = null;
let enabled = false;

/** Read once at module load, then kept in a variable so playing is allocation-free. */
function readPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") enabled = readPreference();

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    localStorage.setItem(SOUND_KEY, next ? "1" : "0");
  } catch {
    // Storage blocked. The choice still holds for this session.
  }
  if (next) void play("tick");
}

/**
 * Plays one of the tones, if sound is on.
 *
 * Safe to call from anywhere, including during a render path that also runs on
 * the server: every failure mode here — no AudioContext, a context the browser
 * refuses to resume because there has been no user gesture yet, an autoplay
 * policy — ends in silence rather than an exception. A sound is never important
 * enough to break the thing it was decorating.
 */
export async function play(sound: Sound) {
  if (!enabled || typeof window === "undefined") return;

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    context ??= new Ctor();
    // Browsers start the context suspended until a gesture. Resuming here
    // means the first sound after a click works, rather than the second.
    if (context.state === "suspended") await context.resume();

    const tone = TONES[sound];
    const now = context.currentTime;

    tone.notes.forEach((hz, i) => {
      const at = now + i * tone.length;
      const osc = context!.createOscillator();
      const amp = context!.createGain();

      osc.type = tone.type ?? "sine";
      osc.frequency.setValueAtTime(hz, at);

      // A ramped envelope, not a switch: a square-edged start and stop is the
      // click you hear underneath a badly made UI sound.
      amp.gain.setValueAtTime(0, at);
      amp.gain.linearRampToValueAtTime(tone.gain, at + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + tone.length * 2.2);

      osc.connect(amp).connect(context!.destination);
      osc.start(at);
      osc.stop(at + tone.length * 2.4);
    });
  } catch {
    // No audio. Nothing here is load-bearing.
  }
}

/** For the settings toggle, which needs to re-render when the value changes. */
export function useSound(): [boolean, (next: boolean) => void] {
  // Starts false so the server and the first client render agree; the stored
  // value arrives immediately after mount.
  const [on, setOn] = useState(false);

  useEffect(() => setOn(readPreference()), []);

  const set = useCallback((next: boolean) => {
    setSoundEnabled(next);
    setOn(next);
  }, []);

  return [on, set];
}
