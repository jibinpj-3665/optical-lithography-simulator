import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { COMPONENTS } from './config.js';
import { GRID } from './process.js';
import {
  brushedMetalTexture, gridPlateTexture, warningLabelTexture, motorLabelTexture,
} from './textures.js';

const brushed = brushedMetalTexture();
const darkBrushed = brushedMetalTexture('#3d4855', 19);
const gridTex = gridPlateTexture();
const warnTex = warningLabelTexture();
const motorTex = motorLabelTexture();

const MAT = {
  dark: new THREE.MeshStandardMaterial({ color: 0x27313d, metalness: 0.72, roughness: 0.42, map: darkBrushed }),
  aluminium: new THREE.MeshStandardMaterial({ color: 0xa9b7c5, metalness: 0.92, roughness: 0.26, map: brushed }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd2dbe3, metalness: 0.95, roughness: 0.18 }),
  black: new THREE.MeshStandardMaterial({ color: 0x161d27, metalness: 0.45, roughness: 0.55 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0b0f14, metalness: 0.05, roughness: 0.92 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.35, roughness: 0.3, emissive: 0x0a4b57 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xd39a5c, metalness: 0.95, roughness: 0.24 }),
  red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.32, emissive: 0x3a0606 }),
  redDark: new THREE.MeshStandardMaterial({ color: 0x8a1d1d, roughness: 0.5, emissive: 0x180202 }),
  ledOk: new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.8 }),
  ledBad: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.2 }),
  grid: new THREE.MeshStandardMaterial({ color: 0x9fb0c0, metalness: 0.8, roughness: 0.38, map: gridTex }),
  amber: new THREE.MeshPhysicalMaterial({
    color: 0xffb14d, metalness: 0, roughness: 0.09,
    transmission: 0.42, thickness: 2.5, ior: 1.49,
    transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false,
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

function rbox(w, h, d, r, x, y, z, material, parent) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);
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
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 })
  );
  mesh.add(edges);
  return mesh;
}

function bolt(x, y, z, parent, axis = 'y') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const head = cylinder(1.25, 0.7, 0, 0, 0, MAT.steel, g, 6);
  box(1.7, 0.18, 0.35, 0, 0.36, 0, MAT.dark, g);
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  parent.add(g);
  return g;
}

// A 2020-style beam with T-slot shadows on all four faces. Built along Y then rotated.
function extrusion(length, x, y, z, axis, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  rbox(12, length, 12, 1, 0, 0, 0, MAT.aluminium, g);
  for (const s of [-1, 1]) {
    box(0.5, length - 2, 4.2, s * 6.1, 0, 0, MAT.dark, g);
    box(4.2, length - 2, 0.5, 0, 0, s * 6.1, MAT.dark, g);
    box(0.35, length - 2, 0.7, s * 6.35, 0, 1.6, MAT.steel, g);
    box(0.7, length - 2, 0.35, 1.6, 0, s * 6.35, MAT.steel, g);
  }
  parent.add(g);
  return g;
}

// Lead screw with a real helical thread. The returned group can be spun on local Y.
function threadedRod(length, radius, x, y, z, axis, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  cylinder(radius * 0.72, length, 0, 0, 0, MAT.steel, g, 20);
  const spin = new THREE.Group();
  g.add(spin);
  const pts = [];
  const turns = Math.round(length / 5);
  for (let i = 0; i <= turns * 12; i++) {
    const t = i / (turns * 12);
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(a), -length / 2 + t * length, radius * Math.sin(a)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  spin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, turns * 12, 0.42, 5, false), MAT.copper));
  g.userData.spin = spin;
  parent.add(g);
  return g;
}

function labelPlane(w, h, texture, x, y, z, parent, rotY = 0) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  return mesh;
}

// Bake static decoration into one mesh per material. This keeps the detailed
// frame, rails and fittings but avoids hundreds of separate draw calls.
function mergeStaticMeshes(root, exclusions) {
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const groups = new Map();
  const remove = [];
  const isExcluded = (obj) => {
    let cur = obj;
    while (cur && cur !== root) {
      if (exclusions.has(cur)) return true;
      cur = cur.parent;
    }
    return false;
  };

  root.traverse((obj) => {
    if (!obj.isMesh || obj === root || isExcluded(obj)) return;
    if (!obj.geometry.attributes.position || !obj.geometry.attributes.normal || !obj.geometry.attributes.uv) return;
    let geo = obj.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    geo.applyMatrix4(invRoot.clone().multiply(obj.matrixWorld));
    if (!groups.has(obj.material)) groups.set(obj.material, []);
    groups.get(obj.material).push(geo);
    remove.push(obj);
  });

  for (const obj of remove) obj.parent.remove(obj);
  for (const [material, geos] of groups) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

export function createMachine(canvas, hotspotLayer, onHotspotClick) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090e14);
  scene.fog = new THREE.Fog(0x090e14, 280, 560);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1400);
  camera.position.set(205, 150, 220);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 48;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 46, 0);

  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x1b1208, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(130, 240, 150);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -170;
  key.shadow.camera.right = 170;
  key.shadow.camera.top = 170;
  key.shadow.camera.bottom = -170;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 520;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb0ff, 1.0);
  rim.position.set(-170, 110, -140);
  scene.add(rim);
  const uvLight = new THREE.PointLight(0xa878ff, 0.4, 150, 2);
  uvLight.position.set(0, 70, 0);
  scene.add(uvLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({ color: 0x0c1219, roughness: 0.92, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(1200, 60, 0x1c3a4a, 0x142631);
  grid.position.y = -1.9;
  scene.add(grid);

  const machine = new THREE.Group();
  scene.add(machine);

  // Base plate and frame
  edged(box(146, 6, 126, 0, 3, 0, MAT.grid, machine));
  for (const x of [-68, 68]) for (const z of [-59, 59]) bolt(x, 6.4, z, machine);
  for (const x of [-68, 68]) for (const z of [-59, 59]) extrusion(112, x, 58, z, 'y', machine);
  for (const z of [-59, 59]) {
    extrusion(146, 0, 114, z, 'x', machine);
    extrusion(146, 0, 8, z, 'x', machine);
  }
  for (const x of [-68, 68]) extrusion(126, x, 114, 0, 'z', machine);

  // X axis: rail, threaded rod, motor, carriage
  edged(box(100, 5, 94, 0, 12, 0, MAT.dark, machine));
  for (const z of [-31, 31]) {
    edged(box(88, 3.2, 5, 0, 17, z, MAT.steel, machine));
    box(88, 0.8, 3.2, 0, 18.7, z, MAT.dark, machine);
  }
  const screwX = threadedRod(86, 2.6, 0, 17, 0, 'x', machine);
  for (const x of [-45, 45]) cylinder(4.2, 7, x, 17, 0, MAT.aluminium, machine, 24).rotation.z = Math.PI / 2;

  function makeMotor(x, y, z, rotY, parent) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    rbox(18, 18, 18, 1.6, 0, 0, 0, MAT.black, g);
    for (const sx of [-6.2, 6.2]) for (const sy of [-6.2, 6.2]) bolt(sx, sy, 9.2, g, 'z');
    cylinder(3.2, 6, 0, 0, 11, MAT.steel, g, 20).rotation.x = Math.PI / 2;
    labelPlane(13, 6.5, motorTex, 0, 0, 9.35, g);
    parent.add(g);
    return g;
  }
  const motorX = makeMotor(-55, 17, 0, 0, machine);

  const stageX = new THREE.Group();
  machine.add(stageX);
  edged(box(54, 4, 58, 0, 21, 0, MAT.aluminium, stageX));
  for (const x of [-19, 19]) {
    for (const z of [-31, 31]) rbox(9, 4.5, 7, 1, x, 19.4, z, MAT.dark, stageX);
  }
  for (const x of [-19, 19]) edged(box(4, 3, 50, x, 24, 0, MAT.steel, stageX));
  const screwY = threadedRod(48, 2.3, 0, 24, 0, 'z', stageX);
  const motorY = makeMotor(0, 24, -32, Math.PI / 2, stageX);

  const stageY = new THREE.Group();
  stageX.add(stageY);
  edged(box(40, 4, 40, 0, 28, 0, MAT.aluminium, stageY));
  for (const x of [-14, 14]) for (const z of [-19, 19]) rbox(8, 4, 6, 1, x, 26, z, MAT.dark, stageY);

  // Rotating substrate bed
  const bed = new THREE.Group();
  stageY.add(bed);
  cylinder(21, 4, 0, 32, 0, MAT.dark, bed, 72);
  cylinder(19.4, 1, 0, 34.2, 0, MAT.steel, bed, 72);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(0.9, 0.4, Math.cos(a) * 16, 34.8, Math.sin(a) * 16, MAT.black, bed, 10);
  }

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
    map: waferTexture, bumpMap: waferTexture, bumpScale: 0.45,
    metalness: 0.18, roughness: 0.22, side: THREE.DoubleSide,
    envMapIntensity: 0.9,
  });
  const wafer = new THREE.Mesh(new THREE.CircleGeometry(16, 128), waferMaterial);
  wafer.rotation.x = -Math.PI / 2;
  wafer.position.y = 35.1;
  wafer.receiveShadow = true;
  bed.add(wafer);
  const waferRim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.45, 10, 128),
    MAT.steel
  );
  waferRim.rotation.x = Math.PI / 2;
  waferRim.position.y = 35.1;
  bed.add(waferRim);

  // Drag chain follows the X carriage
  const dragChain = [];
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x1c242e, metalness: 0.25, roughness: 0.7 });
  for (let i = 0; i < 18; i++) {
    const link = rbox(5.5, 3.2, 6, 0.8, 0, 0, 0, chainMat, machine);
    dragChain.push(link);
  }

  // Optical head
  const head = new THREE.Group();
  machine.add(head);
  rbox(34, 9, 34, 1.5, 0, 101, 0, MAT.dark, head);
  rbox(26, 4, 32, 1, 0, 106, -16, MAT.aluminium, head);
  labelPlane(26, 6.5, warnTex, 0, 101, 17.2, head);
  cylinder(9.5, 26, 0, 87, 0, MAT.aluminium, head, 48);
  for (let i = 0; i < 7; i++) cylinder(11.5, 1.2, 0, 77 + i * 3.5, 0, MAT.dark, head, 48);
  const lensGroup = new THREE.Group();
  head.add(lensGroup);
  cylinder(7, 3.5, 0, 70, 0, MAT.black, lensGroup, 40);
  cylinder(4.4, 1.5, 0, 68, 0, new THREE.MeshPhysicalMaterial({
    color: 0xa483ff, metalness: 0.1, roughness: 0.04, transmission: 0.7, thickness: 1,
  }), lensGroup, 40);
  cylinder(8.5, 2.2, 0, 74.5, 0, MAT.copper, lensGroup, 40);
  for (const s of [-1, 1]) cylinder(0.8, 8, s * 6, 72, 0, MAT.steel, lensGroup, 12);
  const qpd = rbox(11, 6.5, 11, 0.8, 14, 83, -11, MAT.black, head);
  box(6.5, 0.4, 6.5, 14, 86.4, -11, MAT.accent, head);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xb28cff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beamGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x6d3bff, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beam = cylinder(0.6, 33, 0, 51, 0, beamMaterial, head, 14);
  const beamGlow = cylinder(2.4, 33, 0, 51, 0, beamGlowMaterial, head, 14);
  beam.visible = false;
  beamGlow.visible = false;
  const focalSpot = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xd8c2ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
  );
  focalSpot.position.y = 35.4;
  focalSpot.visible = false;
  head.add(focalSpot);

  // Enclosure: amber panels, hinged lid, gasket, handle, interlock
  const enclosureGroup = new THREE.Group();
  machine.add(enclosureGroup);
  for (const x of [-70.5, 70.5]) edged(box(2, 110, 122, x, 59, 0, MAT.amber, enclosureGroup), 0xffb14d);
  edged(box(146, 110, 2, 0, 59, -61, MAT.amber, enclosureGroup), 0xffb14d);
  edged(box(146, 110, 2, 0, 59, 61, MAT.amber, enclosureGroup), 0xffb14d);

  const lid = new THREE.Group();
  lid.position.set(0, 114, -61);
  enclosureGroup.add(lid);
  edged(box(146, 2.4, 122, 0, 0, 61, MAT.amber, lid), 0xffb14d);
  box(146, 1.6, 3, 0, -1.8, 2, MAT.rubber, lid);
  for (const x of [-40, 40]) cylinder(4, 12, x, -2, -2, MAT.steel, lid, 24).rotation.z = Math.PI / 2;
  rbox(22, 4, 8, 1.2, 0, -2.5, 116, MAT.black, lid);

  const interlock = rbox(10, 8, 6, 0.8, 63, 106, 58, MAT.black, machine);
  const interlockLed = cylinder(1.5, 1.2, 63, 110.6, 58, MAT.ledOk, machine, 18);

  // Control panel, E-stop, screen, fume extractor with spinning fan
  rbox(34, 22, 4, 1.5, -44, 64, 62, MAT.black, machine);
  const estop = cylinder(5, 3.5, -51, 66, 65.5, MAT.red, machine, 28);
  estop.rotation.x = Math.PI / 2;
  cylinder(6.5, 1, -51, 66, 63.8, MAT.steel, machine, 28).rotation.x = Math.PI / 2;
  const screen = box(18, 10, 1.2, -38, 61, 64.6, new THREE.MeshStandardMaterial({
    color: 0x05202c, emissive: 0x064454, roughness: 0.2, metalness: 0.1,
  }), machine);
  for (let i = 0; i < 3; i++) cylinder(1.4, 1, -45 + i * 4, 55, 64.6, MAT.accent, machine, 16).rotation.x = Math.PI / 2;

  rbox(36, 28, 18, 2, -40, 72, -54, MAT.dark, machine);
  cylinder(5.5, 32, -40, 98, -54, MAT.aluminium, machine, 24);
  const fan = new THREE.Group();
  fan.position.set(-40, 72, -44.5);
  machine.add(fan);
  for (let i = 0; i < 7; i++) {
    const blade = box(3.2, 11, 0.8, 0, 6.5, 0, MAT.aluminium, fan);
    blade.rotation.z = (i / 7) * Math.PI * 2;
    blade.position.set(Math.sin((i / 7) * Math.PI * 2) * 6.5, Math.cos((i / 7) * Math.PI * 2) * 6.5, 0);
  }
  cylinder(2.2, 1.4, 0, 0, 0.8, MAT.black, fan, 20).rotation.x = Math.PI / 2;

  // Hotspot overlays
  const hotspots = [];
  const hotspotDefs = {
    head: { pos: [0, 104, 0] },
    stage: { pos: [-16, 22, 33], parent: stageX },
    wafer: { pos: [0, 36, 0], parent: stageY },
    lid: { pos: [40, 2, 40], parent: lid },
    interlock: { pos: [63, 108, 58] },
    motor: { pos: [-55, 18, 0] },
    qpd: { pos: [14, 84, -11] },
  };
  for (const [key, def] of Object.entries(hotspotDefs)) {
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.type = 'button';
    el.innerHTML = `<span class="hotspot-dot"></span><span class="hotspot-label">${COMPONENTS[key].title}</span>`;
    el.addEventListener('click', () => onHotspotClick(key));
    hotspotLayer.appendChild(el);
    hotspots.push({ key, local: new THREE.Vector3(...def.pos), parent: def.parent, el });
  }

  const viewPresets = {
    overview: { pos: [205, 150, 220], target: [0, 46, 0] },
    head: { pos: [68, 124, 84], target: [0, 76, 0] },
    stage: { pos: [78, 66, 92], target: [0, 27, 0] },
    top: { pos: [0, 270, 0.1], target: [0, 22, 0] },
    enclosure: { pos: [220, 96, 165], target: [0, 60, 0] },
  };
  let tween = null;
  let laserOn = false;
  let lidOpen = false;
  let estopPressed = false;
  let pwm = 0.01;
  let focusTarget = 0;
  let focusCurrent = 0;
  let lidTarget = 0;
  let lidCurrent = 0;
  let spinRpm = 0;
  let lastX = 0;
  let lastY = 0;
  let clockT = 0;

  function setView(name) {
    const p = viewPresets[name] || viewPresets.overview;
    hotspotsDirty = true;
    tween = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...p.pos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...p.target),
    };
  }

  function setStagePosition(xMm, yMm) {
    const x = THREE.MathUtils.clamp(xMm, -24, 24);
    const z = THREE.MathUtils.clamp(-yMm, -18, 18); // field +Y maps to world -Z
    screwX.userData.spin.rotation.y += (x - lastX) * 0.22;
    screwY.userData.spin.rotation.y += (-z - lastY) * 0.22;
    motorX.rotation.y += (x - lastX) * 0.04;
    motorY.rotation.y += (-z - lastY) * 0.04;
    lastX = x;
    lastY = -z;
    stageX.position.x = x;
    stageY.position.z = z;
    hotspotsDirty = true;

    // Drag chain links trace a drooping loop from the fixed anchor to the carriage.
    const anchor = -52;
    const end = x - 22;
    dragChain.forEach((link, i) => {
      const t = i / (dragChain.length - 1);
      link.position.set(
        anchor + (end - anchor) * t,
        21 - Math.sin(t * Math.PI) * 7,
        -43 - Math.sin(t * Math.PI) * 3
      );
      link.rotation.z = Math.cos(t * Math.PI) * 0.25;
    });
  }

  function setLaser(on) {
    laserOn = on;
    const visible = on && !lidOpen;
    beam.visible = visible;
    beamGlow.visible = visible;
    focalSpot.visible = visible;
  }

  function refreshIndicators() {
    const unsafe = lidOpen || estopPressed;
    interlockLed.material = unsafe ? MAT.ledBad : MAT.ledOk;
  }

  function setLid(open) {
    lidOpen = open;
    lidTarget = open ? -1.15 : 0;
    if (open) setLaser(false);
    refreshIndicators();
  }

  function setEStop(pressed) {
    estopPressed = pressed;
    estop.material = pressed ? MAT.redDark : MAT.red;
    estop.position.z = pressed ? 64.3 : 65.5;
    refreshIndicators();
  }

  function setEnclosureVisible(visible) {
    enclosureGroup.visible = visible;
  }

  function setFocus(defocusUm) {
    focusTarget = defocusUm * 0.022;
  }

  function setPwm(dutyPct) {
    pwm = THREE.MathUtils.clamp(dutyPct / 100, 0.01, 1);
  }

  function setAutoOrbit(on) {
    controls.autoRotate = on;
  }

  function setBedSpinning(on, rpm = 0) {
    spinRpm = on ? rpm : 0;
  }

  function setWaferField(imageData) {
    waferCtx.putImageData(new ImageData(imageData, GRID, GRID), 0, 0);
    waferTexture.needsUpdate = true;
  }

  const projected = new THREE.Vector3();
  let hotspotsDirty = true;
  controls.addEventListener('change', () => { hotspotsDirty = true; });

  function updateHotspots() {
    if (!hotspotsDirty) return;
    hotspotsDirty = false;
    const rect = canvas.getBoundingClientRect();
    for (const h of hotspots) {
      const p = h.parent
        ? h.parent.localToWorld(projected.copy(h.local)).project(camera)
        : projected.copy(h.local).project(camera);
      const visible = p.z < 1 && p.x > -1.2 && p.x < 1.2 && p.y > -1.2 && p.y < 1.2;
      h.el.style.display = visible ? 'flex' : 'none';
      if (visible) {
        h.el.style.left = `${((p.x + 1) / 2) * rect.width}px`;
        h.el.style.top = `${((-p.y + 1) / 2) * rect.height}px`;
      }
    }
  }

  function getStats() {
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      pixelRatio: renderer.getPixelRatio(),
    };
  }

  function resize() {
    hotspotsDirty = true;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(dt = 0.016) {
    clockT += dt;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt * 2.6);
      const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      hotspotsDirty = true;
      if (tween.t >= 1) tween = null;
    }
    if (Math.abs(lidTarget - lidCurrent) > 0.001) hotspotsDirty = true;
    lidCurrent += (lidTarget - lidCurrent) * Math.min(1, dt * 6);
    lid.rotation.x = lidCurrent;
    focusCurrent += (focusTarget - focusCurrent) * Math.min(1, dt * 8);
    lensGroup.position.y = focusCurrent;
    fan.rotation.z -= dt * (laserOn ? 6 : 2.2);
    if (spinRpm > 0) bed.rotation.y += dt * spinRpm * 0.06;

    if (beam.visible) {
      const flicker = 0.86 + 0.14 * Math.sin(clockT * 22);
      beamMaterial.opacity = (0.3 + 0.6 * pwm) * flicker;
      beamGlowMaterial.opacity = (0.07 + 0.2 * pwm) * flicker;
      focalSpot.material.opacity = 0.5 + 0.5 * pwm;
    }
    uvLight.intensity = beam.visible ? 2.2 + 3 * pwm : 0.35;

    const top = 68 + focusCurrent;
    const bottom = 35.2;
    const len = top - bottom;
    beam.scale.y = len / 33;
    beamGlow.scale.y = len / 33;
    beam.position.y = (top + bottom) / 2;
    beamGlow.position.y = (top + bottom) / 2;
    focalSpot.position.y = bottom + 0.3;

    controls.update();
    renderer.render(scene, camera);
    updateHotspots();
  }

  mergeStaticMeshes(machine, new Set([
    stageX, screwX, motorX, lensGroup, beam, beamGlow, focalSpot,
    lid, estop, interlockLed, fan, ...dragChain,
  ]));
  resize();
  setStagePosition(0, 0);
  return {
    scene, camera, renderer, controls, machine,
    setView, setStagePosition, setLaser, setLid, setEStop, setEnclosureVisible,
    setFocus, setPwm, setAutoOrbit, setBedSpinning, setWaferField, resize, render, getStats,
    getStagePosition: () => ({ x: lastX, y: lastY }),
    get lidOpen() { return lidOpen; },
    get laserOn() { return laserOn; },
  };
}
