// Hemiciclo del Congreso de Guatemala: maqueta isométrica interactiva (skill Anatomy).
// node build.mjs            → hemiciclo.html (oscuro)
// node build.mjs --light    → hemiciclo-light.html
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/pj/.claude/skills/anatomy/kit/iso-kit.mjs";
import { DIPUTADOS, BLOQUES, NOMBRES, TOTAL, MAYORIA, DOS_TERCIOS, LEIDO } from "./data.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 760;
const HEIGHT = 470;
const RAD = Math.PI / 180;

// ── Medidas de la maqueta (unidades de mundo; x, y en el piso, z hacia arriba) ──
const R0 = 48; // radio del primer contrahuella (borde del foso)
const TD = 12.5; // fondo de cada grada
const TIERS = 6;
const RISE = 2.6; // alto de cada grada
const RO = R0 + TD * TIERS; // radio interior del antepecho
const WT = 3; // grueso del antepecho
const TOP = RISE * TIERS; // altura de la última grada
const WALL_H = 7;
const WALL_TOP = TOP + WALL_H;
const RP = 140; // radio de la base
const FRONT = 70; // frente de la base
const PLATE_H = 10;
const FOOT_H = 5;
const PER_ROW = [4, 5, 6, 7, 8, 10]; // curules por fila en cada uno de los 4 sectores → 40 × 4 = 160
const SECTORS = [[-90, -45], [-45, 0], [0, 45], [45, 90]];
const AISLES = [-45, 0, 45];
const UNIT = 1.5; // largo de una marca de la regla (una curul)
const RULE_X = -(TOTAL * UNIT) / 2; // x de la marca 0
const LIFT = 1.8; // cuánto sube una curul elegida

if (PER_ROW.reduce((sum, n) => sum + n, 0) * SECTORS.length !== TOTAL) throw new Error("las filas no suman las curules");

// φ en grados desde el fondo (−y), positivo hacia +x
const polar = (r, deg) => [r * Math.sin(deg * RAD), -r * Math.cos(deg * RAD)];
const arc = (r, from, to, steps) => Array.from({ length: steps + 1 }, (_, j) => polar(r, from + ((to - from) * j) / steps));
const sector = (r0, r1, from, to, steps) => [...arc(r1, from, to, steps), ...arc(r0, to, from, steps)];
const boxAt = (r, deg, halfT, halfR) => {
  const [cx, cy] = polar(r, deg);
  const er = [Math.sin(deg * RAD), -Math.cos(deg * RAD)];
  const et = [Math.cos(deg * RAD), Math.sin(deg * RAD)];
  return [
    [cx - et[0] * halfT - er[0] * halfR, cy - et[1] * halfT - er[1] * halfR],
    [cx + et[0] * halfT - er[0] * halfR, cy + et[1] * halfT - er[1] * halfR],
    [cx + et[0] * halfT + er[0] * halfR, cy + et[1] * halfT + er[1] * halfR],
    [cx - et[0] * halfT + er[0] * halfR, cy - et[1] * halfT + er[1] * halfR],
  ];
};
function dRing(inset = 0, steps = 96) {
  const r = RP - inset;
  const f = FRONT - inset;
  const c = Math.max(0.5, 10 - inset);
  const points = arc(r, -90, 90, steps);
  for (let j = 0; j <= 8; j++) points.push([r - c + c * Math.cos((j / 8) * 90 * RAD), f - c + c * Math.sin((j / 8) * 90 * RAD)]);
  for (let j = 0; j <= 8; j++) points.push([-(r - c) + c * Math.cos((90 + (j / 8) * 90) * RAD), f - c + c * Math.sin((90 + (j / 8) * 90) * RAD)]);
  return points;
}

const P = k.fitProjection(
  [...dRing().flatMap(([x, y]) => [[x, y, -PLATE_H - FOOT_H], [x, y, 0]]), [-23, -126, WALL_TOP + 20], [23, -126, WALL_TOP + 20], [40, 41, 33]],
  WIDTH,
  HEIGHT,
  { pad: Number(process.env.PAD ?? 28), azimuth: Number(process.env.AZ ?? 74), elevation: Number(process.env.EL ?? 42) },
);
const K = k.cameraOf(P).k; // px de pantalla por unidad de mundo

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y]) => k.depthOf([x, y, 0], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
const centreOf = (plan) => [plan.x + plan.w / 2, plan.y + plan.d / 2];
const closed = (points3) => k.pathOf(points3.map(at), true);

// ── Base ──
function base() {
  const out = [];
  const ring = dRing();
  out.push(`<path class="iso-halo" d="${k.extrude(ring, -PLATE_H - FOOT_H, PLATE_H, P).fill}"/>`);
  for (const [x, y] of byDepth([[-112, 52], [112, 52], [-104, -66], [104, -66], [0, -122]])) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.extrude(ring, -PLATE_H, PLATE_H, P, { bevel: 1.6 }), { tone: "mid", inner: L(k.ringSeam(ring, -PLATE_H / 2, P), { tone: "faint" }) }));
  out.push(L(k.onTop(dRing(5), 0, P, true), { tone: "lo" }));
  const screws = [[-132, 44], [132, 44], polar(130.5, -80), polar(130.5, 80), polar(130.5, -48), polar(130.5, 48)];
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.9, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Alfombra del foso y sello
  out.push(L(k.onTop(arc(44.5, -90, 90, 72), 0, P, true), { tone: "faint" }));
  out.push(L(k.onTop(arc(41.5, -86.5, 86.5, 72), 0, P, true), { tone: "faint" }));
  const seal = [0, -33];
  out.push(L(k.ring(seal[0], seal[1], 6.6, 0, P, 40) + k.ring(seal[0], seal[1], 5, 0, P, 36), { tone: "lo" }));
  out.push(L(k.radialTicks(seal[0], seal[1], 6.6, 16, 4, 0, [1.6, 1.6], P).minor + k.radialTicks(seal[0], seal[1], 6.6, 16, 4, 0, [1.6, 1.6], P).major, { tone: "faint" }));
  out.push(L(k.ring(seal[0], seal[1], 1.5, 0, P, 16), { tone: "lo" }));
  return out.join("");
}

// ── Gradas: seis láminas apiladas, cada una un anillo más angosto ──
function tiers() {
  const out = [];
  for (let i = 0; i < TIERS; i++) {
    const ring = sector(R0 + i * TD, RO + WT, -90, 90, 120);
    const nosing = L(k.onTop(arc(R0 + i * TD + 1.1, -90, 90, 120), (i + 1) * RISE, P), { tone: "faint" });
    out.push(S(k.extrude(ring, i * RISE, RISE, P, { convex: false }), { tone: "mid", inner: nosing }));
  }
  return out.join("");
}

// ── Curules ──
const SEATS = [];
PER_ROW.forEach((count, row) => {
  const r = R0 + row * TD;
  for (const [from, to] of SECTORS) {
    const margin = 3.6 / (r + 6) / RAD;
    const lo = from + margin;
    const hi = to - margin;
    for (let j = 0; j < count; j++) SEATS.push({ row, phi: lo + ((j + 0.5) * (hi - lo)) / count });
  }
});
SEATS.sort((a, b) => a.phi - b.phi || a.row - b.row);
const BLOC_OF = DIPUTADOS.map((diputado) => BLOQUES.findIndex((bloque) => bloque.id === diputado.bloque));

function curul(seat, index) {
  const z = (seat.row + 1) * RISE;
  const r = R0 + seat.row * TD;
  const deskTop = z + 3.2;
  const desk = k.extrude(boxAt(r + 3.6, seat.phi, 3, 1.5), z, 3.2, P);
  const cushion = k.extrude(boxAt(r + 7, seat.phi, 2.1, 1.5), z, 1.8, P);
  const back = k.extrude(boxAt(r + 9, seat.phi, 2.1, 0.5), z, 5.4, P);
  const parts = [
    {
      r: r + 3.6,
      svg:
        S(desk, { tone: "hi", crease: "lo" }) +
        L(k.onTop(boxAt(r + 4, seat.phi, 1.5, 0.65), deskTop, P, true), { tone: "faint" }) +
        D([at([...polar(r + 2.7, seat.phi), deskTop])], { size: 0.42, tone: "hi" }),
    },
    { r: r + 7, svg: S(cushion, { tone: "hi", crease: "lo" }) },
    { r: r + 9, svg: S(back, { tone: "hi", crease: "lo" }) },
  ].sort((a, b) => depth(polar(a.r, seat.phi)) - depth(polar(b.r, seat.phi)));
  // La zona sensible no se mueve con la curul: así el puntero no la pierde cuando sube
  const hit = `<path class="hc-hit" d="${desk.fill}${cushion.fill}${back.fill}"/>`;
  return `<g class="cu" data-s="${index}">${hit}<g class="cu-body">${parts.map((part) => part.svg).join("")}</g></g>`;
}

// ── Todo lo que está de pie en el graderío, ordenado de atrás hacia adelante ──
function bowl() {
  const items = [];
  SEATS.forEach((seat, index) => items.push({ key: depth(polar(R0 + seat.row * TD + 6, seat.phi)), svg: curul(seat, index) }));
  // Peldaños de los tres pasillos
  for (const aisle of AISLES) {
    for (let i = 0; i < TIERS; i++) {
      const r = R0 + i * TD - 1.8;
      items.push({ key: depth(polar(r, aisle)), svg: S(k.extrude(boxAt(r, aisle, 2.7, 1.8), i * RISE, RISE / 2, P), { tone: "lo" }) });
    }
  }
  // Antepecho en 25 paños, con pasamanos y balaustres
  const PANELS = 25;
  for (let j = 0; j < PANELS; j++) {
    const a = -90 + (180 * j) / PANELS;
    const b = -90 + (180 * (j + 1)) / PANELS;
    const mid = (a + b) / 2;
    let svg = S(k.extrude([polar(RO, a), polar(RO + WT, a), polar(RO + WT, b), polar(RO, b)], TOP, WALL_H, P), { tone: "mid" });
    svg += L(k.onTop([polar(RO + WT / 2, a), polar(RO + WT / 2, b)], WALL_TOP, P), { tone: "lo" });
    svg += D([at([...polar(RO + WT / 2, mid), WALL_TOP])], { size: 0.42 });
    if (j === (PANELS - 1) / 2) {
      // Puerta doble al fondo del pasillo central
      const y = polar(RO, a)[1];
      const door = [[-3.4, y, TOP], [3.4, y, TOP], [3.4, y, TOP + 5.8], [-3.4, y, TOP + 5.8]];
      svg += L(closed(door), { tone: "lo" }) + L(k.segment([0, y, TOP], [0, y, TOP + 5.8], P), { tone: "faint" });
      svg += D([at([-0.8, y, TOP + 2.8]), at([0.8, y, TOP + 2.8])], { size: 0.38 });
    }
    items.push({ key: depth(polar(RO + WT / 2, mid)), svg });
  }
  // Pilares en los dos extremos del graderío
  for (const side of [-1, 1]) {
    const plan = { x: side > 0 ? RO - 1.2 : -RO - 4.2, y: 0, w: 5.4, d: 4.4, r: 0.8 };
    const cap = { x: plan.x - 0.6, y: plan.y - 0.6, w: plan.w + 1.2, d: plan.d + 1.2, r: 1 };
    const svg =
      S(k.slabOf(plan, 0, WALL_TOP + 2, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, TOP, P, 3), { tone: "faint" }) }) +
      S(k.slabOf(cap, WALL_TOP + 2, 1.2, P, 3, 0.4), { tone: "mid" }) +
      D([at([plan.x + plan.w / 2, plan.y + plan.d / 2, WALL_TOP + 3.2])], { size: 0.45 });
    items.push({ key: depth(centreOf(plan)), svg });
  }
  return items
    .sort((a, b) => a.key - b.key)
    .map((item) => item.svg)
    .join("");
}

// ── Tablero electrónico sobre el antepecho del fondo ──
const BOARD = { x: -23, y: -126.2, w: 46, d: 3.4, r: 0.8 };
const BOARD_Z = WALL_TOP + 5;
const BOARD_H = 14.4;
function board() {
  const out = [];
  for (const x of [-15, 15]) out.push(S(k.slabOf({ x: x - 1.1, y: -125.6, w: 2.2, d: 2.2, r: 0.4 }, WALL_TOP, 5, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(BOARD, BOARD_Z, BOARD_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(BOARD, BOARD_Z + 1.2, P, 3), { tone: "faint" }) }));
  const face = BOARD.y + BOARD.d;
  const top = BOARD_Z + BOARD_H;
  const matrix = k.sideMatrix([BOARD.x, face], top, P, "left");
  const win = { x: 3.4, y: 2.6, w: 25, h: 9 };
  const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  const dot = 0.42 / K;
  out.push(
    `<g transform="${matrix}">` +
      `<clipPath id="hc-window"><path d="${rect(win.x, win.y, win.w, win.h)}"/></clipPath>` +
      `<path class="hc-glass" d="${rect(win.x, win.y, win.w, win.h)}"/>` +
      `<g clip-path="url(#hc-window)"><text class="hc-digits" data-part="digits" x="${win.x + win.w / 2}" y="${win.y + win.h / 2 + 2.55}" font-size="7.2" text-anchor="middle">000</text></g>` +
      `<path class="iso-line" data-tone="lo" d="${rect(win.x, win.y, win.w, win.h)}"/>` +
      `<path class="iso-line" data-tone="faint" d="${rect(win.x - 0.9, win.y - 0.9, win.w + 1.8, win.h + 1.8)}"/>` +
      [33.6, 40.6]
        .map(
          (x, index) =>
            `<circle class="hc-lamp" data-lamp="${index}" cx="${x}" cy="5.6" r="2.1"/>` +
            `<circle class="iso-line" data-tone="faint" cx="${x}" cy="5.6" r="2.9"/>` +
            `<path class="iso-line" data-tone="lo" data-free="" d="M${x - 1.9} 10.4h${index ? 3.8 : 2.6}"/>`,
        )
        .join("") +
      `<g class="iso-dots" data-tone="mid">${[[1.5, 1.5], [44.5, 1.5], [1.5, 12.9], [44.5, 12.9]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${dot.toFixed(3)}"/>`).join("")}</g>` +
      `</g>`,
  );
  return out.join("");
}

// ── Foso: tribuna y mesa de taquígrafos ──
function well() {
  const out = [];
  for (const [x, y] of byDepth([[-5, -23], [5, -23]])) {
    out.push(S(k.cylinder(x, y, 1.7, 0, 2.2, P, 18), { tone: "mid" }));
  }
  const table = { x: -10, y: -19.6, w: 20, d: 5.6, r: 0.6 };
  out.push(S(k.slabOf(table, 0, 3.3, P, 2, 0.35), { tone: "mid" }));
  out.push(L([-5, 5].map((x) => k.planOutline({ x: x - 2.6, y: table.y + 1.3, w: 5.2, d: 3, r: 0.3 }, 3.3, P, 2)).join(""), { tone: "faint" }));
  // Tribuna
  out.push(S(k.slabOf({ x: -4.2, y: -1.6, w: 8.4, d: 6.4, r: 1 }, 0, 0.8, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: -3, y: -0.6, w: 6, d: 4.2, r: 0.6 }, 0.8, 6.4, P, 2), { tone: "mid", inner: L(k.sideSeam({ x: -3, y: -0.6, w: 6, d: 4.2, r: 0.6 }, 5.6, P, 2), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: -3.7, y: -1.2, w: 7.4, d: 5.4, r: 0.6 }, 7.2, 0.8, P, 2, 0.3), { tone: "mid" }));
  out.push(L(k.rise([0, 0.6], 8, 10.4, P), { tone: "mid" }));
  out.push(D([at([0, 0.6, 8])], { size: 0.4 }) + D([at([0, 0.6, 10.4])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

// ── Estrado de la Junta Directiva: presidencia, tres vicepresidencias y cinco secretarías ──
const PLACES = Array.from({ length: 9 }, (_, j) => -26 + j * 6.5);
function dais() {
  const out = [];
  out.push(S(k.slabOf({ x: -38, y: 11, w: 76, d: 36, r: 2 }, 0, 1.4, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -34, y: 14, w: 68, d: 30, r: 1.5 }, 1.4, 1.4, P, 4, 0.5), { tone: "mid" }));
  const Z = 2.8;
  const desks = [
    { plan: { x: -30, y: 16.5, w: 23, d: 5.5, r: 0.8 }, h: 5.2 },
    { plan: { x: -7, y: 16, w: 14, d: 6.5, r: 0.8 }, h: 6.6 },
    { plan: { x: 7, y: 16.5, w: 23, d: 5.5, r: 0.8 }, h: 5.2 },
  ];
  for (const desk of desks) {
    out.push(S(k.slabOf(desk.plan, Z, desk.h, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(desk.plan, Z + desk.h - 1, P, 3), { tone: "faint" }) }));
  }
  // Micrófonos y carpetas
  PLACES.forEach((x, j) => {
    const top = Z + (j === 4 ? 6.6 : 5.2);
    out.push(L(k.planOutline({ x: x - 1.8, y: 19.2, w: 3.6, d: 2, r: 0.3 }, top, P, 2), { tone: "faint" }));
    out.push(L(k.rise([x, 17.9], top, top + 1.9, P), { tone: "mid" }));
    out.push(D([at([x, 17.9, top])], { size: 0.36 }) + D([at([x, 17.9, top + 1.9])], { size: 0.5, tone: "hi" }));
  });
  // Mazo de la presidencia
  out.push(S(k.cylinder(3.6, 20.4, 0.8, Z + 6.6, 0.7, P, 12), { tone: "mid" }));
  // Sillas, de atrás hacia adelante
  const chairs = PLACES.map((x, j) => ({ x, chief: j === 4 }));
  for (const chair of [...chairs].sort((a, b) => depth([a.x, 26]) - depth([b.x, 26]))) {
    const half = chair.chief ? 2.7 : 2.3;
    out.push(S(k.slabOf({ x: chair.x - half, y: 23.4, w: half * 2, d: 4, r: 0.5 }, Z, 2.4, P, 2), { tone: "mid" }));
    out.push(S(k.slabOf({ x: chair.x - half, y: 27.4, w: half * 2, d: 1.2, r: 0.4 }, Z, chair.chief ? 9.6 : 7.6, P, 2), { tone: "mid" }));
  }
  // Banderas en las esquinas traseras del estrado
  for (const x of [-31, 31]) {
    const y = 41;
    out.push(S(k.cylinder(x, y, 1.8, Z, 0.8, P, 18), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 0.45, Z + 0.8, 27, P, 10), { tone: "mid", crease: "none" }));
    const flag = { x: x + 0.45, y: y - 0.25, w: 8.6, d: 0.5, r: 0 };
    const stripes = [1, 2].map((n) => k.segment([flag.x + (flag.w * n) / 3, y + 0.25, Z + 19.6], [flag.x + (flag.w * n) / 3, y + 0.25, Z + 26.6], P)).join("");
    out.push(S(k.slabOf(flag, Z + 19.6, 7, P, 1), { tone: "mid", inner: L(stripes, { tone: "lo" }) }));
    out.push(S(k.cylinder(x, y, 0.9, Z + 27.8, 0.9, P, 12), { tone: "mid" }));
  }
  return out.join("");
}

// ── Frente de la base: placa, consola técnica y regla de mayorías ──
const STRIP = { x: RULE_X - 4, y: 52, w: TOTAL * UNIT + 8, d: 7, r: 1 };
const STRIP_TOP = 1.2;
const markX = (count) => RULE_X + count * UNIT;
function front() {
  const out = [];
  // Placa de datos
  const label = { x: -118, y: 21, w: 36, d: 14, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[26, 4.2], [19, 7], [22, 9.8]].map(([w, y]) => k.lineOnTop([label.x + 5, label.y + y], [label.x + 5 + w, label.y + y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.6, label.y + 7, 0.8]), at([label.x + label.w - 2.6, label.y + 7, 0.8])], { size: 0.45 }));
  // Consola de sonido y votación
  for (const [x, y] of byDepth([[93, 31.6], [105, 31.6]])) out.push(S(k.cylinder(x, y, 1.7, 0, 2.2, P, 18), { tone: "mid" }));
  const desk = { x: 84, y: 20, w: 30, d: 8, r: 0.8 };
  out.push(S(k.slabOf(desk, 0, 4.2, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(desk, 3.2, P, 3), { tone: "faint" }) }));
  const unit = { x: 87, y: 21.2, w: 15, d: 5, r: 0.6 };
  out.push(S(k.slabOf(unit, 4.2, 1.6, P, 2, 0.3), { tone: "mid" }));
  out.push(D(k.dotGrid(unit.x + 1.6, unit.y + 1.5, 7, 2, 2, 5.8, P), { size: 0.36, tone: "mid" }));
  out.push(L(k.planOutline({ x: 104.5, y: 21.6, w: 6.5, d: 4.2, r: 0.4 }, 4.2, P, 2), { tone: "faint" }));
  // Regla: 160 marcas, una por curul
  out.push(S(k.slabOf(STRIP, 0, STRIP_TOP, P, 3, 0.35), { tone: "lo" }));
  const ticks = k.topTicks(RULE_X, RULE_X + TOTAL * UNIT, UNIT, 10, STRIP.y + 0.35, STRIP_TOP, [1.5, 3.1], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L([MAYORIA, DOS_TERCIOS].map((count) => k.lineOnTop([markX(count), STRIP.y], [markX(count), STRIP.y + STRIP.d], STRIP_TOP, P)).join(""), { tone: "hi" }));
  for (const x of [STRIP.x - 5, STRIP.x + STRIP.w + 1]) {
    const stop = { x, y: 50.5, w: 4, d: 10, r: 1 };
    out.push(S(k.slabOf(stop, 0, 4.4, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x + 2, 53, 4.4]), at([x + 2, 58, 4.4])], { size: 0.42 }));
  }
  return out.join("");
}
function cursor() {
  const body = { x: RULE_X - 2.2, y: 50.6, w: 4.4, d: 9.6, r: 1 };
  const top = STRIP_TOP + 3.2;
  return [
    S(k.slabOf(body, STRIP_TOP, 3.2, P, 3, 0.35), { tone: "hi", crease: "lo", lit: true }),
    L(k.lineOnTop([RULE_X, body.y], [RULE_X, body.y + body.d], top, P), { tone: "lit" }),
    S(k.cylinder(RULE_X, 55.4, 1.5, top, 2.4, P, 16), { tone: "hi", crease: "lo", lit: true }),
    L(k.knurl(RULE_X, 55.4, 1.5, top, top + 2.4, 14, P, 0.3), { tone: "mid" }),
  ].join("");
}
function pins() {
  const out = [];
  for (const count of [MAYORIA, DOS_TERCIOS]) {
    const x = markX(count);
    out.push(S(k.cylinder(x, 62.6, 2.1, 0, 0.7, P, 18), { tone: "lo" }));
    out.push(S(k.cylinder(x, 62.6, 1.25, 0.7, 4.6, P, 14), { tone: "mid" }));
    out.push(L(k.knurl(x, 62.6, 1.25, 3.5, 5.3, 12, P, 0.25), { tone: "lo" }));
    out.push(D([at([x, 62.6, 5.3])], { size: 0.45, tone: "hi" }));
  }
  return out.join("");
}

// ── Verdades que cita el pie de figura, calculadas de los datos ──
const sizes = BLOQUES.map((bloque) => bloque.curules.length);
const bySize = BLOQUES.map((_, index) => index).sort((a, b) => sizes[b] - sizes[a] || a - b);
const needFor = (goal) => {
  let sum = 0;
  let used = 0;
  for (const index of bySize) {
    if (sum >= goal) break;
    sum += sizes[index];
    used++;
  }
  return used;
};
const NEED = [needFor(MAYORIA), needFor(DOS_TERCIOS)];
const IND = BLOQUES.find((bloque) => bloque.id === "IND");
const IND_SEMILLA = IND.curules.filter((index) => DIPUTADOS[index].partido === "SEMILLA").length;
const WORDS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho"];
// Recorrido en reposo: suma los bloques de mayor a menor hasta pasar los dos tercios
const TOUR = [[]];
for (let n = 1; n <= NEED[1]; n++) TOUR.push(bySize.slice(0, n));

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: `Maqueta del hemiciclo del Congreso de Guatemala: ${TOTAL} curules en seis gradas y cuatro sectores, frente al estrado de la Junta Directiva con nueve puestos, la tribuna y la mesa de taquígrafos. Al fondo, un tablero muestra cuántas curules suma la selección; al frente, una regla de ${TOTAL} marcas lleva un cursor y dos pines, en ${MAYORIA} y ${DOS_TERCIOS}.`,
  body: [
    base(),
    tiers(),
    bowl(),
    board(),
    well(),
    dais(),
    front(),
    `<g data-part="cursor">${cursor()}</g>`,
    pins(),
  ],
});

const DATA = {
  rise: k.axisVector(P, [0, 0, LIFT]).map((value) => Math.round(value * 100) / 100),
  step: k.axisVector(P, [UNIT, 0, 0]).map((value) => Math.round(value * 1000) / 1000),
  seats: DIPUTADOS.map((diputado, index) => [BLOC_OF[index], diputado.nombre, diputado.partido === diputado.bloque ? "" : NOMBRES[diputado.partido] ?? diputado.partido]),
  blocs: BLOQUES.map((bloque) => ({ name: bloque.nombre, seats: bloque.curules })),
  tour: TOUR,
  total: TOTAL,
  marks: [MAYORIA, DOS_TERCIOS],
};

const live = `
const D = ${JSON.stringify(DATA)};
const stage = document.querySelector(".hc-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const hint = document.querySelector("[data-hint]");
const say = document.querySelector("[data-live]");
const cursor = svg.querySelector('[data-part="cursor"]');
const digits = svg.querySelector('[data-part="digits"]');
const lamps = [...svg.querySelectorAll(".hc-lamp")];
const chips = [...document.querySelectorAll(".hc-bloc")];
const seatEls = [];
const bodyEls = [];
svg.querySelectorAll(".cu").forEach((node) => { seatEls[Number(node.dataset.s)] = node; bodyEls[Number(node.dataset.s)] = node.querySelector(".cu-body"); });
const still = matchMedia("(prefers-reduced-motion: reduce)");
const touch = matchMedia("(hover: none)");
const N = D.seats.length;
const IDLE_HINT = () => (touch.matches ? "Toca una curul para sumar su bloque" : "Pasa por una curul · clic para sumar su bloque");
const level = new Float32Array(N);
const goal = new Uint8Array(N);
const dueAt = new Float64Array(N).fill(-1);
const dueTo = new Uint8Array(N);
const picked = new Set();
let tour = [];
let hover = -1, hoverSeat = -1, keyAt = -1, touring = false, tourClock = 0;
let count = 0, clock = 0, frame = 0, last = 0, visible = false, idleTimer = 0, shownKey = "", lastText = "", lastDigits = "";
const shown = () => {
  if (touring) return new Set(tour);
  const set = new Set(picked);
  if (hover >= 0) set.add(hover);
  return set;
};
const sumOf = (set) => { let sum = 0; set.forEach((index) => { sum += D.blocs[index].seats.length; }); return sum; };
const statusOf = (n) => (n >= D.marks[1] ? "dos tercios" : n >= D.marks[0] ? "mayoría absoluta" : "faltan " + (D.marks[0] - n) + " para mayoría");
const namesOf = (set) => {
  const list = [...set].sort((a, b) => a - b).map((index) => D.blocs[index].name);
  if (list.length <= 2) return list.join(" + ");
  return list[0] + " + " + (list.length - 1) + " bloques";
};
const textOf = (set, n) => (set.size ? namesOf(set) + " · " + n + " de " + D.total + " · " + statusOf(n) : D.total + " curules · " + D.blocs.length + " bloques");
function apply() {
  const set = shown();
  const key = [...set].sort((a, b) => a - b).join(",");
  if (key !== shownKey) {
    shownKey = key;
    D.blocs.forEach((bloc, index) => {
      const on = set.has(index) ? 1 : 0;
      bloc.seats.forEach((seat, rank) => {
        const heading = dueAt[seat] >= 0 ? dueTo[seat] : goal[seat];
        if (heading !== on) { dueAt[seat] = clock + rank * 0.008; dueTo[seat] = on; }
      });
    });
    stage.toggleAttribute("data-focus", set.size > 0);
  }
  chips.forEach((chip, index) => {
    chip.toggleAttribute("data-on", set.has(index));
    chip.setAttribute("aria-pressed", picked.has(index) ? "true" : "false");
  });
  run();
}
function draw() {
  const set = shown();
  const n = Math.round(count);
  cursor.setAttribute("transform", "translate(" + (D.step[0] * count).toFixed(2) + " " + (D.step[1] * count).toFixed(2) + ")");
  const text = String(n).padStart(3, "0");
  if (text !== lastDigits) { digits.textContent = text; lastDigits = text; }
  lamps.forEach((lamp, index) => lamp.toggleAttribute("data-on", n >= D.marks[index]));
  const line = textOf(set, n);
  if (line !== lastText) { readout.textContent = line; lastText = line; }
}
const TOUR_HOLD = [1.3, 1.7, 1.7, 2.1, 3.2, 3.2, 3.2, 3.2];
function tourTick(dt) {
  tourClock += dt;
  const total = D.tour.reduce((sum, _, index) => sum + TOUR_HOLD[Math.min(index, TOUR_HOLD.length - 1)], 0);
  let t = tourClock % total, index = 0;
  while (t > TOUR_HOLD[Math.min(index, TOUR_HOLD.length - 1)]) { t -= TOUR_HOLD[Math.min(index, TOUR_HOLD.length - 1)]; index++; }
  if (tour !== D.tour[index]) { tour = D.tour[index]; apply(); }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) tourTick(dt);
  let moving = false;
  const ease = 1 - Math.exp(-dt / 0.14);
  for (let i = 0; i < N; i++) {
    if (dueAt[i] >= 0) {
      if (calm || clock >= dueAt[i]) { goal[i] = dueTo[i]; dueAt[i] = -1; seatEls[i].toggleAttribute("data-on", goal[i] === 1); }
      else moving = true;
    }
    const to = goal[i];
    let value = level[i];
    if (value !== to) {
      value = calm ? to : value + (to - value) * ease;
      if (Math.abs(to - value) < 0.004) value = to;
      level[i] = value;
      if (value) bodyEls[i].setAttribute("transform", "translate(" + (D.rise[0] * value).toFixed(2) + " " + (D.rise[1] * value).toFixed(2) + ")");
      else bodyEls[i].removeAttribute("transform");
      if (value !== to) moving = true;
    }
  }
  const want = sumOf(shown());
  if (count !== want) {
    count = calm ? want : count + (want - count) * (1 - Math.exp(-dt / 0.26));
    if (Math.abs(want - count) < 0.02) count = want;
    moving = true;
  }
  draw();
  frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
function rest() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (picked.size || hover >= 0 || still.matches || document.activeElement === stage) return;
    touring = true; tourClock = 0; tour = D.tour[0]; apply();
  }, 3600);
}
function takeOver() {
  if (touring) { touring = false; tour = []; }
  rest();
}
const announce = () => { const set = new Set(picked); say.textContent = textOf(set, sumOf(set)); };
function toggle(index) {
  if (picked.has(index)) picked.delete(index); else picked.add(index);
  announce();
}
function previewSeat(seat) {
  hoverSeat = seat;
  hover = D.seats[seat][0];
  const [bloc, name, party] = D.seats[seat];
  hint.textContent = name + " · " + D.blocs[bloc].name + (party ? " · por " + party : "");
}
function previewBloc(index) {
  hover = index;
  hoverSeat = -1;
  hint.textContent = index >= 0 ? D.blocs[index].name + " · " + D.blocs[index].seats.length + (D.blocs[index].seats.length === 1 ? " curul" : " curules") : IDLE_HINT();
}
svg.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const node = event.target.closest(".cu");
  if (!node) return;
  const seat = Number(node.dataset.s);
  if (seat === hoverSeat) return;
  takeOver();
  previewSeat(seat);
  apply();
});
stage.addEventListener("pointerleave", () => {
  if (hover < 0 && hoverSeat < 0) return;
  previewBloc(-1);
  keyAt = -1;
  apply();
  rest();
});
svg.addEventListener("click", (event) => {
  const node = event.target.closest(".cu");
  // Un clic junto a la curul que se está mirando cuenta para su bloque
  if (!node && (hoverSeat < 0 || touch.matches)) return;
  const seat = node ? Number(node.dataset.s) : hoverSeat;
  const index = D.seats[seat][0];
  takeOver();
  toggle(index);
  if (touch.matches) { hover = -1; hoverSeat = -1; hint.textContent = IDLE_HINT(); }
  else if (picked.has(index)) previewSeat(seat);
  else { hover = -1; hoverSeat = seat; }
  apply();
});
chips.forEach((chip, index) => {
  chip.addEventListener("pointerenter", (event) => { if (event.pointerType === "touch") return; takeOver(); previewBloc(index); apply(); });
  chip.addEventListener("pointerleave", () => { if (hover !== index) return; previewBloc(-1); apply(); rest(); });
  chip.addEventListener("click", () => { takeOver(); toggle(index); if (!picked.has(index)) previewBloc(-1); apply(); });
});
stage.addEventListener("keydown", (event) => {
  const many = D.blocs.length;
  let handled = true;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") keyAt = (keyAt + 1) % many;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") keyAt = (keyAt + many - 1) % many;
  else if (event.key === "Home") keyAt = 0;
  else if (event.key === "End") keyAt = many - 1;
  else if (event.key === " " || event.key === "Enter") { if (keyAt < 0) keyAt = 0; toggle(keyAt); }
  else if (event.key === "Escape") { picked.clear(); keyAt = -1; announce(); }
  else handled = false;
  if (!handled) return;
  event.preventDefault();
  takeOver();
  previewBloc(keyAt);
  apply();
});
stage.addEventListener("blur", () => { if (keyAt >= 0) { keyAt = -1; previewBloc(-1); apply(); } rest(); });
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
hint.textContent = IDLE_HINT();
draw();
if (!still.matches) setTimeout(() => { if (!picked.size && hover < 0 && keyAt < 0) { touring = true; tourClock = 0; tour = D.tour[0]; apply(); } }, 1400);
`;

const css = `
.hc{--hc-glass:#080808;--hc-ring:#ffffff14;--hc-chip:#ffffff0a}
[data-theme="light"] .hc{--hc-glass:#e4e4df;--hc-ring:#00000018;--hc-chip:#0000000a}
.hc .iso-plate{padding:50px 18px 54px;overflow:hidden}
.hc-stage{position:relative;touch-action:pan-y;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.hc-stage:focus{outline:none}
.hc-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.cu{cursor:pointer}
.hc-hit{fill:transparent;stroke:transparent;stroke-width:4px;pointer-events:all}
.cu .iso-fill,.cu .iso-top,.cu .iso-shade{transition:fill 240ms var(--anatomy-ease)}
.cu .iso-line{transition:stroke 240ms var(--anatomy-ease)}
.hc-stage[data-focus] .cu:not([data-on]){--anatomy-hi:var(--anatomy-mid);--anatomy-lo:var(--anatomy-faint)}
.cu[data-on]{--anatomy-hi:var(--anatomy-lit);--anatomy-lo:var(--anatomy-mid)}
.cu[data-on] .iso-fill{fill:var(--anatomy-face)}
.cu[data-on] .iso-top{fill:var(--anatomy-lit-top)}
.cu[data-on] .iso-shade{fill:var(--anatomy-lit-shade)}
.hc-glass{fill:var(--hc-glass);stroke:none}
.hc-digits{fill:var(--anatomy-lit);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.08em}
.hc-lamp{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);transition:fill 260ms var(--anatomy-ease),stroke 260ms var(--anatomy-ease)}
.hc-lamp[data-on]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.hc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hc-blocs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.hc-bloc{display:inline-flex;align-items:baseline;gap:7px;padding:5px 10px;border:0;border-radius:999px;background:transparent;color:var(--anatomy-muted);font:12.5px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;box-shadow:inset 0 0 0 1px var(--hc-ring);transition:color 160ms var(--anatomy-ease),background 160ms var(--anatomy-ease),box-shadow 160ms var(--anatomy-ease)}
.hc-bloc:hover,.hc-bloc:focus-visible,.hc-bloc[data-on]{color:var(--anatomy-strong);background:var(--hc-chip);outline:none}
.hc-bloc[aria-pressed="true"]{box-shadow:inset 0 0 0 1px var(--anatomy-mid)}
.hc-bloc b{font-family:var(--anatomy-mono);font-size:10.5px;font-weight:400;color:var(--anatomy-muted);font-variant-numeric:tabular-nums}
@media (max-width:560px){.hc .iso-plate{padding:46px 6px 92px}.hc .iso-plate-corner[data-corner="hint"]{bottom:36px;right:0;white-space:normal;line-height:1.35}.hc .iso-plate-corner[data-corner="readout"]{left:0;right:0;white-space:normal;line-height:1.35}.hc .iso-plate-corner[data-corner="title"]{letter-spacing:.06em}}
@media (prefers-reduced-motion:reduce){.cu .iso-fill,.cu .iso-top,.cu .iso-shade,.cu .iso-line,.hc-lamp{transition:none}}
`;

const chips = BLOQUES.map((bloque) => `<button type="button" class="hc-bloc" aria-pressed="false">${bloque.nombre}<b>${bloque.curules.length}</b></button>`).join("");
const caption = `Maqueta del hemiciclo con las ${TOTAL} curules ordenadas por bloque, según el observatorio del Congreso de Poder Ciudadano al ${LEIDO}. Ningún bloque llega solo a los ${MAYORIA} votos de la mayoría absoluta: hacen falta al menos ${WORDS[NEED[0]]}, y ${WORDS[NEED[1]]} para los ${DOS_TERCIOS} de los dos tercios. «Independientes» reúne a ${IND.curules.length} diputados sin bloque, ${IND_SEMILLA} de ellos electos por Semilla. El orden es el de un gráfico parlamentario, no la curul física de cada diputado.`;

let body = k.plateHtml({
  fig: "Fig 1",
  title: "Hemiciclo · Congreso de Guatemala",
  hint: "Pasa por una curul · clic para sumar su bloque",
  readout: `${TOTAL} curules · ${BLOQUES.length} bloques`,
  keys: [
    { mark: "lit", label: "Curules del bloque o de la suma elegida, y el cursor que las cuenta" },
    { mark: "raised", label: `Regla de ${TOTAL} marcas con pines en ${MAYORIA} y ${DOS_TERCIOS}; las dos lámparas del tablero se encienden al pasarlos` },
  ],
  caption,
  body: `<div class="hc-stage" tabindex="0" role="group" aria-label="Hemiciclo del Congreso de Guatemala. Las flechas recorren los ${BLOQUES.length} bloques, Espacio suma o quita el bloque y Escape limpia la suma.">${svg}</div><span class="hc-live" aria-live="polite" data-live></span>`,
});
body = body
  .replace('class="iso-figure"', 'class="iso-figure hc"')
  .replace('data-corner="hint"', 'data-corner="hint" data-hint')
  .replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend"><span class="hc-blocs">${chips}</span>`);

const file = theme === "light" ? "hemiciclo-light.html" : "hemiciclo.html";
const page = k.pageHtml({ title: "Hemiciclo del Congreso de Guatemala", theme, body: `<style>${css}</style>${body}`, script: live, width: 940 }).replace('<html lang="en">', '<html lang="es">');
writeFileSync(join(HERE, file), page);
console.log("wrote", file, `${(page.length / 1024).toFixed(0)} KB`, "· scale", K.toFixed(2), "· curules", SEATS.length, "· bloques", BLOQUES.length, "· hacen falta", NEED.join(" y "));
