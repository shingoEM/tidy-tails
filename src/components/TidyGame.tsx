import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Repeat, Volume2, VolumeX } from "lucide-react";
import { frameCamera, render, type Camera } from "@/game/tidy/draw";
import { hold, setHeld } from "@/game/tidy/input";
import { TIME_LIMIT, type Snapshot, TidyWorld } from "@/game/tidy/sim";
import { loadSprites, type SpriteBank } from "@/game/tidy/sprites";

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function pickView(cssW: number, cssH: number) {
  const target = cssW < 760 ? 46 : 68;
  const scale = target / 48;
  return { w: cssW / scale, h: cssH / scale, scale };
}

export function TidyGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<TidyWorld | null>(null);
  const camRef = useRef<Camera>({ x: 40, y: 200, look: 0 });
  const spritesRef = useRef<SpriteBank | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const toastRef = useRef<HTMLParagraphElement | null>(null);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const messRef = useRef<HTMLSpanElement | null>(null);
  const starRef = useRef<HTMLSpanElement | null>(null);
  const roomRef = useRef<HTMLSpanElement | null>(null);
  const sisterRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const world = new TidyWorld();
    worldRef.current = world;
    setSnap(world.snapshot());
    world.onMode = (next) => setSnap({ ...next });

    const qa =
      import.meta.env.DEV ||
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("qa"));
    if (qa) {
      window.__controlsTest = {
        getYaw: () => 0,
        getSpeed: () => Math.abs(world.player.vx),
        getX: () => world.player.x,
        getY: () => world.player.y,
        setKeys: (codes: string[]) => setHeld(codes),
      };
      window.__tidy = {
        teleport: (x: number, y?: number) => world.teleport(x, y),
        snap: () => world.snapshot(),
      };
    }

    let alive = true;
    void loadSprites()
      .then((bank) => {
        if (alive) spritesRef.current = bank;
      })
      .catch(() => {
        /* sprites stay null and the run still plays with flat stand-ins */
      });

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let last = performance.now();
    let acc = 0;
    let raf = 0;

    const frame = (now: number) => {
      if (!alive) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      acc += dt;
      let guard = 0;
      while (acc >= 1 / 60 && guard++ < 5) {
        world.update(1 / 60);
        acc -= 1 / 60;
      }
      const cssW = canvas.clientWidth || 960;
      const cssH = canvas.clientHeight || 540;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.max(1, Math.floor(cssW * dpr));
      const ph = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const view = pickView(cssW, cssH);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#fff6ea";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, 0, 0);
      ctx.imageSmoothingEnabled = true;
      frameCamera(camRef.current, world, view.w, view.h, dt);
      render(ctx, world, spritesRef.current, camRef.current, view.w, view.h);

      const hud = world.snapshot();
      const remain = TIME_LIMIT - hud.elapsed;
      if (timerRef.current) {
        timerRef.current.textContent = remain >= 0 ? formatTime(remain) : `+${formatTime(-remain)}`;
        timerRef.current.dataset.late = remain < 20 ? "1" : "0";
      }
      if (messRef.current) messRef.current.textContent = `${hud.binned}/${hud.total}`;
      if (starRef.current) starRef.current.textContent = `${hud.stars}/${hud.starTotal}`;
      if (roomRef.current) roomRef.current.textContent = hud.room;
      if (sisterRef.current) {
        sisterRef.current.textContent = hud.sister === "sunny" ? "Sunny" : "Pip";
      }
      if (toastRef.current) toastRef.current.textContent = hud.toast;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: KeyboardEvent) => {
      const modeNow = world.mode;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        if (modeNow === "play") world.setMode("pause");
        else if (modeNow === "pause") world.setMode("play");
        return;
      }
      if (e.repeat) return;
      if ((e.code === "Enter" || e.code === "Space") && modeNow === "title") {
        world.audio.unlock();
        world.reset("play");
        return;
      }
      if (modeNow !== "play") return;
      world.audio.unlock();
      hold(e.code, true);
    };
    const up = (e: KeyboardEvent) => hold(e.code, false);
    const blur = () => {
      releaseAll();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      releaseAll();
      if (qa) {
        delete window.__controlsTest;
        delete window.__tidy;
      }
    };
  }, []);

  const mode = snap?.mode ?? "title";

  function start() {
    const world = worldRef.current;
    if (!world) return;
    world.audio.unlock();
    world.reset("play");
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-cream text-ink">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {mode !== "title" && (
        <div className="safe-t pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-paper/90 px-3 py-2 shadow-sm">
            <span ref={sisterRef} className="font-display text-sm font-bold">
              Sunny
            </span>
            <span ref={roomRef} className="text-xs font-extrabold text-ink/70">
              The den
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-paper/90 px-3 py-2 font-display text-lg font-bold shadow-sm">
              <span ref={timerRef}>3:30</span>
            </div>
            <button
              type="button"
              className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-paper text-ink shadow-sm"
              onClick={() => {
                const world = worldRef.current;
                if (!world) return;
                setMuted(world.audio.toggle());
              }}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            {mode === "play" && (
              <button
                type="button"
                className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-ink text-cream shadow-sm"
                onClick={() => worldRef.current?.setMode("pause")}
                aria-label="Pause"
              >
                <Pause className="size-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "play" && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-3">
          <div className="flex gap-2">
            <Chip label="Put away" node={messRef} />
            <Chip label="Stars" node={starRef} />
          </div>
        </div>
      )}

      <p
        ref={toastRef}
        className="pointer-events-none absolute inset-x-4 top-28 text-center font-display text-sm font-bold text-ink"
      />

      {mode === "title" && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-3 sm:inset-y-0 sm:left-4 sm:items-center sm:p-0">
          <section className="safe-b max-h-[68vh] w-full max-w-md overflow-y-auto rounded-2xl bg-paper/95 p-4 shadow-lg">
            <p className="text-xs font-extrabold tracking-widest text-coral">BEFORE THE DOORBELL</p>
            <h1 className="font-display text-4xl font-bold leading-none">Tidy Tails</h1>
            <p className="mt-2 text-sm font-extrabold leading-snug">
              Sunny and little Pip have to tidy the house before Aunt Fern rings. Mom and Dad need both of
              them.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SisterCard name="Sunny" note="Higher hop" src="/sprites/sunny-idle/idle-1.png" />
              <SisterCard name="Pip" note="Faster, fits under the bed" src="/sprites/pip-idle/idle-1.png" />
            </div>
            <p className="mt-3 text-xs font-extrabold text-ink/70">
              Apricot tubs are toys, coral baskets are socks, sky tubs are dishes. Walk in to dunk. A D
              move, Space jump, Q swap, E toss, Down drops through.
            </p>
            {snap?.best.best != null && (
              <p className="mt-2 text-xs font-extrabold text-mint">
                Best {formatTime(snap.best.best)}
                {snap.best.sparkling ? " · Sparkling" : ""} · {snap.best.stars} stars
              </p>
            )}
            <button
              type="button"
              className="mt-4 h-12 w-full rounded-full bg-coral font-display text-lg font-bold text-cream"
              onClick={start}
            >
              Start tidying
            </button>
          </section>
        </div>
      )}

      {mode === "pause" && (
        <Overlay>
          <h2 className="font-display text-3xl font-bold">Paused</h2>
          <p className="text-sm font-extrabold">Aunt Fern is still on the way.</p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-full bg-coral font-display text-lg font-bold text-cream"
            onClick={() => worldRef.current?.setMode("play")}
          >
            Keep going
          </button>
          <button
            type="button"
            className="mt-2 h-12 w-full rounded-full bg-butter font-display text-lg font-bold text-ink"
            onClick={() => worldRef.current?.reset("play")}
          >
            Restart the house
          </button>
        </Overlay>
      )}

      {mode === "win" && snap && (
        <Overlay>
          <p className="text-xs font-extrabold tracking-widest text-coral">{snap.rank.toUpperCase()}</p>
          <h2 className="font-display text-3xl font-bold leading-none">The bell rings</h2>
          <p className="mt-2 text-sm font-extrabold leading-snug">
            Mom and Dad open the door. Aunt Fern walks into a house the sisters actually finished.
          </p>
          <p className="mt-2 font-display text-lg font-bold">
            {formatTime(snap.elapsed)} · {snap.stars}/{snap.starTotal} stars
          </p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-full bg-coral font-display text-lg font-bold text-cream"
            onClick={() => worldRef.current?.reset("play")}
          >
            Tidy it again
          </button>
        </Overlay>
      )}

      {mode === "play" && <TouchDock />}
    </div>
  );
}

function Chip({ label, node }: { label: string; node: RefObject<HTMLSpanElement | null> }) {
  return (
    <span className="rounded-full bg-paper/90 px-3 py-1 text-xs font-extrabold shadow-sm">
      {label} <span ref={node}>0</span>
    </span>
  );
}

function SisterCard({ name, note, src }: { name: string; note: string; src: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-cream p-2">
      <img src={src} alt="" className="h-14 w-14 object-contain" draggable={false} />
      <div>
        <p className="font-display text-sm font-bold">{name}</p>
        <p className="text-xs font-extrabold text-ink/70">{note}</p>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-end justify-center bg-ink/25 p-3 sm:items-center">
      <section className="safe-b w-full max-w-md rounded-2xl bg-paper p-5 shadow-lg">{children}</section>
    </div>
  );
}

function TouchDock() {
  return (
    <div className="touch-dock safe-b pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
      <div className="pointer-events-auto flex gap-2">
        <Pad code="TouchLeft" label="Left">
          <ArrowLeft className="size-6" />
        </Pad>
        <Pad code="TouchRight" label="Right">
          <ArrowRight className="size-6" />
        </Pad>
      </div>
      <div className="pointer-events-auto flex items-end gap-2">
        <Pad code="TouchDown" label="Drop">
          <ArrowDown className="size-5" />
        </Pad>
        <Pad code="TouchSwap" label="Swap">
          <Repeat className="size-5" />
        </Pad>
        <Pad code="TouchGrab" label="Toss">
          <span className="font-display text-sm font-bold">Toss</span>
        </Pad>
        <Pad code="TouchJump" label="Jump" big>
          <ArrowUp className="size-7" />
        </Pad>
      </div>
    </div>
  );
}

function Pad({
  code,
  label,
  big,
  children,
}: {
  code: string;
  label: string;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={
        big
          ? "grid h-16 w-16 place-items-center rounded-full bg-coral text-cream shadow-md"
          : "grid h-14 min-w-14 place-items-center rounded-full bg-paper text-ink shadow-md"
      }
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(code, true);
      }}
      onPointerUp={() => hold(code, false)}
      onPointerCancel={() => hold(code, false)}
      onLostPointerCapture={() => hold(code, false)}
    >
      {children}
    </button>
  );
}

function releaseAll() {
  setHeld([]);
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
    };
    __tidy?: {
      teleport: (x: number, y?: number) => void;
      snap: () => Snapshot;
    };
  }
}
