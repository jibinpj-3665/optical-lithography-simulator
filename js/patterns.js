// Toolpaths are generated in millimetres on a 10 x 10 mm work area.
// The same segment list drives the dose solver, the 2D preview and the 3D animation.

function seg(x1, y1, x2, y2) {
  return { x1, y1, x2, y2 };
}

function arcSegments(cx, cy, r1, r2, turns, steps) {
  const out = [];
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r1 + (r2 - r1) * t;
    const p = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    if (prev) out.push(seg(prev.x, prev.y, p.x, p.y));
    prev = p;
  }
  return out;
}

export const PATTERNS = {
  line: () => ({ segments: [seg(-4, 0, 4, 0)], description: 'Single 8 mm scan line.' }),
  lines: () => ({
    segments: [-3, -1.5, 0, 1.5, 3].map((y) => seg(-4, y, 4, y)),
    description: 'Five parallel 8 mm lines, 1.5 mm pitch.',
  }),
  grid: () => {
    const s = [];
    for (let i = -2; i <= 2; i++) {
      s.push(seg(-4, i * 1.6, 4, i * 1.6));
      s.push(seg(i * 1.6, -4, i * 1.6, 4));
    }
    return { segments: s, description: '5 × 5 grid used to check stage orthogonality.' };
  },
  serpentine: () => {
    const s = [];
    const y0 = -3.6;
    const step = 1.2;
    for (let i = 0; i < 7; i++) {
      const y = y0 + i * step;
      const left = i % 2 === 0;
      s.push(seg(left ? -4 : 4, y, left ? 4 : -4, y));
      if (i < 6) s.push(seg(left ? 4 : -4, y, left ? 4 : -4, y + step));
    }
    return { segments: s, description: 'Serpentine fill, 7 passes at 1.2 mm pitch.' };
  },
  spiral: () => ({
    segments: arcSegments(0, 0, 0.4, 4.2, 4.5, 180),
    description: '4.5-turn Archimedean spiral, 0.4 → 4.2 mm radius.',
  }),
  interdigitated: () => {
    const s = [seg(-4.2, -3.6, -4.2, 3.6), seg(4.2, -3.6, 4.2, 3.6)];
    for (let i = 0; i < 6; i++) {
      const y = -3 + i * 1.2;
      s.push(seg(-4.2, y, 1.2, y));
      s.push(seg(4.2, y + 0.6, -1.2, y + 0.6));
    }
    return { segments: s, description: 'Interdigitated electrodes: 6 fingers per side.' };
  },
  channel: () => {
    const pts = [
      [-3.5, -2.2], [-3.5, 2.2], [-2.7, 3.0], [2.7, 3.0],
      [3.5, 2.2], [3.5, -2.2], [2.7, -3.0], [-2.7, -3.0], [-3.5, -2.2],
    ];
    return { segments: pts.slice(0, -1).map((p, i) => seg(p[0], p[1], pts[i + 1][0], pts[i + 1][1])), description: 'Rounded microfluidic channel outline.' };
  },
  transistor: () => {
    const s = [
      seg(-3.6, -2.6, -0.8, -2.6), seg(0.8, -2.6, 3.6, -2.6),
      seg(-3.6, 2.6, -0.8, 2.6), seg(0.8, 2.6, 3.6, 2.6),
      seg(-2.2, -2.6, -2.2, 2.6), seg(2.2, -2.6, 2.2, 2.6),
      seg(-0.6, -1.0, 0.6, -1.0), seg(-0.6, 1.0, 0.6, 1.0),
    ];
    return { segments: s, description: 'Schematic organic TFT: source, drain and gate.' };
  },
};

export function buildJob(key) {
  const factory = PATTERNS[key] || PATTERNS.lines;
  const { segments, description } = factory();
  const length = segments.reduce((sum, s) => sum + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
  const lines = [
    '(DIY UV spot-line lithography machine - generated job)',
    '(Units: mm. Laser coordinates are relative to wafer centre.)',
    'G21 G90',
    'M5',
    `G0 X${segments[0].x1.toFixed(3)} Y${segments[0].y1.toFixed(3)}`,
  ];
  for (const s of segments) {
    lines.push('M3');
    lines.push(`G1 X${s.x2.toFixed(3)} Y${s.y2.toFixed(3)} F6000`);
    lines.push('M5');
  }
  lines.push('G0 X0 Y0', 'M2');
  return { key, segments, description, gcode: lines.join('\n'), lengthMm: length };
}

// Minimal GRBL-style parser used by the animation engine.
export function parseGcode(text) {
  const cmds = [];
  let feed = 100; // mm/s
  let laser = false;
  for (const raw of text.split('\n')) {
    const line = raw.split('(')[0].trim().toUpperCase();
    if (!line) continue;
    const words = line.match(/[A-Z][-+]?\d*\.?\d+/g) || [];
    const vals = {};
    for (const w of words) vals[w[0]] = parseFloat(w.slice(1));
    if (vals.G === 21) continue;
    if (vals.G === 90) continue;
    if (vals.G === 4) {
      cmds.push({ type: 'dwell', ms: vals.P || 0, laser });
    } else if (vals.G === 0 || vals.G === 1) {
      const move = { type: 'move', x: vals.X ?? cmds.at(-1)?.x ?? 0, y: vals.Y ?? cmds.at(-1)?.y ?? 0, rapid: vals.G === 0, laser: vals.G === 0 ? false : laser, feed };
      if (vals.F) {
        feed = vals.F / 60; // mm/min -> mm/s
        move.feed = feed;
      }
      cmds.push(move);
    } else if (vals.M === 3 || vals.M === 4) {
      laser = true;
    } else if (vals.M === 5) {
      laser = false;
    } else if (vals.M === 2) {
      break;
    }
  }
  return cmds;
}
