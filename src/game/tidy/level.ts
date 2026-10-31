export type SisterId = "sunny" | "pip";
export type ItemKind = "toy" | "sock" | "dish";
export type SolidKind = "solid" | "oneway" | "ice" | "bounce" | "crumble";

export type Rect = { x: number; y: number; w: number; h: number };

export type Solid = Rect & {
  id: string;
  kind: SolidKind;
  look: string;
  pass?: "pip";
  move?: { amp: number; speed: number };
  baseX: number;
  baseY: number;
};

export type Item = Rect & {
  id: string;
  kind: ItemKind;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  state: "idle" | "carried" | "toss" | "binned";
  ride?: string;
  rideOx?: number;
  rideOy?: number;
};

export type Bin = Rect & { id: string; kind: ItemKind; pop: number };
export type Star = {
  id: string;
  x: number;
  y: number;
  got: boolean;
  ride?: string;
  rideOx?: number;
  rideOy?: number;
};
export type Checkpoint = { id: string; x: number; y: number };
export type Hazard =
  | { kind: "swing"; x: number; y: number; len: number; period: number; radius: number }
  | { kind: "fan"; x: number; y: number; w: number; h: number; force: number; dir: 1 | -1 };

export const FLOOR = 732;
export const WORLD_W = 7100;
export const WORLD_H = 920;
export const DEATH_Y = 860;
export const TIME_LIMIT = 210;

export const PHYS = {
  gRise: 1280,
  gFall: 2720,
  gApex: 560,
  apex: 140,
  terminal: 980,
  coyote: 0.11,
  buffer: 0.13,
};

export const STATS: Record<
  SisterId,
  { w: number; h: number; accel: number; max: number; air: number; fric: number; jump: number; bounce: number }
> = {
  sunny: { w: 36, h: 48, accel: 2200, max: 270, air: 1550, fric: 1900, jump: 655, bounce: 880 },
  pip: { w: 28, h: 30, accel: 2600, max: 325, air: 1750, fric: 2100, jump: 510, bounce: 940 },
};

const IW = 28;
const IH = 28;

function solid(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: SolidKind,
  look: string,
  extra?: Partial<Solid>,
): Solid {
  return { id, x, y, w, h, kind, look, baseX: x, baseY: y, ...extra };
}

function item(
  id: string,
  kind: ItemKind,
  x: number,
  y: number,
  extra?: Partial<Item>,
): Item {
  return {
    id,
    kind,
    x,
    y,
    w: IW,
    h: IH,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
    state: "idle",
    ...extra,
  };
}

export type Level = {
  solids: Solid[];
  items: Item[];
  bins: Bin[];
  stars: Star[];
  checkpoints: Checkpoint[];
  hazards: Hazard[];
  goal: Rect;
  mom: { x: number; y: number };
  dad: { x: number; y: number };
  spawn: { x: number; y: number };
};

export function roomName(x: number) {
  if (x < 1580) return "The den";
  if (x < 3340) return "Stair hall";
  if (x < 4560) return "Kitchen";
  return "Bedroom porch";
}

export function createLevel(): Level {
  const F = FLOOR;
  const landEnd = 2920;
  const kitStart = 3340;
  const pw = 128;
  const xMin = landEnd - 40;
  const xMax = kitStart - pw + 48;
  const basketBase = (xMin + xMax) / 2;
  const basketAmp = (xMax - xMin) / 2;

  const solids: Solid[] = [
    solid("f-den", -40, F, 1620, 200, "solid", "floor"),
    solid("ottoman", 500, F - 50, 96, 50, "solid", "ottoman"),
    solid("sofa", 660, F - 82, 230, 82, "solid", "sofa"),
    solid("table", 960, F - 54, 150, 54, "solid", "table"),
    solid("chair", 1280, F - 70, 130, 70, "solid", "chair"),
    solid("sh-mid", 690, 588, 160, 14, "oneway", "shelf"),
    solid("sh-high", 700, 508, 150, 14, "oneway", "shelf"),
    solid("ledge", 980, 430, 120, 14, "oneway", "ledge"),

    solid("f-hall", 1760, F, 400, 200, "solid", "floor"),
    solid("step1", 2160, F - 64, 124, 64, "solid", "step"),
    solid("step2", 2284, F - 128, 124, 128, "solid", "step"),
    solid("step3", 2408, F - 192, 124, 192, "solid", "step"),
    solid("landing", 2532, F - 256, 388, 256, "solid", "landing"),
    solid("basket", basketBase, F - 256, pw, 16, "oneway", "basket", {
      move: { amp: basketAmp, speed: 1.15 },
    }),

    solid("f-kit", kitStart, F, 860, 200, "ice", "tile"),
    solid("c1", 3480, F - 130, 180, 14, "oneway", "counter"),
    solid("c2", 3720, F - 168, 170, 14, "oneway", "counter"),
    solid("c3", 3960, F - 120, 190, 14, "oneway", "counter"),
    solid("fridge", 4180, F - 200, 96, 14, "oneway", "fridge"),
    solid("bounce", 3568, F - 34, 84, 34, "bounce", "cushion"),
    solid("highdish", 3520, F - 300, 170, 14, "oneway", "shelf"),
    solid("grip", 4200, F, 180, 200, "solid", "grip"),

    solid("f-bed", 4560, F, 1500, 200, "solid", "floor"),
    solid("bed", 4700, F - 78, 240, 78, "solid", "bed"),
    solid("tramp", 5020, F - 32, 88, 32, "bounce", "cushion"),
    solid("dresser", 5180, F - 150, 140, 14, "oneway", "dresser"),
    solid("crawl", 5380, F - 92, 300, 56, "solid", "crawl", { pass: "pip" }),
    solid("b1", 5760, F - 52, 74, 52, "solid", "books"),
    solid("b2", 5850, F - 112, 74, 112, "solid", "books"),
    solid("b3", 5940, F - 176, 82, 176, "solid", "books"),
    solid("cr1", 6160, F - 52, 90, 14, "crumble", "crumble"),
    solid("cr2", 6300, F - 120, 90, 14, "crumble", "crumble"),
    solid("porch", 6480, F - 184, 560, 384, "solid", "porch"),
  ];

  const on = (surfaceTop: number, x: number) => surfaceTop - IH;

  const items: Item[] = [
    item("toy-sofa", "toy", 740, on(F - 82, 740)),
    item("toy-floor", "toy", 1168, on(F, 1168)),
    item("sock-den", "sock", 1510, on(F, 1510)),
    item("dish-den", "dish", 760, on(508, 760)),
    item("sock-step", "sock", 2320, on(F - 128, 2320)),
    item("sock-land", "sock", 2700, on(F - 256, 2700)),
    item("dish-counter", "dish", 3760, on(F - 168, 3760)),
    item("dish-high", "dish", 3580, on(F - 300, 3580)),
    item("sock-fan", "sock", 3900, on(F, 3900)),
    item("toy-crawl", "toy", 5520, on(F, 5520)),
    item("toy-bed", "toy", 4780, on(F - 78, 4780)),
    item("sock-books", "sock", 5964, on(F - 176, 5964)),
  ];

  const bin = (id: string, kind: ItemKind, x: number, top: number): Bin => ({
    id,
    kind,
    x,
    y: top - 58,
    w: 86,
    h: 58,
    pop: 0,
  });

  const bins: Bin[] = [
    bin("bin-toy-den", "toy", 70, F),
    bin("bin-sock-den", "sock", 1180, F),
    bin("bin-dish-den", "dish", 1460, F),
    bin("bin-sock-hall", "sock", 2740, F - 256),
    bin("bin-dish-kit", "dish", 3420, F),
    bin("bin-sock-kit", "sock", 4040, F),
    bin("bin-toy-bed", "toy", 4620, F),
    bin("bin-sock-bed", "sock", 6560, F - 184),
  ];

  const stars: Star[] = [
    { id: "st-ledge", x: 1020, y: 392, got: false },
    { id: "st-stair", x: 2460, y: F - 340, got: false },
    { id: "st-basket", x: 0, y: 0, got: false, ride: "basket", rideOx: 50, rideOy: -36 },
    { id: "st-fridge", x: 4210, y: F - 200 - 40, got: false },
    { id: "st-crawl", x: 5480, y: F - 22, got: false },
    { id: "st-books", x: 5970, y: F - 176 - 42, got: false },
  ];

  const checkpoints: Checkpoint[] = [
    { id: "den", x: 390, y: F },
    { id: "hall", x: 1840, y: F },
    { id: "land", x: 2620, y: F - 256 },
    { id: "kit", x: 3460, y: F },
    { id: "bed", x: 4640, y: F },
    { id: "last", x: 5700, y: F },
  ];

  const hazards: Hazard[] = [
    { kind: "swing", x: 3608, y: F - 250, len: 150, period: 1.7, radius: 20 },
    { kind: "fan", x: 3860, y: F - 120, w: 48, h: 120, force: 980, dir: 1 },
  ];

  return {
    solids,
    items,
    bins,
    stars,
    checkpoints,
    hazards,
    goal: { x: 6780, y: F - 184 - 156, w: 100, h: 156 },
    mom: { x: 168, y: F },
    dad: { x: 268, y: F },
    spawn: { x: 390, y: F },
  };
}

export function hit(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
