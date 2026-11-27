// Process physics: spin coating, Gaussian direct-write exposure, resist development,
// astigmatic focus error and derived metrology. Units are documented per function.

export const GRID = 320;
const AREA = 10; // mm
const LAMBDA_UM = 0.405;

export function rayleighUm(spotUm) {
  return (Math.PI * spotUm * spotUm) / LAMBDA_UM;
}

export function waistUm(spotUm, defocusUm) {
  return spotUm * Math.sqrt(1 + Math.pow(defocusUm / rayleighUm(spotUm), 2));
}

export function effectiveSpotUm(params) {
  return waistUm(params.spotUm, params.defocusUm) + params.stageErrorUm;
}

// Empirical spin-coat relation: thickness ~ solids/viscosity and speed^-1/2.
export function spinThicknessUm(rpm, viscosity, solids, spinTime) {
  const speedFactor = Math.sqrt(1000 / Math.max(rpm, 200));
  const viscosityFactor = Math.pow(40 / Math.max(viscosity, 5), 0.35);
  const solidFactor = Math.pow(solids / 10, 0.7);
  const timeFactor = spinTime < 10 ? 0.75 + 0.025 * spinTime : 1;
  return Math.min(12, Math.max(0.15, 4.6 * speedFactor * viscosityFactor * solidFactor * timeFactor));
}

export function qpdSignal(defocusUm, spotUm) {
  const x = defocusUm / rayleighUm(spotUm);
  const k = 1 / (1 + x * x);
  const a = ((1 + x) * k + 1) / 2;
  const b = ((1 - x) * k + 1) / 2;
  const c = b;
  const d = a;
  const fes = (2 * ((a + c) - (b + d))) / (a + b + c + d);
  return { a, b, c, d, fes, aspect: Math.abs((1 + x) / (1 - x + 1e-6)), x };
}

// Dose deposited by a scanned Gaussian line, in mJ/cm^2.
// P[W] / (v[m/s] * sigma[m] * sqrt(2*pi)) gives J/m^2; multiply by 0.1.
function peakDose(params, spotEffUm) {
  const powerW = (params.laserMw * params.dutyPct) / 100 / 1000;
  const v = Math.max(params.speedMmS, 0.1) / 1000;
  const sigma = (Math.max(spotEffUm, 0.2) * 1e-6) / Math.SQRT2;
  return (0.1 * powerW) / (v * sigma * Math.sqrt(2 * Math.PI));
}

function pointSegmentDistance(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - s.x1) * dx + (py - s.y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

export function computeDoseMap(segments, params) {
  const dose = new Float32Array(GRID * GRID);
  const spot = effectiveSpotUm(params);
  const sigmaMm = Math.max(spot, 0.2) / 1000 / Math.SQRT2;
  const peak = peakDose(params, spot);
  const reach = 3.5 * sigmaMm;
  const cell = AREA / GRID;
  const SUB = 24; // sub-cell peak sampling keeps sub-10 µm spots visible on a 31 µm pixel grid
  const subCell = cell / SUB;

  for (const s of segments) {
    const minX = Math.min(s.x1, s.x2) - reach - cell;
    const maxX = Math.max(s.x1, s.x2) + reach + cell;
    const minY = Math.min(s.y1, s.y2) - reach - cell;
    const maxY = Math.max(s.y1, s.y2) + reach + cell;
    const i0 = Math.max(0, Math.floor((minX + AREA / 2) / cell));
    const i1 = Math.min(GRID - 1, Math.ceil((maxX + AREA / 2) / cell));
    const j0 = Math.max(0, Math.floor((AREA / 2 - maxY) / cell));
    const j1 = Math.min(GRID - 1, Math.ceil((AREA / 2 - minY) / cell));
    const twoSigma2 = 2 * sigmaMm * sigmaMm;
    for (let j = j0; j <= j1; j++) {
      const cellYTop = AREA / 2 - (j + 1) * cell;
      for (let i = i0; i <= i1; i++) {
        const cellXLeft = -AREA / 2 + i * cell;
        let best = 0;
        for (let sy = 0; sy < SUB; sy++) {
          const y = cellYTop + (sy + 0.5) * subCell;
          for (let sx = 0; sx < SUB; sx++) {
            const x = cellXLeft + (sx + 0.5) * subCell;
            const d = pointSegmentDistance(x, y, s);
            if (d < reach) {
              const v = Math.exp(-(d * d) / twoSigma2);
              if (v > best) best = v;
            }
          }
        }
        if (best > 0) dose[j * GRID + i] += peak * best;
      }
    }
  }
  return { dose, peak, spot };
}

export function developMap(doseMap, baseThicknessUm, params) {
  const height = new Float32Array(GRID * GRID);
  const remaining = new Float32Array(GRID * GRID);
  const cell = AREA / GRID;
  const bake = Math.exp(-(params.softBakeC / 80) * (params.softBakeS / 60) * 0.35);
  const rDark = 0.0025 * bake;
  const rMax = 0.5 * (params.developerPct / 100);
  const gamma = params.gamma;
  const threshold = Math.max(params.doseThreshold, 1);
  let min = Infinity;
  let max = -Infinity;

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const idx = j * GRID + i;
      const x = -AREA / 2 + (i + 0.5) * cell;
      const y = AREA / 2 - (j + 0.5) * cell;
      const rNorm = Math.hypot(x, y) / (AREA / 2);
      const edgeBead = 1 + 0.05 * Math.pow(rNorm, 3) + 0.06 * Math.exp(-Math.pow((rNorm - 0.97) / 0.09, 2));
      const h0 = baseThicknessUm * edgeBead;
      const rel = Math.pow(doseMap[idx] / threshold, gamma);
      const rate = params.tone === 'negative'
        ? rDark + rMax / (1 + rel)
        : rDark + (rMax * rel) / (1 + rel);
      const h = Math.max(0, h0 - rate * params.devTimeS);
      height[idx] = h;
      remaining[idx] = h0 > 0 ? h / h0 : 0;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { height, remaining, min, max };
}

export function estimateMetrics(segments, params, doseResult, developed) {
  const target = Math.min(
    ...segments.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1)),
    params.spotUm
  );
  const cd = Math.max(0.3, target * 0.15 + doseResult.spot * 1.15 + params.stageErrorUm * 0.8);
  let exposed = 0;
  let sum = 0;
  for (const d of doseResult.dose) {
    if (d > params.doseThreshold * 0.05) {
      exposed++;
      sum += d;
    }
  }
  return {
    cd,
    peakDose: doseResult.peak,
    meanDose: exposed ? sum / exposed : 0,
    doseRatio: doseResult.peak / params.doseThreshold,
    minHeight: developed.min,
    maxHeight: developed.max,
    waist: waistUm(params.spotUm, params.defocusUm),
    rayleigh: rayleighUm(params.spotUm),
    spotEff: doseResult.spot,
    exposedAreaPct: (100 * exposed) / doseResult.dose.length,
  };
}

// Colourise a scalar field into a canvas-friendly RGBA buffer.
export function fieldToImage(field, mode, maxValue) {
  const data = new Uint8ClampedArray(GRID * GRID * 4);
  for (let i = 0; i < field.length; i++) {
    const v = mode === 'dose' ? Math.min(1, field[i] / Math.max(maxValue, 1)) : Math.min(1, field[i]);
    let r, g, b;
    if (mode === 'dose') {
      r = Math.round(20 + 235 * Math.pow(v, 0.75));
      g = Math.round(8 + 205 * Math.pow(v, 1.5));
      b = Math.round(60 + 195 * Math.pow(v, 3));
    } else if (mode === 'height') {
      r = Math.round(20 + 200 * (1 - v));
      g = Math.round(110 + 120 * v);
      b = Math.round(150 + 90 * v);
      if (v < 0.08) {
        r = 212; g = 175; b = 110; // developed substrate
      }
    } else {
      r = Math.round(255 * v); g = Math.round(255 * v); b = 255;
    }
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}
