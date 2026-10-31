import { createAudio, type AudioBus } from "./audio";
import {
  anyHeld,
  DOWN_KEYS,
  GRAB_KEYS,
  JUMP_KEYS,
  LEFT_KEYS,
  RIGHT_KEYS,
  SWAP_KEYS,
} from "./input";
import {
  createLevel,
  DEATH_Y,
  FLOOR,
  hit,
  PHYS,
  roomName,
  STATS,
  TIME_LIMIT,
  WORLD_H,
  WORLD_W,
  type Bin,
  type Checkpoint,
  type Hazard,
  type Item,
  type ItemKind,
  type Level,
  type Rect,
  type SisterId,
  type Solid,
  type Star,
} from "./level";

export type Mode = "title" | "play" | "pause" | "win";

export type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  r: number;
};

export type Save = { v: 1; best: number | null; stars: number; sparkling: boolean };

export type Snapshot = {
  mode: Mode;
  elapsed: number;
  limit: number;
  binned: number;
  total: number;
  stars: number;
  starTotal: number;
  sister: SisterId;
  room: string;
  toast: string;
  rank: string;
  best: Save;
  muted: boolean;
};

const SAVE_KEY = "tidy-tails-save-v1";

export type SisterBody = {
  sister: SisterId;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  onIce: boolean;
  groundId: string | null;
  groundKind: string | null;
  coyote: number;
  buffer: number;
  drop: number;
  jumpHold: boolean;
  anim: number;
  carried: string | null;
  cp: number;
  invuln: number;
  knock: number;
};

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { v: 1, best: null, stars: 0, sparkling: false };
    const parsed = JSON.parse(raw) as Save;
    if (parsed.v !== 1) return { v: 1, best: null, stars: 0, sparkling: false };
    return parsed;
  } catch {
    return { v: 1, best: null, stars: 0, sparkling: false };
  }
}

export class TidyWorld {
  mode: Mode = "title";
  level: Level;
  solids: Solid[];
  items: Item[];
  bins: Bin[];
  stars: Star[];
  checkpoints: Checkpoint[];
  hazards: Hazard[];
  goal: Rect;
  player: SisterBody;
  follow: { x: number; y: number; facing: 1 | -1; anim: number };
  time = 0;
  elapsed = 0;
  toast = "";
  toastT = 0;
  nopeT = 0;
  bits: Bit[] = [];
  shake = 0;
  crumble: Record<string, number> = {};
  goneUntil: Record<string, number> = {};
  audio: AudioBus;
  best: Save;
  hinted = { swap: false, ice: false, crawl: false, crumble: false, pit: false };
  onMode?: (snap: Snapshot) => void;
  private prevJump = false;
  private prevGrab = false;
  private prevSwap = false;
  private reduced = false;

  constructor() {
    this.level = createLevel();
    this.solids = this.level.solids;
    this.items = this.level.items;
    this.bins = this.level.bins;
    this.stars = this.level.stars;
    this.checkpoints = this.level.checkpoints;
    this.hazards = this.level.hazards;
    this.goal = this.level.goal;
    this.audio = createAudio();
    this.best = { v: 1, best: null, stars: 0, sparkling: false };
    this.player = this.makePlayer("sunny");
    this.follow = { x: this.player.x - 50, y: this.player.y + 18, facing: 1, anim: 0 };
    if (typeof window !== "undefined") {
      this.best = loadSave();
      this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    }
  }

  private makePlayer(sister: SisterId): SisterBody {
    const s = STATS[sister];
    return {
      sister,
      x: this.level.spawn.x,
      y: this.level.spawn.y - s.h,
      w: s.w,
      h: s.h,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      onIce: false,
      groundId: "f-den",
      groundKind: "solid",
      coyote: PHYS.coyote,
      buffer: 0,
      drop: 0,
      jumpHold: false,
      anim: 0,
      carried: null,
      cp: 0,
      invuln: 0,
      knock: 0,
    };
  }

  reset(mode: Mode) {
    const fresh = createLevel();
    this.level = fresh;
    this.solids = fresh.solids;
    this.items = fresh.items;
    this.bins = fresh.bins;
    this.stars = fresh.stars;
    this.checkpoints = fresh.checkpoints;
    this.hazards = fresh.hazards;
    this.goal = fresh.goal;
    this.player = this.makePlayer("sunny");
    this.follow = { x: this.player.x - 50, y: this.player.y + 18, facing: 1, anim: 0 };
    this.time = 0;
    this.elapsed = 0;
    this.toast = "";
    this.toastT = 0;
    this.bits = [];
    this.shake = 0;
    this.crumble = {};
    this.goneUntil = {};
    this.hinted = { swap: false, ice: false, crawl: false, crumble: false, pit: false };
    this.setMode(mode);
    if (mode === "play") {
      this.say("Match the mess: apricot toys, coral socks, sky dishes.");
    }
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.onMode?.(this.snapshot());
  }

  say(text: string) {
    this.toast = text;
    this.toastT = 3.4;
  }

  snapshot(): Snapshot {
    const binned = this.items.filter((it) => it.state === "binned").length;
    const stars = this.stars.filter((s) => s.got).length;
    return {
      mode: this.mode,
      elapsed: this.elapsed,
      limit: TIME_LIMIT,
      binned,
      total: this.items.length,
      stars,
      starTotal: this.stars.length,
      sister: this.player.sister,
      room: roomName(this.player.x),
      toast: this.toastT > 0 ? this.toast : "",
      rank: this.rank(stars),
      best: this.best,
      muted: this.audio.muted,
    };
  }

  rank(stars = this.stars.filter((s) => s.got).length) {
    const overtime = this.elapsed > TIME_LIMIT;
    if (!overtime && stars === this.stars.length) return "Sparkling";
    if (!overtime) return "Tidy";
    return "Down to the wire";
  }

  private saveScore() {
    const stars = this.stars.filter((s) => s.got).length;
    const sparkling = this.elapsed <= TIME_LIMIT && stars === this.stars.length;
    const best =
      this.best.best == null ? this.elapsed : Math.min(this.best.best, this.elapsed);
    this.best = {
      v: 1,
      best,
      stars: Math.max(this.best.stars, stars),
      sparkling: this.best.sparkling || sparkling,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.best));
    } catch {
      /* ignore quota */
    }
  }

  burst(x: number, y: number, color: string, n = 8) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 40 + Math.random() * 90;
      this.bits.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        color,
        r: 2 + Math.random() * 2.5,
      });
    }
    if (this.bits.length > 80) this.bits.splice(0, this.bits.length - 80);
  }

  update(dt: number) {
    this.time += dt;
    this.syncMovers(dt);
    if (this.mode !== "play") {
      this.player.anim += dt;
      this.follow.anim += dt;
      this.fadeToast(dt);
      this.stepBits(dt);
      return;
    }
    this.elapsed += dt;
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.player.drop = Math.max(0, this.player.drop - dt);
    this.fadeToast(dt);
    this.readInput(dt);
    if (this.mode !== "play") return;
    this.stepBody(dt);
    this.stepItems(dt);
    this.stepHazards();
    this.stepPickups();
    this.stepStars();
    this.stepCrumble(dt);
    this.stepGoal();
    this.stepCheckpoints();
    this.stepHints();
    if (this.player.y > DEATH_Y) this.respawn();
    this.stepFollow(dt);
    this.stepBits(dt);
    const speed = Math.hypot(this.player.vx, this.player.vy);
    const rate = this.player.grounded && Math.abs(this.player.vx) > 30 ? 12 : 6;
    this.player.anim += dt * (speed > 20 ? rate / 6 : 1);
    this.audio.music(true);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  private fadeToast(dt: number) {
    if (this.toastT > 0) this.toastT -= dt;
    if (this.nopeT > 0) this.nopeT -= dt;
  }

  private stepBits(dt: number) {
    for (const b of this.bits) {
      b.life -= dt;
      b.vy += 500 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
  }

  private syncMovers(dt: number) {
    const p = this.player;
    let carryX = 0;
    let carryY = 0;
    for (const s of this.solids) {
      if (!s.move) {
        s.x = s.baseX;
        s.y = s.baseY;
        continue;
      }
      const prevX = s.x;
      const prevY = s.y;
      const shift = Math.sin(this.time * s.move.speed) * s.move.amp;
      s.x = s.baseX + shift;
      s.y = s.baseY;
      if (p.groundId === s.id) {
        carryX += s.x - prevX;
        carryY += s.y - prevY;
      }
    }
    if (this.mode === "play") {
      p.x += carryX;
      p.y += carryY;
    }
    for (const it of this.items) {
      if (it.state !== "idle" || !it.ride) continue;
      const s = this.solids.find((sl) => sl.id === it.ride);
      if (!s) continue;
      it.x = s.x + (it.rideOx ?? 0);
      it.y = s.y + (it.rideOy ?? 0) - it.h;
    }
    for (const star of this.stars) {
      if (!star.ride || star.got) continue;
      const s = this.solids.find((sl) => sl.id === star.ride);
      if (!s) continue;
      star.x = s.x + (star.rideOx ?? 0);
      star.y = s.y + (star.rideOy ?? 0);
    }
    void dt;
  }

  private readInput(dt: number) {
    const p = this.player;
    const jump = anyHeld(JUMP_KEYS);
    const down = anyHeld(DOWN_KEYS);
    const grab = anyHeld(GRAB_KEYS);
    const swap = anyHeld(SWAP_KEYS);
    const jumpEdge = jump && !this.prevJump;
    const grabEdge = grab && !this.prevGrab;
    const swapEdge = swap && !this.prevSwap;
    this.prevJump = jump;
    this.prevGrab = grab;
    this.prevSwap = swap;

    if (swapEdge) this.trySwap();

    let wish = 0;
    if (anyHeld(LEFT_KEYS)) wish -= 1;
    if (anyHeld(RIGHT_KEYS)) wish += 1;
    if (wish !== 0) p.facing = wish > 0 ? 1 : -1;

    const stats = STATS[p.sister];
    const ice = p.grounded && p.onIce;
    const accel = p.grounded ? (ice ? stats.accel * 0.4 : stats.accel) : stats.air;
    const fric = p.grounded ? (ice ? 320 : stats.fric) : 140;
    const max = stats.max * (p.carried ? 0.9 : 1);
    if (wish !== 0) p.vx += wish * accel * dt;
    else {
      const d = fric * dt;
      if (Math.abs(p.vx) <= d) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * d;
    }
    if (p.vx > max) p.vx = max;
    if (p.vx < -max) p.vx = -max;

    if (jumpEdge) p.buffer = PHYS.buffer;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.grounded) p.coyote = PHYS.coyote;
    else p.coyote = Math.max(0, p.coyote - dt);

    const dropping =
      down &&
      p.grounded &&
      (p.groundKind === "oneway" || p.groundKind === "crumble" || p.groundKind === "crawl");
    if (dropping) {
      p.drop = 0.18;
      p.grounded = false;
      p.groundId = null;
      p.y += 4;
      p.vy = 40;
      p.coyote = 0;
    } else if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -stats.jump;
      p.grounded = false;
      p.groundId = null;
      p.onIce = false;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpHold = true;
      this.audio.jump();
      this.burst(p.x + p.w / 2, p.y + p.h, "#ffe08a", 5);
    }
    if (!jump && p.vy < 0 && p.jumpHold) {
      p.vy *= 0.5;
      p.jumpHold = false;
    }

    if (grabEdge) this.tossOrDrop();
  }

  private trySwap() {
    const p = this.player;
    const next: SisterId = p.sister === "sunny" ? "pip" : "sunny";
    const s = STATS[next];
    const nx = p.x + (p.w - s.w) / 2;
    const ny = p.y + p.h - s.h;
    if (this.blocked(nx, ny, s.w, s.h, next)) {
      this.say(next === "sunny" ? "Too snug for Sunny." : "Pip can't squeeze in there.");
      this.audio.nope();
      return;
    }
    p.sister = next;
    p.x = nx;
    p.y = ny;
    p.w = s.w;
    p.h = s.h;
    this.audio.swap();
    this.burst(p.x + p.w / 2, p.y + p.h / 2, next === "sunny" ? "#f4a261" : "#c4844a", 8);
  }

  private tossOrDrop() {
    const p = this.player;
    if (!p.carried) return;
    const it = this.items.find((item) => item.id === p.carried);
    if (!it) return;
    it.state = "toss";
    it.vx = p.facing * 380 + p.vx * 0.25;
    it.vy = -340;
    it.x = p.x + p.w / 2 - it.w / 2 + p.facing * 8;
    it.y = p.y - it.h;
    p.carried = null;
    this.audio.toss();
  }

  private blocked(x: number, y: number, w: number, h: number, sister: SisterId) {
    const box = { x, y, w, h };
    for (const s of this.solids) {
      if (this.ignored(s)) continue;
      if (s.kind === "oneway" || s.kind === "crumble" || s.kind === "bounce") continue;
      if (s.pass === "pip" && sister === "pip") continue;
      if (hit(box, s)) return true;
    }
    return false;
  }

  private ignored(s: Solid) {
    return (this.goneUntil[s.id] ?? 0) > this.time;
  }

  private stepBody(dt: number) {
    const p = this.player;
    for (const hz of this.hazards) {
      if (hz.kind !== "fan") continue;
      if (hit(p, hz)) p.vx += hz.dir * hz.force * dt;
    }
    const rising = p.vy < 0 && Math.abs(p.vy) < PHYS.apex;
    const g = rising ? PHYS.gApex : p.vy < 0 ? PHYS.gRise : PHYS.gFall;
    p.vy += g * dt;
    if (p.vy > PHYS.terminal) p.vy = PHYS.terminal;

    const dist = Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt;
    const steps = Math.max(1, Math.ceil(dist / 6));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      p.x += p.vx * sdt;
      this.resolveX();
      const prevY = p.y;
      p.y += p.vy * sdt;
      this.resolveY(prevY);
    }
    if (p.x < 0) {
      p.x = 0;
      p.vx = 0;
    }
    if (p.x + p.w > WORLD_W) {
      p.x = WORLD_W - p.w;
      p.vx = 0;
    }
  }

  private resolveX() {
    const p = this.player;
    for (const s of this.solids) {
      if (this.ignored(s)) continue;
      if (s.kind === "oneway" || s.kind === "crumble") continue;
      if (s.pass === "pip" && p.sister === "pip") continue;
      if (!hit(p, s)) continue;
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      else if (p.x + p.w / 2 < s.x + s.w / 2) p.x = s.x - p.w;
      else p.x = s.x + s.w;
      p.vx = 0;
    }
  }

  private resolveY(prevY: number) {
    const p = this.player;
    let landed = false;
    const prevBottom = prevY + p.h;
    const list = this.solids.slice().sort((a, b) => a.y - b.y);
    for (const s of list) {
      if (this.ignored(s)) continue;
      if (!hit(p, s)) continue;
      const pipSoft = s.pass === "pip" && p.sister === "pip";
      const one = s.kind === "oneway" || s.kind === "crumble" || pipSoft;
      if (one) {
        if (p.drop > 0) continue;
        if (p.vy < 0) continue;
        if (prevBottom > s.y + 4) continue;
        p.y = s.y - p.h;
        this.land(s);
        landed = true;
        continue;
      }
      if (p.vy >= 0 && prevBottom <= s.y + 8) {
        p.y = s.y - p.h;
        this.land(s);
        landed = true;
      } else if (p.vy < 0 && prevY >= s.y + s.h - 8) {
        p.y = s.y + s.h;
        p.vy = 0;
        p.jumpHold = false;
      } else if (p.vy >= 0 && p.y + p.h - s.y < s.h) {
        p.y = s.y - p.h;
        this.land(s);
        landed = true;
      }
    }
    if (!landed && p.vy !== 0) {
      /* stays airborne if nothing caught the feet */
    }
    if (!landed) {
      const stillOn = p.groundId
        ? this.solids.find((s) => s.id === p.groundId)
        : undefined;
      const feet = p.y + p.h;
      const supported =
        stillOn &&
        !this.ignored(stillOn) &&
        feet >= stillOn.y - 2 &&
        feet <= stillOn.y + 6 &&
        p.x + p.w > stillOn.x + 2 &&
        p.x < stillOn.x + stillOn.w - 2 &&
        p.vy >= 0;
      p.grounded = Boolean(supported);
      if (!p.grounded) {
        p.groundId = null;
        p.onIce = false;
      }
    }
  }

  private land(s: Solid) {
    const p = this.player;
    if (s.kind === "bounce") {
      const power = STATS[p.sister].bounce;
      const incoming = Math.abs(p.vy);
      p.vy = -Math.max(power, incoming * 0.55);
      p.grounded = false;
      p.groundId = null;
      p.groundKind = "bounce";
      p.onIce = false;
      p.coyote = 0;
      p.jumpHold = false;
      this.shake = Math.max(this.shake, this.reduced ? 0 : 0.15);
      this.audio.jump();
      this.burst(p.x + p.w / 2, p.y + p.h, "#ffe08a", 7);
      return;
    }
    const impact = p.vy;
    p.vy = 0;
    p.grounded = true;
    p.groundId = s.id;
    p.groundKind = s.pass === "pip" ? "crawl" : s.kind;
    p.onIce = s.kind === "ice";
    if (impact > 520) this.burst(p.x + p.w / 2, p.y + p.h, "#e7b56a", 4);
  }

  private stepItems(dt: number) {
    for (const it of this.items) {
      if (it.state === "carried") {
        const p = this.player;
        it.x = p.x + p.w / 2 - it.w / 2;
        it.y = p.y - it.h - 8;
        it.vx = 0;
        it.vy = 0;
        continue;
      }
      if (it.state !== "toss") continue;
      it.vy += 1500 * dt;
      if (it.vy > 800) it.vy = 800;
      const prevY = it.y;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.vx *= Math.pow(0.2, dt);
      let grounded = false;
      for (const s of this.solids) {
        if (this.ignored(s)) continue;
        if (s.kind === "bounce") continue;
        if (!hit(it, s)) continue;
        const one = s.kind === "oneway" || s.kind === "crumble" || s.pass === "pip";
        if (one) {
          if (it.vy < 0 || prevY + it.h > s.y + 4) continue;
        }
        if (it.vy >= 0 && prevY + it.h <= s.y + 10) {
          it.y = s.y - it.h;
          it.vy = 0;
          it.vx *= 0.5;
          grounded = true;
        }
      }
      if (it.y > DEATH_Y) {
        this.returnHome(it);
        continue;
      }
      if (grounded && Math.abs(it.vx) < 30) {
        it.state = "idle";
        it.vx = 0;
        it.homeX = it.x;
        it.homeY = it.y;
      }
      this.tryBin(it);
    }
    if (this.player.carried) {
      const it = this.items.find((item) => item.id === this.player.carried);
      if (it) this.tryBin(it);
    }
  }

  private tryBin(it: Item) {
    if (it.state === "binned") return;
    for (const bin of this.bins) {
      const mouth = { x: bin.x - 8, y: bin.y - 16, w: bin.w + 16, h: bin.h + 20 };
      const probe = it.state === "carried" ? this.player : it;
      if (!hit(probe, mouth)) continue;
      if (bin.kind !== it.kind) {
        if (this.nopeT <= 0) {
          this.say(wrongBin(bin.kind));
          this.audio.nope();
          this.nopeT = 0.8;
        }
        if (it.state === "toss") {
          it.vx *= -1;
          it.x += Math.sign(it.vx || 1) * 8;
        }
        return;
      }
      it.state = "binned";
      it.vx = 0;
      it.vy = 0;
      it.x = bin.x + bin.w / 2 - it.w / 2;
      it.y = bin.y - 6;
      if (this.player.carried === it.id) this.player.carried = null;
      bin.pop = 1;
      this.audio.bin();
      this.burst(bin.x + bin.w / 2, bin.y, kindColor(it.kind), 12);
      this.shake = Math.max(this.shake, this.reduced ? 0 : 0.12);
      const left = this.items.filter((item) => item.state !== "binned").length;
      if (left === 0) this.say("That's everything. Race the bell to the porch door.");
      else if (!this.hinted.swap) {
        this.hinted.swap = true;
        this.say("Q swaps sisters. Sunny jumps higher. Pip is quicker and smaller.");
      }
      return;
    }
  }

  private stepPickups() {
    const p = this.player;
    if (p.carried) return;
    for (const it of this.items) {
      if (it.state !== "idle") continue;
      const near = { x: it.x - 8, y: it.y - 8, w: it.w + 16, h: it.h + 16 };
      if (!hit(p, near)) continue;
      it.state = "carried";
      p.carried = it.id;
      this.audio.pickup();
      return;
    }
  }

  private stepStars() {
    const p = this.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    for (const star of this.stars) {
      if (star.got) continue;
      const dx = cx - star.x;
      const dy = cy - star.y;
      if (dx * dx + dy * dy < 36 * 36) {
        star.got = true;
        this.audio.star();
        this.burst(star.x, star.y, "#ffe08a", 10);
        const n = this.stars.filter((s) => s.got).length;
        this.say(`Star sticker ${n} of ${this.stars.length}.`);
      }
    }
  }

  private stepCrumble(dt: number) {
    const p = this.player;
    for (const s of this.solids) {
      if (s.kind !== "crumble") continue;
      if (p.groundId === s.id) this.crumble[s.id] = (this.crumble[s.id] ?? 0) + dt;
      else if ((this.goneUntil[s.id] ?? 0) <= this.time) {
        this.crumble[s.id] = Math.max(0, (this.crumble[s.id] ?? 0) - dt * 2);
      }
      if ((this.crumble[s.id] ?? 0) > 0.42 && (this.goneUntil[s.id] ?? 0) <= this.time) {
        this.goneUntil[s.id] = this.time + 2.4;
        this.crumble[s.id] = 0;
        if (p.groundId === s.id) {
          p.grounded = false;
          p.groundId = null;
          p.vy = 40;
        }
        this.burst(s.x + s.w / 2, s.y, "#e7b56a", 6);
      }
    }
    for (const bin of this.bins) bin.pop = Math.max(0, bin.pop - dt * 2.4);
  }

  private stepHazards() {
    const p = this.player;
    if (p.invuln > 0) return;
    for (const hz of this.hazards) {
      if (hz.kind !== "swing") continue;
      const ang = Math.sin((this.time / hz.period) * Math.PI * 2) * 0.95;
      const hx = hz.x + Math.sin(ang) * hz.len;
      const hy = hz.y + Math.cos(ang) * hz.len;
      const dx = p.x + p.w / 2 - hx;
      const dy = p.y + p.h / 2 - hy;
      const reach = hz.radius + Math.max(p.w, p.h) * 0.35;
      if (dx * dx + dy * dy < reach * reach) {
        p.vx = Math.sign(dx || 1) * 340;
        p.vy = -280;
        p.grounded = false;
        p.groundId = null;
        p.invuln = 0.45;
        p.jumpHold = false;
        this.audio.whoops();
        this.shake = Math.max(this.shake, this.reduced ? 0 : 0.18);
      }
    }
  }

  private stepGoal() {
    if (!hit(this.player, this.goal)) return;
    const left = this.items.filter((it) => it.state !== "binned").length;
    if (left > 0) {
      if (this.nopeT <= 0) {
        this.say(`${left} still out of place. The door stays shut.`);
        this.nopeT = 1.2;
      }
      return;
    }
    this.audio.win();
    this.saveScore();
    this.setMode("win");
  }

  private stepCheckpoints() {
    const p = this.player;
    if (!p.grounded) return;
    for (let i = this.checkpoints.length - 1; i >= 0; i--) {
      const c = this.checkpoints[i];
      if (!c) continue;
      if (Math.abs(p.x + p.w / 2 - c.x) < 80 && Math.abs(p.y + p.h - c.y) < 18) {
        p.cp = i;
        break;
      }
    }
  }

  private stepHints() {
    const p = this.player;
    if (!this.hinted.ice && p.onIce) {
      this.hinted.ice = true;
      this.say("Kitchen tiles are slippery. Don't sprint at the gap.");
    }
    if (!this.hinted.crawl && p.sister === "sunny" && p.x > 5300 && p.x < 5700) {
      this.hinted.crawl = true;
      this.say("Under the bed is Pip-sized. Swap with Q.");
    }
    if (!this.hinted.crumble && p.x > 6000 && p.x < 6400) {
      this.hinted.crumble = true;
      this.say("Cookie plates crumble. Keep hopping.");
    }
  }

  private respawn() {
    const p = this.player;
    const cp = this.checkpoints[p.cp] ?? this.checkpoints[0];
    if (!cp) return;
    p.x = cp.x;
    p.y = cp.y - p.h;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.invuln = 0.4;
    if (p.carried) {
      const it = this.items.find((item) => item.id === p.carried);
      if (it) this.returnHome(it);
      p.carried = null;
    }
    this.audio.whoops();
    this.shake = Math.max(this.shake, this.reduced ? 0 : 0.2);
    this.say("Whoops. Back to the last safe rug.");
  }

  private returnHome(it: Item) {
    it.state = "idle";
    it.x = it.homeX;
    it.y = it.homeY;
    it.vx = 0;
    it.vy = 0;
  }

  private stepFollow(dt: number) {
    const p = this.player;
    const other: SisterId = p.sister === "sunny" ? "pip" : "sunny";
    const s = STATS[other];
    const desiredX = p.x - p.facing * (s.w + 16);
    const desiredY = p.y + p.h - s.h;
    const blocked = this.blocked(desiredX, desiredY, s.w, s.h, other);
    const k = 1 - Math.exp(-7 * dt);
    if (!blocked) {
      this.follow.x += (desiredX - this.follow.x) * k;
      this.follow.y += (desiredY - this.follow.y) * k;
    }
    this.follow.facing = p.facing;
    this.follow.anim += dt * 8;
  }

  teleport(x: number, feetY = FLOOR) {
    const p = this.player;
    p.x = x;
    p.y = feetY - p.h;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
  }
}

function kindColor(kind: ItemKind) {
  if (kind === "toy") return "#f4a261";
  if (kind === "sock") return "#e76f51";
  return "#3aa0c8";
}

function wrongBin(kind: ItemKind) {
  if (kind === "toy") return "That tub wants toys.";
  if (kind === "sock") return "That basket wants socks.";
  return "That tub wants dishes.";
}

export { TIME_LIMIT, WORLD_W, WORLD_H, FLOOR };
