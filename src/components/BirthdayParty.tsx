"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { BirthdayToday, birthdaysToday } from "@/lib/birthdays";

/**
 * A party on someone's birthday.
 *
 * Opens by itself the first time the site is opened on the day (once per
 * browser session), with fireworks, confetti, gift boxes that burst open and
 * a big rainbow "Happy Birthday". Click anywhere or press Esc to close; it
 * also winds down on its own. Someone who asked their system for less motion
 * gets the message without the fireworks.
 */

const SEEN_KEY = "lockin.birthday.seen";
const COLORS = ["#ff3b6b", "#ff8a00", "#ffd60a", "#3ddc84", "#22b8ff", "#8b5cf6", "#ff4fd8"];
const LENGTH_MS = 11000;

export function BirthdayParty() {
  const store = useStore();
  const today = todayISO();
  const people = useMemo(
    () => (store.ready ? birthdaysToday(store.importantDays, today, store.profile.name) : []),
    [store.ready, store.importantDays, store.profile.name, today],
  );
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!people.length) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY) === today) return;
      sessionStorage.setItem(SEEN_KEY, today);
    } catch {}
    setOpen(true);
  }, [people.length, today]);

  // "Preview the party" in Settings shows it on any day.
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const show = () => {
      setPreview(true);
      setOpen(true);
    };
    window.addEventListener("lockin:birthday-preview", show);
    return () => window.removeEventListener("lockin:birthday-preview", show);
  }, []);
  const shown: BirthdayToday[] = people.length ? people : preview ? [{ id: "preview", name: "you", mine: true }] : [];

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence onExitComplete={() => setPreview(false)}>
      {open && shown.length > 0 && <Party key="party" people={shown} onClose={() => setOpen(false)} />}
    </AnimatePresence>,
    document.body,
  );
}

/* --------------------------------- The party -------------------------------- */

function headline(people: BirthdayToday[]): { who: string; sub: string } {
  const me = people.find((p) => p.mine);
  const others = people.filter((p) => !p.mine);
  const age = (p: BirthdayToday) => (p.age ? ` · ${p.age}` : "");
  if (me && !others.length) return { who: "to you!", sub: me.age ? `${me.age} years. The best one yet.` : "Your day. Enjoy every minute of it." };
  if (me) return { who: "to you!", sub: `And to ${others.map((p) => p.name).join(" & ")} too` };
  if (others.length === 1) return { who: `${others[0].name}!`, sub: others[0].age ? `Turning ${others[0].age} today. Don't forget to say it.` : "Don't forget to say it today." };
  return { who: others.map((p) => p.name).join(" & ") + "!", sub: others.map((p) => `${p.name}${age(p)}`).join("  ·  ") };
}

function Party({ people, onClose }: { people: BirthdayToday[]; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fx = useRef<Fireworks | null>(null);
  const calm = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const { who, sub } = headline(people);

  useEffect(() => {
    const el = canvas.current;
    if (!el || calm) return;
    const f = new Fireworks(el);
    fx.current = f;
    f.start();
    return () => f.stop();
  }, [calm]);

  useEffect(() => {
    const t = setTimeout(onClose, LENGTH_MS);
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const burstAt = useCallback((x: number, y: number) => fx.current?.burst(x, y, 70), []);

  return (
    <motion.div
      role="dialog"
      aria-label="Happy birthday"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      onClick={onClose}
      className="fixed inset-0 z-[200] cursor-pointer overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% 40%, rgba(20,10,40,0.72), rgba(5,3,12,0.9))" }}
    >
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-2 text-[13px] font-semibold uppercase tracking-[0.35em] text-white/70"
        >
          {people.some((p) => p.mine) ? "It's your day" : "Birthday today"}
        </motion.p>
        <Rainbow text="Happy Birthday" />
        <motion.p
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, type: "spring", stiffness: 260, damping: 14 }}
          className="rainbow-text mt-1 text-[clamp(28px,6vw,64px)] font-black leading-none tracking-tight"
        >
          {who}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
          className="mt-4 max-w-xl text-[clamp(14px,2vw,18px)] font-medium text-white/85"
        >
          {sub}
        </motion.p>
      </div>

      <Gifts onPop={burstAt} calm={calm} />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
        className="pointer-events-none absolute inset-x-0 top-4 text-center text-[11px] text-white/45"
      >
        Tap anywhere to close
      </motion.p>
    </motion.div>
  );
}

/** Each letter bounces in, then the rainbow keeps flowing through them. */
function Rainbow({ text }: { text: string }) {
  return (
    <h1 aria-label={text} className="flex flex-wrap justify-center gap-x-[0.25em] text-[clamp(44px,11vw,150px)] font-black leading-[0.95] tracking-tight">
      {text.split(" ").map((word, w) => (
        <span key={w} className="flex">
          {word.split("").map((ch, i) => {
            const n = w * 6 + i;
            return (
              <motion.span
                key={i}
                aria-hidden
                initial={{ y: -120, opacity: 0, rotate: -25, scale: 0.4 }}
                animate={{ y: [null, 0, -14, 0], opacity: 1, rotate: 0, scale: 1 }}
                transition={{ delay: 0.25 + n * 0.06, duration: 0.9, times: [0, 0.55, 0.78, 1], ease: "easeOut" }}
                className="rainbow-text inline-block drop-shadow-[0_6px_24px_rgba(255,80,200,0.35)]"
                style={{ animationDelay: `${-n * 0.12}s` }}
              >
                {ch}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/* ----------------------------------- Gifts ---------------------------------- */

const GIFTS = [
  { x: 10, size: 92, box: "#ff3b6b", ribbon: "#ffd60a", delay: 0.6 },
  { x: 27, size: 70, box: "#22b8ff", ribbon: "#ff4fd8", delay: 1.0 },
  { x: 73, size: 78, box: "#8b5cf6", ribbon: "#3ddc84", delay: 0.8 },
  { x: 90, size: 96, box: "#3ddc84", ribbon: "#ff3b6b", delay: 1.2 },
];

function Gifts({ onPop, calm }: { onPop: (x: number, y: number) => void; calm: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[160px]">
      {GIFTS.map((g, i) => (
        <Gift key={i} {...g} onPop={onPop} calm={calm} />
      ))}
    </div>
  );
}

function Gift({
  x,
  size,
  box,
  ribbon,
  delay,
  onPop,
  calm,
}: {
  x: number;
  size: number;
  box: string;
  ribbon: string;
  delay: number;
  onPop: (x: number, y: number) => void;
  calm: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [popped, setPopped] = useState(false);
  useEffect(() => {
    if (calm) return;
    const t = setTimeout(() => {
      setPopped(true);
      const r = ref.current?.getBoundingClientRect();
      if (r) onPop(r.left + r.width / 2, r.top + r.height * 0.2);
    }, (delay + 1.3) * 1000);
    return () => clearTimeout(t);
  }, [delay, onPop, calm]);

  return (
    <motion.div
      ref={ref}
      className="absolute bottom-6 hidden sm:block"
      style={{ left: `${x}%`, width: size, height: size, marginLeft: -size / 2 }}
      initial={{ y: 220, rotate: -12 }}
      animate={{ y: 0, rotate: popped ? [0, -6, 5, -3, 0] : 0 }}
      transition={{ y: { delay, type: "spring", stiffness: 170, damping: 13 }, rotate: { duration: 0.6 } }}
    >
      {/* The lid flies off when it pops. */}
      <motion.svg
        viewBox="0 0 100 34"
        className="absolute inset-x-[-6%] top-0 w-[112%] overflow-visible"
        animate={popped ? { y: -size * 1.4, rotate: 38, opacity: 0 } : { y: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      >
        <path d="M50 14 C 38 -6, 18 2, 34 14 Z M50 14 C 62 -6, 82 2, 66 14 Z" fill={ribbon} />
        <rect x="0" y="12" width="100" height="22" rx="4" fill={box} />
        <rect x="0" y="12" width="100" height="22" rx="4" fill="url(#gift-shine)" />
        <rect x="44" y="12" width="12" height="22" fill={ribbon} />
        <defs>
          <linearGradient id="gift-shine" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </motion.svg>
      <svg viewBox="0 0 100 70" className="absolute bottom-0 left-0 w-full">
        <rect x="4" y="0" width="92" height="70" rx="5" fill={box} />
        <rect x="4" y="0" width="92" height="70" rx="5" fill="#000" opacity=".12" />
        <rect x="44" y="0" width="12" height="70" fill={ribbon} />
      </svg>
    </motion.div>
  );
}

/* ----------------------------- Fireworks & confetti ---------------------------- */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
}
interface Paper {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  w: number;
  h: number;
  color: string;
  sway: number;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

class Fireworks {
  private ctx: CanvasRenderingContext2D;
  private sparks: Spark[] = [];
  private rockets: Rocket[] = [];
  private paper: Paper[] = [];
  private raf = 0;
  private started = 0;
  private lastLaunch = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private el: HTMLCanvasElement) {
    this.ctx = el.getContext("2d")!;
    this.resize();
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.el.clientWidth;
    this.h = this.el.clientHeight;
    this.el.width = this.w * this.dpr;
    this.el.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  start() {
    window.addEventListener("resize", this.resize);
    this.started = performance.now();
    // Two confetti cannons from the bottom corners, then a shower from above.
    this.cannon(0, this.h, -1);
    this.cannon(this.w, this.h, 1);
    for (let i = 0; i < 4; i++) this.launch();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
  }

  burst(x: number, y: number, n = 90, color?: string) {
    const base = color ?? pick(COLORS);
    const ring = Math.random() < 0.35;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const speed = ring ? 4.2 : 1 + Math.random() * 4.5;
      const max = 55 + Math.random() * 35;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: max,
        max,
        color: Math.random() < 0.25 ? pick(COLORS) : base,
        size: 1.6 + Math.random() * 1.6,
      });
    }
    // A puff of paper with every burst.
    for (let i = 0; i < 18; i++) this.paper.push(this.piece(x, y, (Math.random() - 0.5) * 9, -Math.random() * 7));
  }

  private launch() {
    this.rockets.push({
      x: this.w * (0.12 + Math.random() * 0.76),
      y: this.h + 10,
      vy: -(9 + Math.random() * 4),
      targetY: this.h * (0.12 + Math.random() * 0.35),
      color: pick(COLORS),
    });
  }

  private piece(x: number, y: number, vx: number, vy: number): Paper {
    return {
      x,
      y,
      vx,
      vy,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      color: pick(COLORS),
      sway: Math.random() * Math.PI * 2,
    };
  }

  private cannon(x: number, y: number, side: number) {
    for (let i = 0; i < 110; i++) {
      const a = -Math.PI / 2 - side * (0.25 + Math.random() * 0.45);
      const s = 12 + Math.random() * 10;
      this.paper.push(this.piece(x, y, Math.cos(a) * s, Math.sin(a) * s));
    }
  }

  private tick = (now: number) => {
    const { ctx, w, h } = this;
    const age = now - this.started;

    // Fade the previous frame instead of clearing, which leaves trails.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    if (age < LENGTH_MS - 2500 && now - this.lastLaunch > 420 + Math.random() * 500) {
      this.launch();
      if (Math.random() < 0.4) this.launch();
      this.lastLaunch = now;
    }
    if (age < LENGTH_MS - 3000 && Math.random() < 0.55) {
      this.paper.push(this.piece(Math.random() * w, -20, (Math.random() - 0.5) * 2, 1 + Math.random() * 2));
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.y += r.vy;
      r.vy *= 0.985;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (r.y <= r.targetY || r.vy > -2) {
        this.burst(r.x, r.y, 100, r.color);
        this.rockets.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.vx *= 0.975;
      s.vy = s.vy * 0.975 + 0.055;
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 1;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      const t = s.life / s.max;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = t < 0.25 && Math.random() < 0.5 ? "#fff" : s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.5 + t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    // Paper is drawn solid, over the glow.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    for (let i = this.paper.length - 1; i >= 0; i--) {
      const p = this.paper[i];
      p.vx *= 0.985;
      p.vy = Math.min(p.vy * 0.985 + 0.22, 3.2);
      p.sway += 0.08;
      p.x += p.vx + Math.sin(p.sway) * 0.8;
      p.y += p.vy;
      p.rot += p.spin;
      if (p.y > h + 30) {
        this.paper.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.sway * 1.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    this.raf = requestAnimationFrame(this.tick);
  };
}
