import { MATERIALS, SCALES, BOM, SAFETY, COMPONENTS } from './config.js';
import { PATTERNS } from './patterns.js';
import { GRID } from './process.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

export function createUI(handlers) {
  const materialSelect = $('#materialSelect');
  const patternSelect = $('#patternSelect');
  const logEl = $('#log');
  const offscreen = document.createElement('canvas');
  offscreen.width = GRID;
  offscreen.height = GRID;
  const offCtx = offscreen.getContext('2d');

  for (const [name, data] of Object.entries(MATERIALS)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    materialSelect.appendChild(opt);
  }
  for (const key of Object.keys(PATTERNS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key[0].toUpperCase() + key.slice(1);
    patternSelect.appendChild(opt);
  }

  $('#scaleTable').innerHTML = SCALES.map((s) => `
    <div class="row"><strong>${s.name}</strong><span>Goal: ${s.goal}</span><span>Resolution: ${s.resolution}</span>
    <span>Controller: ${s.controller}</span><span>Key challenge: ${s.challenge}</span></div>`).join('');
  $('#materialTable').innerHTML = Object.entries(MATERIALS).map(([name, m]) => `
    <div class="row"><strong>${name}</strong><span>${m.note}</span><span>Threshold ≈ ${m.dose} mJ/cm² · film ≈ ${m.thickness} µm</span></div>`).join('');
  $('#safetyList').innerHTML = SAFETY.map((s) => `<li>${s}</li>`).join('');
  $('#bomTable').innerHTML = BOM.map((group) => `
    <div class="bom-category"><h4>${group.category}</h4>
      ${group.items.map(([name, lo, hi]) => `<div class="bom-row"><span>${name}</span><strong>₹${lo}–${hi}</strong></div>`).join('')}
      <div class="bom-total"><span>Subtotal</span><span>₹${group.items.reduce((a, i) => a + i[1], 0)} – ₹${group.items.reduce((a, i) => a + i[2], 0)}</span></div>
    </div>`).join('');

  function bindTabs() {
    $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
    }));
  }

  function selectTab(name) {
    const tab = $(`.tab[data-tab="${name}"]`);
    if (tab) tab.click();
  }

  function bindParams() {
    $$('[data-param]').forEach((input) => {
      const key = input.dataset.param;
      const output = $(`[data-out="${key}"]`);
      const update = () => {
        if (output) output.textContent = input.value + (key === 'dutyPct' ? ' %' : '');
        handlers.onParam(key, parseFloat(input.value));
      };
      input.addEventListener('input', update);
      update();
    });
  }

  function syncParams(params) {
    $$('[data-param]').forEach((input) => {
      const key = input.dataset.param;
      if (params[key] === undefined) return;
      input.value = params[key];
      const output = $(`[data-out="${key}"]`);
      if (output) output.textContent = params[key] + (key === 'dutyPct' ? ' %' : '');
    });
  }

  function bindControls() {
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => {
      $$('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
      handlers.onView(b.dataset.view);
    }));
    $('#lidToggle').addEventListener('change', (e) => handlers.onLid(!e.target.checked));
    $('#enclosureToggle').addEventListener('change', (e) => handlers.onEnclosure(e.target.checked));
    $('#estopToggle').addEventListener('change', (e) => handlers.onEStop(e.target.checked));
    materialSelect.addEventListener('change', () => handlers.onMaterial(materialSelect.value));
    $('#toneSelect').addEventListener('change', (e) => handlers.onTone(e.target.value));
    patternSelect.addEventListener('change', () => handlers.onPattern(patternSelect.value));
    $('#playBtn').addEventListener('click', () => handlers.onPlay());
    $('#pauseBtn').addEventListener('click', () => handlers.onPause());
    $('#resetBtn').addEventListener('click', () => handlers.onReset());
    $('#autofocusBtn').addEventListener('click', () => handlers.onAutofocus());
    $('#animSpeed').addEventListener('input', (e) => {
      $('#speedOut').textContent = `${parseFloat(e.target.value).toFixed(1)}×`;
      handlers.onSpeed(parseFloat(e.target.value));
    });
    $('#copyGcode').addEventListener('click', async () => {
      const text = $('#gcode').value;
      try {
        await navigator.clipboard.writeText(text);
        log('G-code copied to clipboard');
      } catch {
        $('#gcode').select();
        document.execCommand('copy');
        log('G-code copied (fallback)');
      }
    });
    $('#clearLog').addEventListener('click', () => { logEl.innerHTML = ''; });
    $('#helpBtn').addEventListener('click', () => { $('#helpModal').hidden = false; });
    $('#closeHelp').addEventListener('click', () => { $('#helpModal').hidden = true; });
    $('#helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') $('#helpModal').hidden = true;
    });
  }

  function log(message, kind = '') {
    const div = document.createElement('div');
    const t = new Date().toLocaleTimeString([], { hour12: false });
    div.innerHTML = `<b>${t}</b> ${message}`;
    if (kind) div.className = kind;
    logEl.prepend(div);
    while (logEl.children.length > 60) logEl.lastChild.remove();
  }

  function setReadouts(m, state) {
    const film = $('#rThickness');
    film.textContent = `${state.thickness.toFixed(2)} µm`;
    $('#rSpot').textContent = `${m.spotEff.toFixed(2)} µm`;
    $('#rDose').textContent = `${m.peakDose.toFixed(1)} mJ/cm²`;
    $('#rRatio').textContent = `${m.doseRatio.toFixed(2)}×`;
    $('#rRatio').style.color = m.doseRatio >= 1 ? 'var(--green)' : 'var(--amber)';
    const cleared = m.maxHeight > 0 ? Math.max(0, 100 * (1 - m.minHeight / m.maxHeight)) : 0;
    $('#rCleared').textContent = `${cleared.toFixed(0)} %`;
    $('#rCd').textContent = `${m.cd.toFixed(2)} µm`;
    $('#rArea').textContent = `${m.exposedAreaPct.toFixed(1)} %`;
    $('#rLaser').textContent = state.safe && state.laserOn ? 'ON' : 'OFF';
    $('#rLaser').style.color = state.safe && state.laserOn ? 'var(--violet)' : 'var(--muted)';

    $('#vFilm').textContent = `${state.thickness.toFixed(2)} µm`;
    $('#vDose').textContent = `${m.peakDose.toFixed(0)} mJ/cm²`;
    $('#vCd').textContent = `${m.cd.toFixed(2)} µm`;
    $('#vFocus').textContent = `${state.params.defocusUm >= 0 ? '+' : ''}${state.params.defocusUm.toFixed(0)} µm`;
    $('#coatThickness').textContent = `${state.thickness.toFixed(2)} µm`;
    $('#exposeDose').textContent = `${m.peakDose.toFixed(1)} mJ/cm²`;
    $('#exposeRatio').textContent = `${m.doseRatio.toFixed(2)}×`;
    $('#devHeight').textContent = `${m.minHeight.toFixed(2)} – ${m.maxHeight.toFixed(2)} µm`;
    $('#rayleighValue').textContent = `${m.rayleigh.toFixed(1)} µm`;
  }

  function paintField(canvas, imageData) {
    offCtx.putImageData(new ImageData(imageData, GRID, GRID), 0, 0);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  }

  function drawContrast(params, filmUm) {
    const c = $('#contrastCanvas');
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = '#070d13'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1b2b39'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(40, i * h / 4); ctx.lineTo(w - 10, i * h / 4); ctx.stroke();
    }
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath();
    const rDark = 0.0025 * Math.exp(-(params.softBakeC / 80) * (params.softBakeS / 60) * 0.35);
    const rMax = 0.5 * params.developerPct / 100;
    for (let px = 0; px <= w - 50; px++) {
      const rel = Math.pow(10, -1 + (px / (w - 50)) * 2); // 0.1x .. 10x threshold
      const pow = Math.pow(rel, params.gamma);
      const rate = params.tone === 'negative' ? rDark + rMax / (1 + pow) : rDark + rMax * pow / (1 + pow);
      const remain = Math.max(0, 1 - (rate * params.devTimeS) / Math.max(filmUm, 0.1));
      const py = 10 + (1 - remain) * (h - 24);
      px === 0 ? ctx.moveTo(40 + px, py) : ctx.lineTo(40 + px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = '#a78bfa'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(40 + (w - 50) / 2, 8); ctx.lineTo(40 + (w - 50) / 2, h - 8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7f92a6'; ctx.font = '10px monospace';
    ctx.fillText('0.1×', 38, h - 4); ctx.fillText('Dth', 40 + (w - 50) / 2 - 8, h - 4); ctx.fillText('10×', w - 32, h - 4);
    ctx.fillText('remaining', 4, 14); ctx.fillText('0', 4, h - 6);
  }

  function drawQpd(q) {
    const c = $('#qpdCanvas');
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = '#070d13'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 - 6;
    const vals = [q.a, q.b, q.c, q.d];
    const labels = ['A', 'B', 'C', 'D'];
    const positions = [[cx - 62, cy - 62], [cx + 4, cy - 62], [cx - 62, cy + 4], [cx + 4, cy + 4]];
    for (let i = 0; i < 4; i++) {
      const v = Math.max(0, Math.min(1, vals[i] / 1.6));
      ctx.fillStyle = `rgb(${Math.round(15 + 120 * v)},${Math.round(30 + 90 * v)},${Math.round(55 + 150 * v)})`;
      ctx.fillRect(positions[i][0], positions[i][1], 58, 58);
      ctx.strokeStyle = '#223648'; ctx.strokeRect(positions[i][0], positions[i][1], 58, 58);
      ctx.fillStyle = '#cfe0f0'; ctx.font = '11px monospace';
      ctx.fillText(labels[i], positions[i][0] + 6, positions[i][1] + 15);
    }
    const s = Math.max(0.4, Math.min(2.6, q.aspect));
    ctx.save();
    ctx.translate(cx, cy - 33);
    ctx.rotate(q.x >= 0 ? Math.PI / 4 : -Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 32 * Math.sqrt(s), 32 / Math.sqrt(s), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167,139,250,.45)'; ctx.fill();
    ctx.strokeStyle = '#d8c9ff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#7f92a6'; ctx.font = '10px monospace';
    ctx.fillText(`FES = ${q.fes.toFixed(3)}   spot aspect = ${q.aspect.toFixed(2)}`, 10, h - 8);
    $('#fesValue').textContent = q.fes.toFixed(3);
  }

  function drawFes(fesFn, defocus) {
    const c = $('#fesCanvas');
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = '#070d13'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1b2b39';
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const z = -60 + (px / w) * 120;
      const y = h / 2 - fesFn(z) * (h / 2 - 16);
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.stroke();
    const mx = ((defocus + 60) / 120) * w;
    const my = h / 2 - fesFn(defocus) * (h / 2 - 16);
    ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(mx, my, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#7f92a6'; ctx.font = '10px monospace';
    ctx.fillText('-60 µm', 6, h - 6); ctx.fillText('0', w / 2 - 4, h - 6); ctx.fillText('+60 µm', w - 46, h - 6);
  }

  function setGcode(text) { $('#gcode').value = text; }
  function setPattern(key, description) {
    patternSelect.value = key;
    $('#patternDesc').textContent = description;
  }
  function setJob(lengthMm, seconds) {
    $('#jobLength').textContent = `${lengthMm.toFixed(1)} mm`;
    $('#jobTime').textContent = `${seconds.toFixed(2)} s`;
  }
  function setProgress(fraction) { $('#jobProgress').style.width = `${Math.round(fraction * 100)}%`; }

  function setStatus({ interlock, laser, running, estop }) {
    const i = $('#pillInterlock');
    i.className = `pill ${interlock ? 'ok' : 'bad'}`;
    i.innerHTML = `<i></i> ${interlock ? 'Interlock OK' : 'Lid open'}`;
    const l = $('#pillLaser');
    l.className = `pill ${laser ? 'live' : ''}`;
    l.innerHTML = `<i></i> ${laser ? 'Laser firing' : 'Laser off'}`;
    const s = $('#pillStage');
    s.className = `pill ${running ? 'live' : ''}`;
    s.innerHTML = `<i></i> ${running ? 'Stage scanning' : (estop ? 'E-stop' : 'Stage idle')}`;
  }

  function showComponent(key) {
    const c = COMPONENTS[key];
    if (!c) return;
    $('#componentTitle').textContent = c.title;
    $('#componentText').textContent = c.text;
    selectTab('machine');
  }

  bindTabs();
  bindControls();
  bindParams();
  log('Simulator ready — model loaded from project documents');
  return {
    log, syncParams, setReadouts, paintField, drawContrast, drawQpd, drawFes,
    setGcode, setPattern, setJob, setProgress, setStatus, showComponent, selectTab,
    setMaterial: (name) => { materialSelect.value = name; },
    setTone: (tone) => { $('#toneSelect').value = tone; },
    getMaterial: () => materialSelect.value,
  };
}
