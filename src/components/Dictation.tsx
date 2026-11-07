"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useMounted } from "@/lib/useMounted";
import { VOCAB_KEY, fixVocab, parseVocab, readVocab } from "@/lib/vocab";

/**
 * Speak instead of type.
 *
 * Uses the browser's own speech recognition (Chrome, Edge, Safari), so there
 * is no key and no upload of ours. What you say lands where the caret was:
 * in a question's answer if you were in one, otherwise at the end of the
 * free writing. Clicking the mic does not steal focus from the field.
 */

type Lang = "ru-RU" | "en-US";
const LANG_KEY = "lockin.dictation.lang";

/* Minimal shapes of the Web Speech API, which TypeScript's DOM lib omits. */
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognizerCtor = new () => Recognizer;

function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ru-RU" || saved === "en-US") return saved;
  } catch {}
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ru") ? "ru-RU" : "en-US";
}

/** Types text into a React-controlled textarea as if the user had. */
function insertAtCaret(el: HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const chunk = shape(before, text);
  const next = before + chunk + after;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = before.length + chunk.length;
  el.setSelectionRange(caret, caret);
}

/** Spacing and a capital letter where a sentence starts. */
export function shape(before: string, text: string): string {
  let t = text.trim();
  if (!t) return "";
  const sentenceStart = before.trim() === "" || /[.!?…]\s*$/.test(before);
  if (sentenceStart) t = t.charAt(0).toLocaleUpperCase() + t.slice(1);
  const pad = before !== "" && !/\s$/.test(before) ? " " : "";
  return pad + t;
}

export function Dictation({
  scope,
  onAppend,
  compact = false,
}: {
  /** The area whose textareas dictation may type into. */
  scope: RefObject<HTMLElement | null>;
  /** Where the words go when no field inside the scope was focused. */
  onAppend: (text: string) => void;
  compact?: boolean;
}) {
  const mounted = useMounted();
  const [supported, setSupported] = useState(true);
  const [lang, setLang] = useState<Lang>("en-US");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [vocab, setVocab] = useState("");
  const [editing, setEditing] = useState(false);
  const terms = useRef(parseVocab(""));

  const rec = useRef<Recognizer | null>(null);
  const want = useRef(false);
  const target = useRef<HTMLTextAreaElement | null>(null);
  const append = useRef(onAppend);
  append.current = onAppend;

  useEffect(() => {
    setSupported(recognizerCtor() != null);
    setLang(initialLang());
    const v = readVocab();
    setVocab(v);
    terms.current = parseVocab(v);
  }, []);

  const saveVocab = (v: string) => {
    setVocab(v);
    terms.current = parseVocab(v);
    try {
      localStorage.setItem(VOCAB_KEY, v);
    } catch {}
  };

  // Remember the last field written in, so the words go back there.
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLTextAreaElement) target.current = e.target;
    };
    el.addEventListener("focusin", onFocus);
    return () => el.removeEventListener("focusin", onFocus);
  }, [scope]);

  // Stop with the page.
  useEffect(() => () => {
    want.current = false;
    rec.current?.abort();
  }, []);

  const commit = (raw: string) => {
    const text = fixVocab(raw, terms.current);
    const el = target.current;
    if (el && el.isConnected && scope.current?.contains(el)) {
      insertAtCaret(el, text);
    } else {
      target.current = null;
      append.current(text.trim());
    }
  };

  const start = (l: Lang = lang) => {
    const Ctor = recognizerCtor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = l;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) commit(res[0].transcript);
        else live += res[0].transcript;
      }
      setInterim(fixVocab(live, terms.current));
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      want.current = false;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone is blocked — allow it in the address bar."
          : e.error === "network"
            ? "Voice needs an internet connection."
            : "Voice input stopped. Try again.",
      );
    };
    // Chrome ends a session after a pause; keep going until told to stop.
    r.onend = () => {
      setInterim("");
      if (want.current && rec.current === r) {
        try {
          r.start();
          return;
        } catch {}
      }
      if (rec.current === r) {
        rec.current = null;
        setListening(false);
      }
    };
    rec.current = r;
    want.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone.");
    }
  };

  const stop = () => {
    want.current = false;
    rec.current?.stop();
    setListening(false);
  };

  const switchLang = () => {
    const next: Lang = lang === "ru-RU" ? "en-US" : "ru-RU";
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
    if (listening) {
      want.current = false;
      const old = rec.current;
      rec.current = null;
      old?.abort();
      start(next);
    }
  };

  if (!supported) {
    return (
      <span title="Voice input works in Chrome, Edge and Safari" className="text-[11px] text-ink-3">
        No voice in this browser
      </span>
    );
  }

  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <>
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          title="Your words: names and terms dictation should spell your way"
          className={`h-7 rounded-md px-1.5 text-[11px] font-bold tracking-wide transition-colors hover:bg-panel-2 hover:text-ink ${
            editing ? "bg-panel-2 text-ink" : "text-ink-3"
          }`}
        >
          Aa
        </button>
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(340px,calc(100vw-32px))] rounded-xl border border-line bg-panel p-3 text-left shadow-[var(--shadow-lg),var(--edge)]"
            >
              <p className="text-[13px] font-semibold text-ink">Your words</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">
                Names and terms to spell your way, one per line. If one keeps coming out wrong, add what it was heard as
                after a colon.
              </p>
              <textarea
                value={vocab}
                onChange={(e) => saveVocab(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={"IELTS: yelts, aisles\nNazarbayev University"}
                className="mt-2 w-full resize-y rounded-lg border border-line bg-panel-2 px-2.5 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-[var(--accent)]"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg bg-panel-2 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--border)]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={switchLang}
          title="Language you speak in"
          className="h-7 rounded-md px-1.5 text-[11px] font-bold tracking-wide text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
        >
          {lang === "ru-RU" ? "RU" : "EN"}
        </button>
        <motion.button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => (listening ? stop() : start())}
          whileTap={{ scale: 0.9 }}
          aria-pressed={listening}
          aria-label={listening ? "Stop dictation" : "Dictate"}
          title={listening ? "Stop" : "Dictate — speak and it types where your cursor is"}
          className={`relative grid place-items-center rounded-lg transition-colors ${compact ? "size-8" : "size-9"} ${
            listening ? "bg-accent text-white" : "text-ink-3 hover:bg-panel-2 hover:text-ink"
          }`}
        >
          {listening && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-lg bg-accent"
              animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <svg viewBox="0 0 16 16" aria-hidden className="relative size-4">
            <rect x="5.5" y="1.8" width="5" height="8.2" rx="2.5" fill={listening ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
            <path d="M3.2 7.6a4.8 4.8 0 0 0 9.6 0M8 12.4v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {(listening || error) && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[60] md:bottom-6 mx-auto flex w-[min(560px,calc(100vw-32px))] items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-[var(--shadow-lg),var(--edge)]"
              >
                {error ? (
                  <>
                    <p className="flex-1 text-[13px] text-[var(--urgent)]">{error}</p>
                    <button onClick={() => setError(null)} className="text-xs font-medium text-ink-3 hover:text-ink">
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <Bars />
                    <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">
                      {interim || <span className="text-ink-3">Listening{lang === "ru-RU" ? " (RU)" : " (EN)"}… speak</span>}
                    </p>
                    <button
                      onMouseDown={keepFocus}
                      onClick={stop}
                      className="rounded-lg bg-panel-2 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--border)]"
                    >
                      Done
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function Bars() {
  return (
    <span aria-hidden className="flex h-5 items-center gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
