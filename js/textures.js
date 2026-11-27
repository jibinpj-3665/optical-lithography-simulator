import * as THREE from 'three';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

export function brushedMetalTexture(base = '#9aa8b6', seed = 7) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  const rand = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const y = rand() * 256;
    const light = rand() > 0.5;
    ctx.strokeStyle = light ? `rgba(255,255,255,${0.02 + rand() * 0.08})` : `rgba(0,0,0,${0.02 + rand() * 0.07})`;
    ctx.lineWidth = rand() * 1.4 + 0.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + (rand() - 0.5) * 3);
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 9;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, 1, 1);
}

export function gridPlateTexture() {
  const c = canvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(150,180,200,.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(150,180,200,.32)';
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
  }
  const rand = seeded(31);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.12})`;
    ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  return finish(c, 6, 5);
}

export function warningLabelTexture() {
  const c = canvas(512, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.moveTo(0, 128); ctx.lineTo(128, 0); ctx.lineTo(40, 0); ctx.lineTo(0, 40); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(512, 0); ctx.lineTo(384, 128); ctx.lineTo(472, 128); ctx.lineTo(512, 88); ctx.fill();
  ctx.fillStyle = '#0b0b0b';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('405 nm LASER · CLASS 4', 256, 60);
  ctx.font = 'bold 20px monospace';
  ctx.fillText('INVISIBLE / UV HAZARD', 256, 96);
  return finish(c);
}

export function motorLabelTexture() {
  const c = canvas(256, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a222c';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#3d4b5a';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#9fb3c4';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NEMA 17', 128, 52);
  ctx.font = '18px monospace';
  ctx.fillText('1.8° / STEP', 128, 84);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(96, 100, 64, 6);
  return finish(c);
}
