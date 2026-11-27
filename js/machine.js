import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { COMPONENTS } from './config.js';
import { GRID } from './process.js';

const MAT = {
  dark: new THREE.MeshStandardMaterial({ color: 0x27313d, metalness: 0.75, roughness: 0.38 }),
  aluminium: new THREE.MeshStandardMaterial({ color: 0x9aa8b6, metalness: 0.82, roughness: 0.3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151b24, metalness: 0.35, roughness: 0.6 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.4, roughness: 0.3, emissive: 0x0a4b57 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc98a4b, metalness: 0.85, roughness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, emissive: 0x4a0808 }),
  amber: new THREE.MeshPhysicalMaterial({
    color: 0xffb14d, transparent: true, opacity: 0.14, roughness: 0.12,
    metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  }),
};

function box(w, h, d, x, y, z, material, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(r, h, x, y, z, material, parent, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function edged(mesh, color = 0x4d5b6b) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  mesh.add(edges);
  return mesh;
}

export function createMachine(canvas, hotspotLayer, onHotspotClick) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f16);
  scene.fog = new THREE.Fog(0x0a0f16, 260, 520);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1200);
  camera.position.set(190, 145, 205);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 45;
  controls.maxDistance = 480;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 45, 0);

  scene.add(new THREE.HemisphereLight(0x9fc7ff, 0x1a1208, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(120, 220, 140);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -160;
  key.shadow.camera.right = 160;
  key.shadow.camera.top = 160;
  key.shadow.camera.bottom = -160;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6ea8ff, 0.7);
  fill.position.set(-160, 90, -120);
  scene.add(fill);
  const uvLight = new THREE.PointLight(0xa060ff, 2.2, 120, 2);
  uvLight.position.set(0, 70, 0);
  scene.add(uvLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x0d141d, roughness: 0.95, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(900, 60, 0x1b3442, 0x14242f);
  grid.position.y = -1.9;
  scene.add(grid);

  const machine = new THREE.Group();
  scene.add(machine);

  // 2020 extrusion frame and base plate
  edged(box(140, 6, 120, 0, 3, 0, MAT.dark, machine));
  for (const x of [-67, 67]) {
    for (const z of [-57, 57]) edged(box(6, 110, 6, x, 59, z, MAT.aluminium, machine));
  }
  for (const z of [-57, 57]) {
    edged(box(140, 6, 6, 0, 112, z, MAT.aluminium, machine));
    edged(box(140, 6, 6, 0, 8, z, MAT.aluminium, machine));
  }
  for (const x of [-67, 67]) {
    edged(box(6, 6, 120, x, 112, 0, MAT.aluminium, machine));
  }

  // X carriage: rails, lead screw, NEMA 17
  edged(box(96, 5, 92, 0, 12, 0, MAT.dark, machine));
  for (const z of [-30, 30]) edged(box(86, 3, 5, 0, 16, z, MAT.aluminium, machine));
  const screwX = cylinder(2.4, 84, 0, 16, 0, MAT.copper, machine, 16);
  screwX.rotation.z = Math.PI / 2;
  for (const x of [-44, 44]) cylinder(4, 6, x, 16, 0, MAT.aluminium, machine, 20).rotation.z = Math.PI / 2;
  const motorX = edged(box(17, 17, 17, -53, 16, 0, MAT.black, machine), 0x3d4b5a);
  box(19, 2, 19, -53, 25, 0, MAT.aluminium, machine);

  const stageX = new THREE.Group();
  stageX.position.set(0, 0, 0);
  machine.add(stageX);
  edged(box(52, 4, 56, 0, 20, 0, MAT.aluminium, stageX));
  for (const x of [-19, 19]) edged(box(4, 3, 48, x, 23, 0, MAT.aluminium, stageX));
  const screwY = cylinder(2.2, 46, 0, 23, 0, MAT.copper, stageX, 14);
  screwY.rotation.x = Math.PI / 2;
  const motorY = edged(box(16, 16, 16, 0, 23, -30, MAT.black, stageX), 0x3d4b5a);
  box(18, 2, 18, 0, 23, -38, MAT.aluminium, stageX);

  const stageY = new THREE.Group();
  stageX.add(stageY);
  edged(box(38, 4, 38, 0, 27, 0, MAT.aluminium, stageY));
  cylinder(20, 4, 0, 31, 0, MAT.dark, stageY, 64);
  cylinder(18.4, 1, 0, 33.2, 0, MAT.aluminium, stageY, 64);

  // Resist-coated wafer: texture is updated by the process solver.
  const waferCanvas = document.createElement('canvas');
  waferCanvas.width = GRID;
  waferCanvas.height = GRID;
  const waferCtx = waferCanvas.getContext('2d');
  waferCtx.fillStyle = '#1d5d75';
  waferCtx.fillRect(0, 0, GRID, GRID);
  const waferTexture = new THREE.CanvasTexture(waferCanvas);
  waferTexture.colorSpace = THREE.SRGBColorSpace;
  waferTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const waferMaterial = new THREE.MeshStandardMaterial({
    map: waferTexture, bumpMap: waferTexture, bumpScale: 0.35,
    metalness: 0.25, roughness: 0.28, side: THREE.DoubleSide,
  });
  const wafer = new THREE.Mesh(new THREE.CircleGeometry(15, 96), waferMaterial);
  wafer.rotation.x = -Math.PI / 2;
  wafer.position.y = 33.9;
  wafer.receiveShadow = true;
  stageY.add(wafer);
  const waferRim = new THREE.Mesh(
    new THREE.TorusGeometry(15, 0.35, 8, 96),
    new THREE.MeshStandardMaterial({ color: 0xd8e3ee, metalness: 0.9, roughness: 0.2 })
  );
  waferRim.rotation.x = Math.PI / 2;
  waferRim.position.y = 33.9;
  stageY.add(waferRim);

  // Optical head, heatsink, voice-coil lens and QPD
  const head = new THREE.Group();
  machine.add(head);
  edged(box(30, 8, 30, 0, 100, 0, MAT.dark, head));
  edged(box(24, 3, 30, 0, 104, -16, MAT.aluminium, head));
  cylinder(9, 24, 0, 86, 0, MAT.aluminium, head, 40);
  for (let i = 0; i < 6; i++) cylinder(11, 1.1, 0, 78 + i * 3.6, 0, MAT.dark, head, 40);
  const lensGroup = new THREE.Group();
  head.add(lensGroup);
  cylinder(6.5, 3, 0, 70, 0, MAT.black, lensGroup, 32);
  cylinder(4.2, 1.4, 0, 68, 0, new THREE.MeshPhysicalMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.75, roughness: 0.05 }), lensGroup, 32);
  cylinder(8, 2, 0, 74, 0, MAT.copper, lensGroup, 32);
  const qpd = edged(box(10, 6, 10, 13, 82, -10, MAT.black, head), 0x7030a0);
  box(6, 0.4, 6, 13, 85.2, -10, MAT.accent, head);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xa77bff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beamGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x6d3bff, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beam = cylinder(0.55, 35, 0, 51, 0, beamMaterial, head, 12);
  const beamGlow = cylinder(2.1, 35, 0, 51, 0, beamGlowMaterial, head, 12);
  beam.visible = false;
  beamGlow.visible = false;

  // Enclosure panels + hinged amber lid
  const enclosureGroup = new THREE.Group();
  machine.add(enclosureGroup);
  edged(box(1.5, 108, 118, -69, 58, 0, MAT.amber, enclosureGroup), 0xffb14d);
  edged(box(1.5, 108, 118, 69, 58, 0, MAT.amber, enclosureGroup), 0xffb14d);
  edged(box(138, 108, 1.5, 0, 58, -59, MAT.amber, enclosureGroup), 0xffb14d);
  const frontPanel = edged(box(138, 108, 1.5, 0, 58, 59, MAT.amber, enclosureGroup), 0xffb14d);
  frontPanel.material = MAT.amber;

  const lid = new THREE.Group();
  lid.position.set(0, 112, -59);
  enclosureGroup.add(lid);
  const lidPanel = edged(box(138, 2, 118, 0, 0, 59, MAT.amber, lid), 0xffb14d);
  box(10, 4, 4, 0, -2, 114, MAT.aluminium, lid);

  const interlock = edged(box(9, 7, 5, 62, 104, 57, MAT.black, machine), 0xffb14d);
  const interlockLed = cylinder(1.4, 1, 62, 108.2, 57, MAT.accent, machine, 16);

  // Front control panel: E-stop and status screen
  box(30, 20, 3, -42, 62, 61, MAT.black, machine);
  const estop = cylinder(4.5, 3, -48, 64, 64, MAT.red, machine, 24);
  estop.rotation.x = Math.PI / 2;
  const screen = box(18, 10, 1, -36, 60, 63.5, new THREE.MeshStandardMaterial({ color: 0x062231, emissive: 0x063d4d }), machine);
  screen.rotation.x = 0;

  // Mini fume extractor
  box(34, 26, 16, -38, 70, -52, MAT.dark, machine);
  cylinder(5, 30, -38, 95, -52, MAT.aluminium, machine, 20);
  box(26, 18, 2, -38, 70, -43, MAT.black, machine);

  // Hotspot overlays
  const hotspots = [];
  const hotspotDefs = {
    head: [0, 96, 0], stage: [-14, 21, 32], wafer: [0, 34, 0],
    lid: [38, 114, 24], interlock: [62, 106, 57], motor: [-53, 17, 0], qpd: [13, 83, -10],
  };
  for (const [key, pos] of Object.entries(hotspotDefs)) {
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.type = 'button';
    el.innerHTML = `<span class="hotspot-dot"></span><span class="hotspot-label">${COMPONENTS[key].title}</span>`;
    el.addEventListener('click', () => onHotspotClick(key));
    hotspotLayer.appendChild(el);
    hotspots.push({ key, pos: new THREE.Vector3(...pos), el });
  }

  const viewPresets = {
    overview: { pos: [190, 145, 205], target: [0, 45, 0] },
    head: { pos: [62, 116, 78], target: [0, 72, 0] },
    stage: { pos: [70, 62, 86], target: [0, 26, 0] },
    top: { pos: [0, 250, 0.1], target: [0, 20, 0] },
    enclosure: { pos: [205, 90, 150], target: [0, 58, 0] },
  };
  let tween = null;
  let laserOn = false;
  let lidOpen = false;

  function setView(name) {
    const p = viewPresets[name] || viewPresets.overview;
    tween = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...p.pos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...p.target),
    };
  }

  function setStagePosition(xMm, yMm) {
    stageX.position.x = THREE.MathUtils.clamp(xMm, -24, 24);
    // The wafer texture's top row is +Y in the field, which maps to world -Z.
    stageY.position.z = THREE.MathUtils.clamp(-yMm, -18, 18);
  }

  function setLaser(on) {
    laserOn = on;
    const visible = on && !lidOpen;
    beam.visible = visible;
    beamGlow.visible = visible;
    uvLight.intensity = visible ? 5 : 0.35;
  }

  function setLid(open) {
    lidOpen = open;
    lid.rotation.x = open ? -1.15 : 0;
    setLaser(laserOn);
  }

  function setEStop(pressed) {
    estop.material = pressed ? MAT.red : MAT.dark;
  }

  function setEnclosureVisible(visible) {
    enclosureGroup.visible = visible;
  }

  function setFocus(defocusUm) {
    lensGroup.position.y = defocusUm * 0.022;
    const top = 68 + lensGroup.position.y;
    const bottom = 34;
    const len = top - bottom;
    beam.scale.y = len / 35;
    beamGlow.scale.y = len / 35;
    beam.position.y = (top + bottom) / 2;
    beamGlow.position.y = (top + bottom) / 2;
  }

  function setWaferField(imageData) {
    waferCtx.putImageData(new ImageData(imageData, GRID, GRID), 0, 0);
    waferTexture.needsUpdate = true;
  }

  function updateHotspots() {
    const rect = canvas.getBoundingClientRect();
    for (const h of hotspots) {
      const p = h.pos.clone().project(camera);
      const visible = p.z < 1 && p.x > -1.2 && p.x < 1.2 && p.y > -1.2 && p.y < 1.2;
      h.el.style.display = visible ? 'flex' : 'none';
      if (visible) {
        h.el.style.left = `${((p.x + 1) / 2) * rect.width}px`;
        h.el.style.top = `${((-p.y + 1) / 2) * rect.height}px`;
      }
    }
  }

  function resize() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    if (tween) {
      tween.t = Math.min(1, tween.t + 0.045);
      const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    updateHotspots();
  }

  resize();
  return {
    scene, camera, renderer, controls, machine,
    setView, setStagePosition, setLaser, setLid, setEStop, setEnclosureVisible, setFocus,
    setWaferField, resize, render,
    get lidOpen() { return lidOpen; },
    get laserOn() { return laserOn; },
  };
}
