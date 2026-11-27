import { MACHINE, MATERIALS } from './config.js';
import { buildJob, parseGcode } from './patterns.js';
import {
  spinThicknessUm, computeDoseMap, developMap, estimateMetrics,
  fieldToImage, qpdSignal,
} from './process.js';
import { createMachine } from './machine.js';
import { createUI } from './ui.js';

const params = {
  rpm: 3000, viscosity: 40, solids: 10, spinTime: 30,
  softBakeC: 95, softBakeS: 60,
  material: 'Standard photoresist', tone: 'positive',
  laserMw: MACHINE.laserRatedMw, dutyPct: 1, speedMmS: 100,
  spotUm: 2, defocusUm: 0, stageErrorUm: 1.5,
  doseThreshold: MATERIALS['Standard photoresist'].dose,
  gamma: 4, developerPct: 100, devTimeS: 35,
};

let job = buildJob('lines');
let thickness = 0;
let doseResult = null;
let developed = null;
let metrics = null;
let waferImage = null;
let lidClosed = true;
let estop = false;
let animSpeed = 1;
let running = false;
let dirty = false;
let ready = false;
let laserFiring = false;
let path = [];
let pathIndex = 0;
let segmentT = 0;
let traversed = 0;
let totalLength = 0;

const machine = createMachine(
  document.querySelector('#scene'),
  document.querySelector('#hotspots'),
  (key) => ui.showComponent(key)
);

const ui = createUI({
  onParam(key, value) {
    params[key] = value;
    if (ready) dirty = true; // coalesce rapid slider input into one solve per frame
  },
  onView(name) { machine.setView(name); },
  onLid(open) {
    lidClosed = !open;
    machine.setLid(!lidClosed);
    if (!lidClosed) {
      running = false;
      laserFiring = false;
      ui.log('Lid opened — interlock cut laser power and paused job', 'warn');
    } else {
      ui.log('Lid closed — interlock armed');
    }
    refreshSafety();
  },
  onEnclosure(visible) { machine.setEnclosureVisible(visible); },
  onEStop(pressed) {
    estop = pressed;
    machine.setEStop(pressed);
    if (pressed) {
      running = false;
      laserFiring = false;
      ui.log('EMERGENCY STOP pressed — laser disabled', 'warn');
    } else ui.log('E-stop released');
    refreshSafety();
  },
  onMaterial(name) {
    params.material = name;
    params.doseThreshold = MATERIALS[name].dose;
    ui.syncParams(params);
    ui.log(`Material: ${name} · Dth ${params.doseThreshold} mJ/cm²`);
    dirty = true;
  },
  onTone(tone) {
    params.tone = tone;
    ui.log(`Resist tone: ${tone}`);
    dirty = true;
  },
  onPattern(key) {
    job = buildJob(key);
    ui.setPattern(key, job.description);
    ui.setGcode(job.gcode);
    preparePath();
    ui.log(`Loaded pattern: ${key} · ${job.segments.length} moves`);
    dirty = true;
  },
  onPlay() {
    if (!safe()) {
      ui.log('Cannot run: lid open or E-stop active', 'warn');
      return;
    }
    if (pathIndex >= path.length) resetPath();
    running = true;
    ui.log('Job started — stage scanning toolpath');
    refreshSafety();
  },
  onPause() {
    running = false;
    laserFiring = false;
    machine.setLaser(false);
    ui.log('Job paused');
    refreshSafety();
  },
  onReset() {
    running = false;
    laserFiring = false;
    resetPath();
    machine.setLaser(false);
    ui.setProgress(0);
    ui.log('Stage returned to origin');
    refreshSafety();
  },
  onSpeed(value) { animSpeed = value; },
  onAutofocus() { runAutofocus(); },
});

function safe() {
  return lidClosed && !estop;
}

function refreshSafety() {
  ui.setStatus({
    interlock: lidClosed,
    laser: laserFiring && safe(),
    running,
    estop,
  });
  machine.setLaser(laserFiring && safe());
}

function recompute() {
  thickness = spinThicknessUm(params.rpm, params.viscosity, params.solids, params.spinTime);
  doseResult = computeDoseMap(job.segments, params);
  developed = developMap(doseResult.dose, thickness, params);
  metrics = estimateMetrics(job.segments, params, doseResult, developed);

  waferImage = fieldToImage(developed.remaining, 'height');
  machine.setWaferField(waferImage);
  machine.setFocus(params.defocusUm);

  const doseImage = fieldToImage(
    doseResult.dose, 'dose', Math.max(doseResult.peak, params.doseThreshold * 2)
  );
  const heightImage = fieldToImage(developed.remaining, 'height');
  ui.paintField(document.querySelector('#doseCanvas'), doseImage);
  ui.paintField(document.querySelector('#heightCanvas'), heightImage);
  ui.drawContrast(params, thickness);

  const q = qpdSignal(params.defocusUm, params.spotUm);
  ui.drawQpd(q);
  ui.drawFes((z) => qpdSignal(z, params.spotUm).fes, params.defocusUm);

  ui.setReadouts(metrics, { thickness, params, safe: safe(), laserOn: laserFiring });
  refreshSafety();
}

function preparePath() {
  path = [];
  let x = 0;
  let y = 0;
  for (const cmd of parseGcode(job.gcode)) {
    if (cmd.type !== 'move') continue;
    const len = Math.hypot(cmd.x - x, cmd.y - y);
    if (len > 0) path.push({ x1: x, y1: y, x2: cmd.x, y2: cmd.y, laser: cmd.laser, len });
    x = cmd.x;
    y = cmd.y;
  }
  totalLength = path.reduce((sum, p) => sum + p.len, 0);
  ui.setJob(totalLength, totalLength / Math.min(params.speedMmS, 6000));
}

function resetPath() {
  pathIndex = 0;
  segmentT = 0;
  traversed = 0;
  machine.setStagePosition(0, 0);
}

function advanceJob(dt) {
  if (!running || !safe() || !path.length) return;
  let budget = 12 * animSpeed * dt; // visual mm/s
  while (budget > 0 && pathIndex < path.length) {
    const seg = path[pathIndex];
    const remain = seg.len * (1 - segmentT);
    if (budget < remain) {
      segmentT += budget / seg.len;
      traversed += budget;
      budget = 0;
    } else {
      budget -= remain;
      traversed += remain;
      pathIndex++;
      segmentT = 0;
    }
    const idx = Math.min(pathIndex, path.length - 1);
    const s = path[idx];
    const t = pathIndex >= path.length ? 1 : segmentT;
    machine.setStagePosition(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t);
    laserFiring = pathIndex < path.length && s.laser && safe();
  }
  machine.setLaser(laserFiring && safe());
  ui.setProgress(totalLength ? traversed / totalLength : 0);
  ui.setStatus({ interlock: lidClosed, laser: laserFiring && safe(), running, estop });
  if (pathIndex >= path.length) {
    running = false;
    laserFiring = false;
    machine.setLaser(false);
    ui.log(`Job complete · ${totalLength.toFixed(1)} mm scanned`);
    refreshSafety();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAutofocus() {
  if (running) {
    ui.log('Pause the job before autofocus', 'warn');
    return;
  }
  ui.log('Autofocus: acquiring FES');
  for (let i = 0; i < 16; i++) {
    const q = qpdSignal(params.defocusUm, params.spotUm);
    if (Math.abs(q.fes) < 0.02) break;
    const step = Math.max(-9, Math.min(9, q.fes * 9));
    params.defocusUm = Math.max(-60, Math.min(60, params.defocusUm - step));
    ui.syncParams(params);
    recompute();
    await wait(110);
  }
  const q = qpdSignal(params.defocusUm, params.spotUm);
  ui.log(`Autofocus locked at ${params.defocusUm.toFixed(1)} µm · FES ${q.fes.toFixed(3)}`);
}

const clock = { last: performance.now(), frames: 0, hudAt: performance.now() };
function loop(now) {
  const dt = Math.min(0.05, (now - clock.last) / 1000);
  clock.last = now;
  if (dirty) {
    recompute();
    dirty = false;
  }
  advanceJob(dt);
  machine.render();

  clock.frames++;
  if (now - clock.hudAt >= 500) {
    const fps = Math.round((clock.frames * 1000) / (now - clock.hudAt));
    const stats = machine.getStats();
    document.querySelector('#perfHud').textContent =
      `${fps} fps · ${stats.calls} draws · ${stats.pixelRatio.toFixed(1)}×`;
    clock.frames = 0;
    clock.hudAt = now;
  }
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => machine.resize());

ui.setMaterial(params.material);
ui.setTone(params.tone);
ui.setPattern('lines', job.description);
ui.setGcode(job.gcode);
ui.syncParams(params);
preparePath();
recompute();
ready = true;
requestAnimationFrame(loop);
