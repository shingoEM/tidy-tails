import type { SpriteBank } from "./sprites";
import {
  FLOOR,
  WORLD_H,
  WORLD_W,
  type ItemKind,
  type Solid,
} from "./level";
import type { TidyWorld } from "./sim";

export type Camera = { x: number; y: number; look: number };

const INK = "#2b241c";

export function frameCamera(cam: Camera, world: TidyWorld, viewW: number, viewH: number, dt: number) {
  const p = world.player;
  const face = world.mode === "title" ? 1 : p.facing;
  const targetLook = face * Math.min(80, viewW * 0.1);
  cam.look += (targetLook - cam.look) * (1 - Math.exp(-3 * dt));
  let tx = p.x + p.w / 2 - viewW * 0.4 + cam.look;
  const footRoom = viewH * (viewW < 620 ? 0.36 : 0.3);
  let ty = p.y + p.h - (viewH - footRoom);
  if (world.mode === "title") {
    tx = 40;
    ty = FLOOR - viewH * 0.78;
  }
  const maxX = Math.max(0, WORLD_W - viewW);
  const maxY = Math.max(0, WORLD_H - viewH);
  tx = clamp(tx, 0, maxX);
  ty = clamp(ty, 0, maxY);
  const kx = 1 - Math.exp(-5 * dt);
  const ky = 1 - Math.exp(-3.2 * dt);
  cam.x += (tx - cam.x) * kx;
  cam.y += (ty - cam.y) * ky;
  cam.x = Math.round(cam.x);
  cam.y = Math.round(cam.y);
}

export function render(
  ctx: CanvasRenderingContext2D,
  world: TidyWorld,
  sprites: SpriteBank | null,
  cam: Camera,
  viewW: number,
  viewH: number,
) {
  const mag = world.shake * 10;
  const sx = Math.sin(world.time * 53) * mag;
  const sy = Math.cos(world.time * 47) * mag;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, viewW, viewH);
  ctx.clip();
  ctx.translate(-cam.x + sx, -cam.y + sy);
  drawSky(ctx, cam, viewW, viewH);
  drawWalls(ctx, cam, viewW);
  drawChute(ctx, cam, viewW, world.time);
  drawWindows(ctx, world.time);
  for (const s of world.solids) {
    if ((world.goneUntil[s.id] ?? 0) > world.time) continue;
    if (!onScreen(s, cam, viewW, viewH)) continue;
    drawSolid(ctx, s, world);
  }
  drawRugs(ctx, world);
  drawHazards(ctx, world);
  drawGoal(ctx, world);
  drawParents(ctx, world, sprites);
  for (const star of world.stars) {
    if (star.got) continue;
    drawStar(ctx, sprites, star.x, star.y, world.time + star.x);
  }
  for (const bin of world.bins) drawBin(ctx, sprites, bin);
  for (const it of world.items) {
    if (it.state === "binned" || it.state === "carried") continue;
    drawItem(ctx, sprites, it.kind, it.x, it.y, world.time + it.x);
  }
  drawSister(ctx, sprites, world, "follow");
  drawSister(ctx, sprites, world, "lead");
  const carried = world.items.find((it) => it.id === world.player.carried);
  if (carried) drawItem(ctx, sprites, carried.kind, carried.x, carried.y, world.time);
  for (const b of world.bits) {
    ctx.globalAlpha = Math.max(0, b.life / b.max);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (world.mode !== "win" && (world.mode === "title" || world.elapsed < 7)) {
    drawBubble(ctx, world.level.mom.x + 36, world.level.mom.y - 118, "Fern is almost here!");
  }
  ctx.restore();
}

function onScreen(s: { x: number; y: number; w: number; h: number }, cam: Camera, vw: number, vh: number) {
  return s.x + s.w > cam.x - 80 && s.x < cam.x + vw + 80 && s.y + s.h > cam.y - 120 && s.y < cam.y + vh + 120;
}

function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number) {
  const g = ctx.createLinearGradient(0, cam.y, 0, cam.y + vh);
  g.addColorStop(0, "#8fd4f5");
  g.addColorStop(0.45, "#d7f3ff");
  g.addColorStop(1, "#fff6ea");
  ctx.fillStyle = g;
  ctx.fillRect(cam.x - 20, cam.y - 20, vw + 40, vh + 40);
  ctx.fillStyle = "#fffaf3";
  for (let i = 0; i < 5; i++) {
    const cx = cam.x * 0.72 + i * 280 + 40;
    const cy = 360 + (i % 2) * 24;
    blob(ctx, cx, cy, 70 + (i % 3) * 16, 28);
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, cam: Camera, vw: number) {
  const bands = [
    { x: -40, w: 1620, a: "#fff1d4", b: "#ffe0ad" },
    { x: 1580, w: 1760, a: "#ffe7df", b: "#ffd0c4" },
    { x: 3340, w: 1220, a: "#e5f7f2", b: "#cfeee4" },
    { x: 4560, w: 2600, a: "#e5f3fc", b: "#d3e8f8" },
  ];
  for (const band of bands) {
    if (band.x > cam.x + vw || band.x + band.w < cam.x) continue;
    ctx.fillStyle = band.a;
    ctx.fillRect(band.x, 300, band.w, 500);
    ctx.fillStyle = band.b;
    for (let x = band.x; x < band.x + band.w; x += 46) {
      ctx.fillRect(x, 300, 16, 500);
    }
    ctx.fillStyle = "#f3d7b0";
    ctx.fillRect(band.x, FLOOR - 18, band.w, 18);
  }
}

function drawChute(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, time: number) {
  ctx.fillStyle = "#7ec8c8";
  ctx.fillRect(cam.x - 10, 800, vw + 20, 160);
  ctx.fillStyle = "#e8fff8";
  for (let i = 0; i < 8; i++) {
    const x = cam.x + ((i * 97 + time * 18) % (vw + 40)) - 10;
    ctx.beginPath();
    ctx.arc(x, 830 + (i % 3) * 16, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWindows(ctx: CanvasRenderingContext2D, time: number) {
  const wins = [
    [210, 470, 150, 120],
    [1880, 500, 130, 110],
    [3600, 470, 140, 120],
    [5000, 480, 160, 120],
  ];
  for (const [x, y, w, h] of wins) {
    if (x === undefined || y === undefined || w === undefined || h === undefined) continue;
    round(ctx, x, y, w, h, 12);
    ctx.fillStyle = "#c5ecff";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(43,36,28,0.35)";
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(x + 36, y + 36, 16, 0, Math.PI * 2);
    ctx.fill();
    void time;
  }
}

function drawSolid(ctx: CanvasRenderingContext2D, s: Solid, world: TidyWorld) {
  const wobble = (world.crumble[s.id] ?? 0) * Math.sin(world.time * 36) * 6;
  ctx.save();
  ctx.translate(wobble, 0);
  const { x, y, w, h } = s;
  switch (s.look) {
    case "floor":
    case "landing":
    case "porch":
    case "grip":
      wood(ctx, x, y, w, h, s.look === "grip" ? "#f0c48a" : "#e7b15c");
      if (s.look === "grip") mat(ctx, x + 18, y - 8, w - 36, 16);
      break;
    case "tile":
      tiles(ctx, x, y, w, h);
      break;
    case "step":
      wood(ctx, x, y, w, h, "#e0a85c");
      ctx.fillStyle = "#e76f51";
      ctx.fillRect(x + 10, y, w - 20, 8);
      break;
    case "sofa":
      round(ctx, x, y, w, h, 16);
      ctx.fillStyle = "#e76f51";
      ctx.fill();
      ctx.fillStyle = "#ffd0b8";
      round(ctx, x + 16, y + 10, w * 0.34, h * 0.42, 10);
      ctx.fill();
      round(ctx, x + w * 0.48, y + 10, w * 0.38, h * 0.42, 10);
      ctx.fill();
      break;
    case "ottoman":
    case "chair":
      round(ctx, x, y, w, h, 12);
      ctx.fillStyle = s.look === "chair" ? "#f4a261" : "#1f8a7a";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + 8, y + 6, w - 16, 8);
      break;
    case "table":
      round(ctx, x, y, w, 16, 6);
      ctx.fillStyle = "#c4844a";
      ctx.fill();
      ctx.fillRect(x + 12, y + 16, 10, h - 16);
      ctx.fillRect(x + w - 22, y + 16, 10, h - 16);
      break;
    case "shelf":
    case "ledge":
    case "counter":
    case "fridge":
    case "dresser":
      round(ctx, x, y, w, h + 8, 6);
      ctx.fillStyle = s.look === "counter" ? "#f7f1e6" : s.look === "fridge" ? "#d7f3ff" : "#f3e2c4";
      ctx.fill();
      ctx.strokeStyle = "rgba(43,36,28,0.3)";
      ctx.stroke();
      lip(ctx, x, y, w);
      break;
    case "basket":
      round(ctx, x, y, w, h + 10, 8);
      ctx.fillStyle = "#f4a261";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    case "cushion":
      round(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = "#ffe08a";
      ctx.fill();
      ctx.strokeStyle = "#e76f51";
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    case "bed":
      round(ctx, x, y, w, h, 14);
      ctx.fillStyle = "#9fd7ef";
      ctx.fill();
      ctx.fillStyle = "#fffaf3";
      round(ctx, x + 14, y + 8, 36, 22, 8);
      ctx.fill();
      break;
    case "crawl":
      round(ctx, x, y, w, h, 10);
      ctx.fillStyle = "#c47a4a";
      ctx.fill();
      ctx.fillStyle = "#8fd0d4";
      ctx.fillRect(x + 8, y + h - 6, w - 16, 10);
      lip(ctx, x, y, w);
      break;
    case "books": {
      const colors = ["#e76f51", "#1f8a7a", "#f4a261", "#3aa0c8"];
      const rows = Math.max(1, Math.round(h / 18));
      for (let i = 0; i < rows; i++) {
        ctx.fillStyle = colors[i % colors.length] ?? "#f4a261";
        ctx.fillRect(x, y + i * (h / rows), w, h / rows - 2);
      }
      lip(ctx, x, y, w);
      break;
    }
    case "crumble":
      round(ctx, x, y, w, h + 6, 8);
      ctx.fillStyle = "#f0c48a";
      ctx.fill();
      ctx.fillStyle = "#e76f51";
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + 6, 3, 0, Math.PI * 2);
      ctx.arc(x + w * 0.7, y + 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      ctx.fillStyle = "#e7b15c";
      ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawRugs(ctx: CanvasRenderingContext2D, world: TidyWorld) {
  for (const cp of world.checkpoints) {
    const active = world.player.cp === world.checkpoints.indexOf(cp);
    ctx.fillStyle = active ? "#1f8a7a" : "rgba(31,138,122,0.35)";
    ctx.beginPath();
    ctx.ellipse(cp.x + 10, cp.y - 4, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHazards(ctx: CanvasRenderingContext2D, world: TidyWorld) {
  for (const hz of world.hazards) {
    if (hz.kind === "fan") {
      ctx.fillStyle = "#d7f3ff";
      round(ctx, hz.x, hz.y, hz.w, hz.h, 8);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.translate(hz.x + hz.w / 2, hz.y + 24);
      ctx.rotate(world.time * 10);
      ctx.strokeStyle = "#3aa0c8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 12);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(58,160,200,0.45)";
      for (let i = 0; i < 3; i++) {
        const shift = (world.time * 80 + i * 16) % 36;
        ctx.beginPath();
        ctx.moveTo(hz.x + hz.w + 4, hz.y + 20 + i * 18);
        ctx.lineTo(hz.x + hz.w + 18 + shift, hz.y + 20 + i * 18);
        ctx.stroke();
      }
    } else {
      const ang = Math.sin((world.time / hz.period) * Math.PI * 2) * 0.95;
      const hx = hz.x + Math.sin(ang) * hz.len;
      const hy = hz.y + Math.cos(ang) * hz.len;
      ctx.strokeStyle = "#c4844a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hz.x, hz.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = "#e76f51";
      ctx.beginPath();
      ctx.arc(hx, hy, hz.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
}

function drawGoal(ctx: CanvasRenderingContext2D, world: TidyWorld) {
  const g = world.goal;
  const ready = world.items.every((it) => it.state === "binned");
  round(ctx, g.x, g.y, g.w, g.h, 10);
  ctx.fillStyle = ready ? "#1f8a7a" : "#c4844a";
  ctx.fill();
  ctx.fillStyle = ready ? "#d7f3ff" : "#f7e3c4";
  round(ctx, g.x + 14, g.y + 18, g.w - 28, g.h - 46, 8);
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.arc(g.x + g.w / 2, g.y - 16, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (ready) {
    ctx.strokeStyle = "rgba(255,224,138,0.9)";
    ctx.lineWidth = 4;
    round(ctx, g.x - 4, g.y - 4, g.w + 8, g.h + 8, 12);
    ctx.stroke();
  }
}

function drawParents(ctx: CanvasRenderingContext2D, world: TidyWorld, sprites: SpriteBank | null) {
  const mom = sprites?.mom[Math.floor(world.time * 3) % 4];
  const dad = sprites?.dad[Math.floor(world.time * 3 + 1) % 4];
  paintActor(ctx, mom, world.level.mom.x, world.level.mom.y - 96, 54, 96, 1);
  paintActor(ctx, dad, world.level.dad.x, world.level.dad.y - 100, 56, 100, 1);
}

function drawSister(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank | null,
  world: TidyWorld,
  who: "lead" | "follow",
) {
  const lead = who === "lead";
  const sister = lead ? world.player.sister : world.player.sister === "sunny" ? "pip" : "sunny";
  const body = lead
    ? world.player
    : {
        x: world.follow.x,
        y: world.follow.y,
        w: sister === "sunny" ? 36 : 28,
        h: sister === "sunny" ? 48 : 30,
        facing: world.follow.facing,
        anim: world.follow.anim,
        grounded: true,
        vy: 0,
        vx: 40,
      };
  if (!lead) ctx.globalAlpha = 0.95;
  const blink = lead && world.player.invuln > 0 && Math.floor(world.time * 16) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.45;
  const img = pickFrame(sprites, sister, body.anim, lead ? world.player.grounded : true, lead ? Math.abs(world.player.vx) : 40, lead ? world.player.vy : 0);
  shadow(ctx, body.x + body.w / 2, body.y + body.h, body.w * 0.42);
  paintActor(ctx, img, body.x, body.y, body.w, body.h, body.facing);
  ctx.globalAlpha = 1;
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank | null,
  kind: ItemKind,
  x: number,
  y: number,
  seed: number,
) {
  const bob = Math.sin(seed * 0.02 + seed) * 3;
  const img = sprites?.props[kind === "toy" ? 0 : kind === "sock" ? 1 : 2];
  if (img) {
    ctx.drawImage(img, x - 6, y - 8 + bob, 40, 40);
    return;
  }
  ctx.fillStyle = kind === "toy" ? "#f4a261" : kind === "sock" ? "#e76f51" : "#3aa0c8";
  round(ctx, x, y + bob, 28, 28, 6);
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, sprites: SpriteBank | null, x: number, y: number, seed: number) {
  const bob = Math.sin(seed) * 4;
  const img = sprites?.props[3];
  if (img) ctx.drawImage(img, x - 16, y - 20 + bob, 36, 36);
}

function drawBin(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank | null,
  bin: { kind: ItemKind; x: number; y: number; w: number; h: number; pop: number },
) {
  const img = sprites?.bins[bin.kind === "toy" ? 0 : bin.kind === "sock" ? 1 : 2];
  const pop = 1 + bin.pop * 0.12;
  ctx.save();
  ctx.translate(bin.x + bin.w / 2, bin.y + bin.h);
  ctx.scale(pop, pop);
  if (img) ctx.drawImage(img, -bin.w * 0.7, -bin.h * 1.35, bin.w * 1.4, bin.h * 1.4);
  else {
    ctx.fillStyle = bin.kind === "toy" ? "#f4a261" : bin.kind === "sock" ? "#e76f51" : "#3aa0c8";
    round(ctx, -bin.w / 2, -bin.h, bin.w, bin.h, 10);
    ctx.fill();
  }
  ctx.restore();
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = "700 22px Fredoka, Avenir Next, sans-serif";
  const w = ctx.measureText(text).width + 28;
  round(ctx, x, y, w, 36, 12);
  ctx.fillStyle = "#fffaf3";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillText(text, x + 14, y + 25);
}

function pickFrame(
  sprites: SpriteBank | null,
  sister: "sunny" | "pip",
  anim: number,
  grounded: boolean,
  speed: number,
  vy: number,
) {
  if (!sprites) return undefined;
  const set = sprites[sister];
  if (!grounded) {
    const i = vy < -160 ? 1 : vy > 150 ? 3 : 2;
    return set.jump[i] ?? set.jump[0];
  }
  if (speed > 26) return set.run[Math.floor(anim) % set.run.length];
  return set.idle[Math.floor(anim * 0.55) % set.idle.length];
}

function paintActor(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: number,
) {
  if (!img) {
    ctx.fillStyle = "#f4a261";
    round(ctx, x, y, w, h, 10);
    ctx.fill();
    return;
  }
  const dh = h * 1.55;
  const dw = dh * (img.width / img.height);
  const foot = dh * (10 / 128);
  ctx.save();
  ctx.translate(Math.round(x + w / 2), Math.round(y + h + 1));
  ctx.scale(facing < 0 ? -1 : 1, 1);
  ctx.drawImage(img, -dw / 2, -dh + foot, dw, dh);
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number) {
  ctx.fillStyle = "rgba(43,36,28,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function wood(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(43,36,28,0.08)";
  for (let px = x; px < x + w; px += 28) ctx.fillRect(px, y, 2, h);
  lip(ctx, x, y, w);
}

function tiles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#f6e2c4";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  for (let px = x; px < x + w; px += 32) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + h);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(x, y, w, 8);
}

function mat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  round(ctx, x, y, w, h, 6);
  ctx.fillStyle = "#1f8a7a";
  ctx.fill();
}

function lip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x, y, w, 4);
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
