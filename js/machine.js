import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { COMPONENTS, DIM, LEAD_SCREWS } from './config.js';
import { GRID } from './process.js';
import {
  brushedMetalTexture, gridPlateTexture, warningLabelTexture, motorLabelTexture,
} from './textures.js';

const brushed = brushedMetalTexture();
const darkBrushed = brushedMetalTexture('#2b333d', 23);
const gridTex = gridPlateTexture();
const warnTex = warningLabelTexture();
const motorTex = motorLabelTexture();

// Instrument-style palette: black-anodised machined plates, cold aluminium,
// one cyan status accent and restrained amber safety glazing.
const MAT = {
  case: new THREE.MeshStandardMaterial({ color: 0x202932, metalness: 0.62, roughness: 0.48, map: darkBrushed }),
  anodized: new THREE.MeshStandardMaterial({ color: 0x141b23, metalness: 0.72, roughness: 0.38, map: darkBrushed }),
  frame: new THREE.MeshStandardMaterial({ color: 0x394653, metalness: 0.82, roughness: 0.34, map: darkBrushed }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b222b, metalness: 0.66, roughness: 0.46, map: darkBrushed }),
  aluminium: new THREE.MeshStandardMaterial({ color: 0xb4c0cc, metalness: 0.94, roughness: 0.22, map: brushed }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd8e1e9, metalness: 0.96, roughness: 0.16 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0c1117, metalness: 0.4, roughness: 0.58 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x070a0e, metalness: 0.05, roughness: 0.94 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x29d8ef, metalness: 0.25, roughness: 0.3, emissive: 0x0a4b57 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc99356, metalness: 0.94, roughness: 0.22 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a52, metalness: 0.92, roughness: 0.28 }),
  red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, emissive: 0x3a0606 }),
  redDark: new THREE.MeshStandardMaterial({ color: 0x7d1a1a, roughness: 0.5, emissive: 0x180202 }),
  ledOk: new THREE.MeshStandardMaterial({ color: 0x29d8ef, emissive: 0x29d8ef, emissiveIntensity: 1.6 }),
  ledBad: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2 }),
  grid: new THREE.MeshStandardMaterial({ color: 0x7b8b9b, metalness: 0.8, roughness: 0.4, map: gridTex }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x8fd8ff, metalness: 0, roughness: 0.08, transmission: 0.65,
    thickness: 0.8, ior: 1.46, transparent: true, opacity: 0.35, depthWrite: false,
  }),
  smoke: new THREE.MeshPhysicalMaterial({
    color: 0x24313d, metalness: 0, roughness: 0.22, transmission: 0.58,
    thickness: 1.4, ior: 1.48, transparent: true, opacity: 0.22,
    side: THREE.DoubleSide, depthWrite: false,
  }),
  amber: new THREE.MeshPhysicalMaterial({
    color: 0xd8863c, metalness: 0, roughness: 0.14,
    transmission: 0.72, thickness: 1.2, ior: 1.49,
    transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false,
  }),
};

const EDGE = new THREE.LineBasicMaterial({ color: 0x5f7082, transparent: true, opacity: 0.26 });
const EDGE_WARM = new THREE.LineBasicMaterial({ color: 0xd79452, transparent: true, opacity: 0.3 });

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

function torus(r, tube, x, y, z, material, parent, segments = 48) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cable(points, radius, material, parent) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(20, points.length * 8), radius, 6, false),
    material
  );
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function edged(mesh, material = EDGE) {
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), material);
  mesh.add(edges);
  return mesh;
}

function bolt(x, y, z, parent, axis = 'y') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cylinder(1.5, 0.8, 0, 0, 0, MAT.steel, g, 6);
  cylinder(0.75, 0.9, 0, 0.08, 0, MAT.black, g, 6);
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  parent.add(g);
  return g;
}

// Closed-loop linear scale: black extrusion, glass strip and a small read head.
function linearScale(length, x, y, z, axis, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'z') g.rotation.y = Math.PI / 2;
  box(length, 2.4, 3.2, 0, 0, 0, MAT.black, g);
  box(length - 4, 0.35, 1.8, 0, 1.35, 0, MAT.glass, g);
  rbox(8, 5, 5, 0.8, -length / 2 + 9, 2.4, 0, MAT.anodized, g);
  box(2.4, 0.5, 2.2, -length / 2 + 9, 5.1, 0, MAT.accent, g);
  parent.add(g);
  return g;
}

function breadboardHoles(parent, y, width, depth, pitch = 25) {
  const g = new THREE.Group();
  for (let x = -width / 2 + pitch / 2; x <= width / 2 - pitch / 2; x += pitch) {
    for (let z = -depth / 2 + pitch / 2; z <= depth / 2 - pitch / 2; z += pitch) {
      cylinder(1.35, 0.28, x, y, z, MAT.black, g, 12);
    }
  }
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

function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#04151d';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#0f4c5c';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#29d8ef';
  ctx.font = 'bold 38px monospace';
  ctx.fillText('405 nm', 18, 52);
  ctx.font = '20px monospace';
  ctx.fillText('READY  /  GRBL', 18, 88);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i < 6 ? '#29d8ef' : '#123b47';
    ctx.fillRect(18 + i * 24, 104, 16, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Bake static meshes and their outline lines into one object per material.
// Moving assemblies are excluded, so the mechanical animation stays exact.
function mergeStaticMeshes(root, exclusions) {
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const isExcluded = (obj) => {
    let cur = obj;
    while (cur && cur !== root) {
      if (exclusions.has(cur)) return true;
      cur = cur.parent;
    }
    return false;
  };

  const meshGroups = new Map();
  const lineGroups = new Map();
  const remove = [];

  root.traverse((obj) => {
    if (isExcluded(obj)) return;
    const { position, normal, uv } = obj.geometry?.attributes || {};
    if (!position) return;

    let geo = obj.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    geo.applyMatrix4(invRoot.clone().multiply(obj.matrixWorld));

    if (obj.isLineSegments) {
      if (!lineGroups.has(obj.material)) lineGroups.set(obj.material, []);
      lineGroups.get(obj.material).push(geo);
      remove.push(obj);
    } else if (obj.isMesh && normal && uv) {
      if (!meshGroups.has(obj.material)) meshGroups.set(obj.material, []);
      meshGroups.get(obj.material).push(geo);
      remove.push(obj);
    }
  });

  for (const obj of remove) obj.parent.remove(obj);
  for (const [material, geos] of meshGroups) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  for (const [material, geos] of lineGroups) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) continue;
    root.add(new THREE.LineSegments(merged, material));
  }
}

// A real 2020 profile: 20 x 20 mm section, 6.2 mm slot, 4.3 mm centre bore.
// Built along local Y, then rotated into place.
function extrusion(length, x, y, z, axis, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  const { size, slot, slotDepth, bore } = DIM.extrusion;
  rbox(size, length, size, 1.2, 0, 0, 0, MAT.frame, g);
  for (const s of [-1, 1]) {
    box(0.6, length - 2, slot, s * size / 2, 0, 0, MAT.anodized, g);
    box(slot, length - 2, 0.6, 0, 0, s * size / 2, MAT.anodized, g);
    box(0.8, length - 2, slotDepth / 3, s * (size / 2 - 0.4), 0, slot / 2 - 0.9, MAT.steel, g);
    box(slotDepth / 3, length - 2, 0.8, slot / 2 - 0.9, 0, s * (size / 2 - 0.4), MAT.steel, g);
  }
  for (const end of [-1, 1]) {
    cylinder(bore / 2, 0.5, 0, end * (length / 2 + 0.05), 0, MAT.black, g, 16);
  }
  parent.add(g);
  return g;
}

// Ø8 mm T8 trapezoidal screw. One helix per start: 1/2/4 starts give
// 2/4/8 mm lead while keeping the physical 2 mm thread pitch.
function threadedRod(length, x, y, z, axis, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  const radius = DIM.t8.diameter / 2;
  cylinder(radius * 0.78, length, 0, 0, 0, MAT.steel, g, 20);
  const spin = new THREE.Group();
  g.add(spin);

  function setStarts(starts) {
    for (const child of [...spin.children]) {
      spin.remove(child);
      if (child.geometry) child.geometry.dispose();
    }
    const turns = Math.max(1, Math.round(length / DIM.t8.pitch));
    const samples = turns * 9;
    for (let s = 0; s < starts; s++) {
      const pts = [];
      const phase = (s / starts) * Math.PI * 2;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const a = phase + t * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(
          radius * Math.cos(a), -length / 2 + t * length, radius * Math.sin(a)
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      spin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, samples, 0.36, 4, false), MAT.brass));
    }
  }

  setStarts(1);
  g.userData.spin = spin;
  g.userData.setStarts = setStarts;
  parent.add(g);
  return g;
}

export function createMachine(canvas, hotspotLayer, onHotspotClick) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b11);
  scene.fog = new THREE.Fog(0x070b11, 300, 620);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1400);
  camera.position.set(195, 142, 212);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 48;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotateSpeed = 0.4;
  controls.target.set(0, 66, 0);

  scene.add(new THREE.HemisphereLight(0xb6d4ff, 0x15100c, 0.62));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(120, 230, 145);
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
  const rim = new THREE.DirectionalLight(0x79b6ff, 1.25);
  rim.position.set(-160, 115, -150);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd7a8, 0.55);
  fill.position.set(-120, 70, 170);
  scene.add(fill);
  const uvLight = new THREE.PointLight(0xa878ff, 0.4, 150, 2);
  uvLight.position.set(0, 70, 0);
  scene.add(uvLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ color: 0x0c1219, roughness: 0.92, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -14;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(800, 40, 0x183842, 0x10232b);
  grid.position.y = -13.9;
  scene.add(grid);

  const machine = new THREE.Group();
  scene.add(machine);

  // Isolated instrument base and optical breadboard.
  rbox(210, 8, 190, 3, 0, -4, 0, MAT.case, machine);
  for (const x of [-93, 93]) {
    for (const z of [-83, 83]) cylinder(7, 6, x, -11, z, MAT.rubber, machine, 20);
  }
  const { outerW, outerD, height } = DIM.frame;
  const postX = outerW / 2 - DIM.extrusion.size / 2;
  const postZ = outerD / 2 - DIM.extrusion.size / 2;
  edged(rbox(outerW - 18, 7, outerD - 18, 2, 0, 3.5, 0, MAT.grid, machine));
  breadboardHoles(machine, 7.2, outerW - 24, outerD - 24, 25);
  for (const x of [-postX + 10, postX - 10]) {
    for (const z of [-postZ + 10, postZ - 10]) {
      bolt(x, 7.4, z, machine);
    }
  }

  // 200 x 180 x 140 mm frame. The extrusions stay real catalogue size, but the
  // dark anodised finish makes them recede behind the machined stage plates.
  for (const x of [-postX, postX]) {
    for (const z of [-postZ, postZ]) extrusion(height, x, height / 2, z, 'y', machine);
  }
  for (const z of [-postZ, postZ]) {
    extrusion(outerW - 20, 0, height - 10, z, 'x', machine);
    extrusion(outerW - 20, 0, 10, z, 'x', machine);
  }
  for (const x of [-postX, postX]) {
    extrusion(outerD - 20, x, height - 10, 0, 'z', machine);
    extrusion(outerD - 20, x, 10, 0, 'z', machine);
  }

  // X axis: machined base plate, two MGN12 rails, T8 screw and linear scale.
  const railXLen = 160;
  edged(rbox(railXLen + 10, 5, 116, 1.5, 0, 10, 0, MAT.anodized, machine));
  for (const z of [-42, 42]) {
    edged(box(railXLen, DIM.mgn12.railH, DIM.mgn12.railW, 0, 11, z, MAT.steel, machine));
    box(railXLen, 0.8, DIM.mgn12.railW - 3, 0, 15.4, z, MAT.dark, machine);
    for (const x of [-70, -35, 0, 35, 70]) bolt(x, 15.9, z, machine);
  }
  const screwX = threadedRod(118, 25, 21.5, 0, 'x', machine);
  for (const x of [-34, 80]) {
    cylinder(6.5, 8, x, 21.5, 0, MAT.aluminium, machine, 24).rotation.z = Math.PI / 2;
    bolt(x, 21.5, 0, machine, 'x');
  }
  linearScale(150, 0, 23, 53, 'x', machine);

  // NEMA 17: catalogue face and shaft, tucked inside the frame rather than
  // protruding. Only the shaft/coupler sub-group spins; the body stays fixed.
  function makeMotor(x, y, z, rotY, parent) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const { face, body, shaft, shaftLength, pilot, holePitch } = DIM.nema17;
    const faceZ = body / 2;
    rbox(face, face, body, 2.6, 0, 0, 0, MAT.anodized, g);
    rbox(face + 2, face + 2, 3, 1.2, 0, 0, faceZ - 1, MAT.black, g);
    rbox(face - 4, face - 4, 2, 1, 0, 0, -faceZ + 1, MAT.case, g);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      bolt(sx * holePitch / 2, sy * holePitch / 2, faceZ + 0.4, g, 'z');
    }
    cylinder(pilot / 2, 2, 0, 0, faceZ + 1.6, MAT.aluminium, g, 32).rotation.x = Math.PI / 2;
    labelPlane(18, 9, motorTex, 0, 0, faceZ + 2.5, g);

    const cableGland = cylinder(3, 6, face / 2 + 1, -10, -body / 4, MAT.black, g, 16);
    cableGland.rotation.z = Math.PI / 2;
    cable([
      [face / 2 + 4, -10, -body / 4],
      [face / 2 + 18, -18, -body / 2],
      [face / 2 + 24, -34, -body / 2 - 12],
    ], 1.1, MAT.rubber, g);

    const spin = new THREE.Group();
    g.add(spin);
    cylinder(shaft / 2, shaftLength, 0, 0, faceZ + shaftLength / 2, MAT.steel, spin, 20)
      .rotation.x = Math.PI / 2;
    cylinder(DIM.t8.diameter / 2 + 0.6, 10, 0, 0, faceZ + shaftLength + 5, MAT.copper, spin, 24)
      .rotation.x = Math.PI / 2;
    torus(DIM.t8.diameter / 2 + 0.9, 0.55, 0, 0, faceZ + shaftLength + 0.5, MAT.brass, spin);
    g.userData.spin = spin;
    parent.add(g);
    return g;
  }
  const motorX = makeMotor(-74, 21.5, 0, Math.PI / 2, machine);

  // X carriage: MGN12 blocks, T8 nut and the second-stage MGN9 rails.
  const stageX = new THREE.Group();
  machine.add(stageX);
  edged(rbox(80, 4, 112, 1.5, 0, 30, 0, MAT.aluminium, stageX));
  box(64, 0.5, 86, 0, 32.3, 0, MAT.anodized, stageX);
  for (const x of [-32, 32]) for (const z of [-46, 46]) bolt(x, 32.7, z, stageX);
  for (const x of [-28, 28]) {
    for (const z of [-42, 42]) {
      rbox(DIM.mgn12.blockL, DIM.mgn12.blockH, DIM.mgn12.blockW, 1.2, x, 21.5, z, MAT.dark, stageX);
      box(DIM.mgn12.blockL + 1, 1, DIM.mgn12.blockW + 1, x, 28.1, z, MAT.steel, stageX);
    }
  }
  rbox(12, 9, 12, 1, 0, 21.5, 0, MAT.copper, stageX).rotation.z = Math.PI / 2;
  for (const x of [-26, 26]) {
    edged(box(DIM.mgn9.railW, DIM.mgn9.railH, 100, x, 35.25, 0, MAT.steel, stageX));
    box(DIM.mgn9.railW - 2, 0.7, 100, x, 38.6, 0, MAT.dark, stageX);
    for (const z of [-40, 0, 40]) bolt(x, 39, z, stageX);
  }
  const screwY = threadedRod(114, 0, 43.5, 21, 'z', stageX);
  for (const z of [-36, 78]) {
    cylinder(6, 7, 0, 43.5, z, MAT.aluminium, stageX, 24).rotation.x = Math.PI / 2;
    bolt(0, 43.5, z, stageX, 'z');
  }
  linearScale(100, 40, 42, 0, 'z', stageX);
  const motorY = makeMotor(0, 43.5, -66, 0, stageX);

  // Y carriage: MGN9 blocks, T8 nut and the vacuum spin-coat chuck.
  const stageY = new THREE.Group();
  stageX.add(stageY);
  edged(rbox(74, 4, 54, 1.5, 0, 50.5, 0, MAT.aluminium, stageY));
  box(58, 0.5, 40, 0, 52.7, 0, MAT.anodized, stageY);
  for (const x of [-30, 30]) for (const z of [-20, 20]) bolt(x, 53.1, z, stageY);
  for (const x of [-26, 26]) {
    rbox(DIM.mgn9.blockW, DIM.mgn9.blockH, DIM.mgn9.blockL, 1, x, 43.5, 0, MAT.dark, stageY);
    box(DIM.mgn9.blockW + 1, 1, DIM.mgn9.blockL + 1, x, 48.7, 0, MAT.steel, stageY);
  }
  rbox(12, 9, 12, 1, 0, 43.5, 0, MAT.copper, stageY).rotation.x = Math.PI / 2;

  const bed = new THREE.Group();
  stageY.add(bed);
  cylinder(21, 5, 0, 55.5, 0, MAT.anodized, bed, 72);
  cylinder(19.4, 1.2, 0, 58.4, 0, MAT.steel, bed, 72);
  torus(18.5, 0.7, 0, 59.1, 0, MAT.brass, bed, 72).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(0.9, 0.4, Math.cos(a) * 16, 59, Math.sin(a) * 16, MAT.black, bed, 10);
  }

  const waferCanvas = document.createElement('canvas');
  waferCanvas.width = GRID;
  waferCanvas.height = GRID;
  const waferCtx = waferCanvas.getContext('2d');
  waferCtx.fillStyle = '#123a4d';
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
  wafer.position.y = 59.1;
  wafer.receiveShadow = true;
  bed.add(wafer);
  const waferRim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.45, 10, 128), MAT.steel);
  waferRim.rotation.x = Math.PI / 2;
  waferRim.position.y = 59.1;
  bed.add(waferRim);

  // Drag chain and braided cable follow the X carriage.
  const dragChain = [];
  for (let i = 0; i < 18; i++) {
    const link = rbox(5.5, 3.2, 6, 0.8, 0, 0, 0, MAT.anodized, machine);
    dragChain.push(link);
  }
  cable([[-62, 33, -58], [-40, 26, -58], [-10, 25, -58], [30, 33, -58]], 0.9, MAT.rubber, machine);

  // Optical head: black dovetail bracket, machined objective barrel, focus
  // actuator, camera port and the astigmatic QPD.
  const head = new THREE.Group();
  machine.add(head);
  edged(rbox(44, 6, 42, 1.5, 0, 124, 0, MAT.anodized, head));
  for (const x of [-18, 18]) for (const z of [-16, 16]) bolt(x, 127.2, z, head);
  rbox(28, 22, 8, 1, 0, 115, -21, MAT.case, head);
  rbox(32, 5, 34, 1, 0, 119, -4, MAT.aluminium, head);
  labelPlane(26, 6.5, warnTex, 0, 124, 17.2, head);

  cylinder(10, 27, 0, 110, 0, MAT.anodized, head, 48);
  for (let i = 0; i < 6; i++) cylinder(11.3, 1.1, 0, 99 + i * 3.9, 0, MAT.black, head, 48);
  torus(10.2, 0.8, 0, 121, 0, MAT.brass, head, 48).rotation.x = Math.PI / 2;
  torus(10.2, 0.8, 0, 101, 0, MAT.brass, head, 48).rotation.x = Math.PI / 2;

  // Side camera / alignment port.
  const cameraPort = cylinder(5, 14, 20, 114, -8, MAT.case, head, 28);
  cameraPort.rotation.z = Math.PI / 2;
  torus(5.6, 0.8, 27, 114, -8, MAT.aluminium, head, 28).rotation.y = Math.PI / 2;

  const lensGroup = new THREE.Group();
  head.add(lensGroup);
  cylinder(7.5, 3.5, 0, 93, 0, MAT.black, lensGroup, 40);
  cylinder(4.4, 1.5, 0, 91, 0, new THREE.MeshPhysicalMaterial({
    color: 0xa483ff, metalness: 0.1, roughness: 0.04, transmission: 0.7, thickness: 1,
  }), lensGroup, 40);
  cylinder(8.5, 2.2, 0, 97.5, 0, MAT.brass, lensGroup, 40);
  for (const s of [-1, 1]) cylinder(0.8, 8, s * 6, 95, 0, MAT.steel, lensGroup, 12);

  const qpd = rbox(11, 6.5, 11, 0.8, 14, 106, -11, MAT.black, head);
  box(6.5, 0.4, 6.5, 14, 109.4, -11, MAT.accent, head);
  cable([[18, 106, -11], [28, 104, -18], [32, 96, -30]], 0.8, MAT.rubber, head);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xb28cff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beamGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x6d3bff, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beam = cylinder(0.6, 34, 0, 75, 0, beamMaterial, head, 14);
  const beamGlow = cylinder(2.4, 34, 0, 75, 0, beamGlowMaterial, head, 14);
  beam.visible = false;
  beamGlow.visible = false;
  const focalSpot = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xd8c2ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
  );
  focalSpot.position.y = 59.1;
  focalSpot.visible = false;
  head.add(focalSpot);

  // Rear fume extractor: compact black housing, guarded axial fan and duct.
  rbox(36, 28, 18, 2, -52, 90, -outerD / 2 + 16, MAT.case, machine);
  cylinder(9, 8, -52, 90, -outerD / 2 + 25, MAT.anodized, machine, 32).rotation.x = Math.PI / 2;
  const fan = new THREE.Group();
  fan.position.set(-52, 90, -outerD / 2 + 27);
  machine.add(fan);
  torus(8.2, 0.7, 0, 0, 0, MAT.aluminium, fan, 48);
  torus(4.6, 0.5, 0, 0, 0.5, MAT.frame, fan, 48);
  for (let i = 0; i < 4; i++) {
    const spoke = box(1, 15, 0.6, 0, 0, 0.8, MAT.frame, fan);
    spoke.rotation.z = (i / 4) * Math.PI;
  }
  const fanRotor = new THREE.Group();
  fan.add(fanRotor);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const blade = box(3.2, 11, 0.8, 0, 6.5, 0, MAT.steel, fanRotor);
    blade.rotation.z = a;
    blade.position.set(Math.sin(a) * 6.5, Math.cos(a) * 6.5, 0);
  }
  cylinder(2.2, 1.4, 0, 0, 0.8, MAT.black, fanRotor, 20).rotation.x = Math.PI / 2;
  cylinder(6, 20, -52, 116, -outerD / 2 + 12, MAT.anodized, machine, 24);

  // Front control pod: OLED readout, status LEDs and a real E-stop.
  const frontZ = outerD / 2 - 3;
  edged(rbox(40, 26, 4, 1.5, -56, 84, frontZ, MAT.case, machine));
  const screenTex = screenTexture();
  const screen = box(18, 9, 1.2, -50, 82, frontZ + 2.6, new THREE.MeshStandardMaterial({
    map: screenTex, emissive: 0xffffff, emissiveMap: screenTex,
    emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.1,
  }), machine);
  for (let i = 0; i < 3; i++) {
    cylinder(1.4, 1, -61 + i * 4, 74, frontZ + 2.6, i === 0 ? MAT.accent : MAT.black, machine, 16)
      .rotation.x = Math.PI / 2;
  }
  const estop = cylinder(5, 3.5, -66, 88, frontZ + 3.5, MAT.red, machine, 28);
  estop.rotation.x = Math.PI / 2;
  cylinder(6.5, 1, -66, 88, frontZ + 1.8, MAT.steel, machine, 28).rotation.x = Math.PI / 2;

  // Enclosure: smoke side/back glazing, amber front glazing, black door seals.
  const enclosureGroup = new THREE.Group();
  machine.add(enclosureGroup);
  const panelW = outerW - 2;
  const panelD = outerD - 2;
  const panelH = height - 10;
  const panelY = (height + 10) / 2;
  for (const x of [-outerW / 2 + 1, outerW / 2 - 1]) {
    edged(box(2, panelH, panelD, x, panelY, 0, MAT.smoke, enclosureGroup), EDGE_WARM);
  }
  edged(box(panelW, panelH, 2, 0, panelY, -outerD / 2 + 1, MAT.smoke, enclosureGroup), EDGE_WARM);
  edged(box(panelW, panelH, 2, 0, panelY, outerD / 2 - 1, MAT.amber, enclosureGroup), EDGE_WARM);
  for (const x of [-outerW / 2 + 2, outerW / 2 - 2]) {
    box(4, panelH + 4, 4, x, panelY, outerD / 2, MAT.case, enclosureGroup);
  }
  for (const y of [10, height - 10]) {
    box(panelW, 4, 4, 0, y, outerD / 2, MAT.case, enclosureGroup);
  }
  box(3, 16, 4, 62, 70, outerD / 2 + 3, MAT.aluminium, enclosureGroup);
  for (const y of [64, 76]) cylinder(2, 4, 62, y, outerD / 2 + 1, MAT.black, enclosureGroup, 16).rotation.x = Math.PI / 2;

  const lid = new THREE.Group();
  lid.position.set(0, height - 4, -outerD / 2 + 1);
  enclosureGroup.add(lid);
  edged(box(panelW, 2.4, panelD, 0, 0, panelD / 2, MAT.amber, lid), EDGE_WARM);
  box(panelW, 1.6, 3, 0, -1.8, 2, MAT.rubber, lid);
  for (const x of [-55, 55]) cylinder(4, 12, x, -2, -2, MAT.steel, lid, 24).rotation.z = Math.PI / 2;
  rbox(24, 4, 8, 1.2, 0, -2.5, panelD + 6, MAT.anodized, lid);

  const interlock = rbox(10, 8, 6, 0.8, outerW / 2 - 7, height - 12, outerD / 2 - 12, MAT.black, machine);
  const interlockLed = cylinder(1.5, 1.2, outerW / 2 - 7, height - 7.6, outerD / 2 - 12, MAT.ledOk, machine, 18);

  // Hotspot overlays.
  const hotspots = [];
  const hotspotDefs = {
    head: { pos: [0, 126, 0] },
    stage: { pos: [-28, 31, 42], parent: stageX },
    wafer: { pos: [0, 59, 0], parent: stageY },
    lid: { pos: [55, 2, 90], parent: lid },
    interlock: { pos: [93, 129, 78] },
    motor: { pos: [-74, 22, 0] },
    qpd: { pos: [14, 107, -11] },
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
    overview: { pos: [195, 142, 212], target: [0, 66, 0] },
    head: { pos: [70, 148, 92], target: [0, 100, 0] },
    stage: { pos: [88, 82, 110], target: [0, 46, 0] },
    top: { pos: [0, 300, 0.1], target: [0, 36, 0] },
    enclosure: { pos: [250, 110, 190], target: [0, 75, 0] },
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
  let leadKey = 'T8x2';
  let leadMm = LEAD_SCREWS[leadKey].lead;
  let angleX = 0;
  let angleY = 0;
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

  // Motor shaft angle follows the physical screw relation:
  // one revolution advances one lead, so angle = travel / lead x 2π.
  function applyScrewRotation() {
    // Screw local +Y points world -X for screwX, world +Z for screwY.
    screwX.userData.spin.rotation.y = -angleX;
    screwY.userData.spin.rotation.y = angleY;
    motorX.userData.spin.rotation.z = angleX;
    motorY.userData.spin.rotation.z = angleY;
  }

  function setLeadScrew(key) {
    const data = LEAD_SCREWS[key] || LEAD_SCREWS[leadKey];
    leadKey = key in LEAD_SCREWS ? key : leadKey;
    leadMm = data.lead;
    screwX.userData.setStarts(data.starts);
    screwY.userData.setStarts(data.starts);
    angleX = lastX / leadMm * Math.PI * 2;
    angleY = lastY / leadMm * Math.PI * 2;
    applyScrewRotation();
  }

  function setStagePosition(xMm, yMm) {
    const x = THREE.MathUtils.clamp(xMm, -DIM.stage.travelX / 2, DIM.stage.travelY / 2);
    const y = THREE.MathUtils.clamp(yMm, -DIM.stage.travelY / 2, DIM.stage.travelY / 2);
    const z = -y; // field +Y maps to world -Z
    angleX += (x - lastX) / leadMm * Math.PI * 2;
    angleY += (y - lastY) / leadMm * Math.PI * 2;
    lastX = x;
    lastY = y;
    applyScrewRotation();
    stageX.position.x = x;
    stageY.position.z = z;
    hotspotsDirty = true;

    // Drag chain links trace a drooping loop from the fixed anchor to the carriage.
    const anchor = -62;
    const end = x - 30;
    dragChain.forEach((link, i) => {
      const t = i / (dragChain.length - 1);
      link.position.set(
        anchor + (end - anchor) * t,
        33 - Math.sin(t * Math.PI) * 7,
        -58 - Math.sin(t * Math.PI) * 3
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
    estop.position.z = pressed ? frontZ + 1.9 : frontZ + 3.5;
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
    fanRotor.rotation.z -= dt * (laserOn ? 6 : 2.2);
    if (spinRpm > 0) {
      // ω = 2π·rpm/60 rad/s; high rpm will alias at display frame rate, as on a real camera.
      bed.rotation.y = (bed.rotation.y + dt * spinRpm * Math.PI / 30) % (Math.PI * 2);
    }

    if (beam.visible) {
      const flicker = 0.86 + 0.14 * Math.sin(clockT * 22);
      beamMaterial.opacity = (0.3 + 0.6 * pwm) * flicker;
      beamGlowMaterial.opacity = (0.07 + 0.2 * pwm) * flicker;
      focalSpot.material.opacity = 0.5 + 0.5 * pwm;
    }
    uvLight.intensity = beam.visible ? 2.2 + 3 * pwm : 0.35;

    const top = 91 + focusCurrent;
    const bottom = 59.1;
    const len = top - bottom;
    beam.scale.y = len / 34;
    beamGlow.scale.y = len / 34;
    beam.position.y = (top + bottom) / 2;
    beamGlow.position.y = (top + bottom) / 2;
    focalSpot.position.y = bottom + 0.3;

    controls.update();
    renderer.render(scene, camera);
    updateHotspots();
  }

  mergeStaticMeshes(machine, new Set([
    stageX, screwX, motorX, lensGroup, beam, beamGlow, focalSpot,
    lid, estop, interlockLed, fanRotor, ...dragChain,
  ]));
  resize();
  setLeadScrew(leadKey);
  setStagePosition(0, 0);
  document.body.dataset.assets = 'procedural';

  return {
    scene, camera, renderer, controls, machine,
    setView, setStagePosition, setLeadScrew, setLaser, setLid, setEStop, setEnclosureVisible,
    setFocus, setPwm, setAutoOrbit, setBedSpinning, setWaferField, resize, render, getStats,
    getStagePosition: () => ({ x: lastX, y: lastY }),
    getMotion: () => ({ x: lastX, y: lastY, angleX, angleY, leadMm, leadKey }),
    get lidOpen() { return lidOpen; },
    get laserOn() { return laserOn; },
  };
}
