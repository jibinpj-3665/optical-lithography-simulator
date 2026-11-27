import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { COMPONENTS, DIM, LEAD_SCREWS } from './config.js';
import { GRID } from './process.js';
import {
  brushedMetalTexture, gridPlateTexture, warningLabelTexture, motorLabelTexture,
} from './textures.js';

const brushed = brushedMetalTexture();
const darkBrushed = brushedMetalTexture('#3d4855', 19);
const gridTex = gridPlateTexture();
const warnTex = warningLabelTexture();
const motorTex = motorLabelTexture();

const ASSET_URLS = {
  fan: new URL('../assets/models/inline-round-duct-fan-200mm.glb', import.meta.url).href,
  motor: new URL('../assets/models/nema17-stepper-motor-with-mount.glb', import.meta.url).href,
};

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

// A real 2020 profile: 20 x 20 mm section, 6.2 mm slot, 4.3 mm centre bore.
// Built along local Y, then rotated into place.
function extrusion(length, x, y, z, axis, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  const { size, slot, slotDepth, bore } = DIM.extrusion;
  rbox(size, length, size, 1.2, 0, 0, 0, MAT.aluminium, g);
  for (const s of [-1, 1]) {
    box(0.6, length - 2, slot, s * size / 2, 0, 0, MAT.dark, g);
    box(slot, length - 2, 0.6, 0, 0, s * size / 2, MAT.dark, g);
    box(0.8, length - 2, slotDepth / 3, s * (size / 2 - 0.4), 0, slot / 2 - 0.9, MAT.steel, g);
    box(slotDepth / 3, length - 2, 0.8, slot / 2 - 0.9, 0, s * (size / 2 - 0.4), MAT.steel, g);
  }
  for (const end of [-1, 1]) {
    cylinder(bore / 2, 0.5, 0, end * (length / 2 + 0.05), 0, MAT.dark, g, 16);
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
      spin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, samples, 0.36, 4, false), MAT.copper));
    }
  }

  setStarts(1);
  g.userData.spin = spin;
  g.userData.setStarts = setStarts;
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
  camera.position.set(230, 170, 245);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 48;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 70, 0);

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
  floor.position.y = -12;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(1200, 60, 0x1c3a4a, 0x142631);
  grid.position.y = -11.9;
  scene.add(grid);

  const machine = new THREE.Group();
  scene.add(machine);

  // 200 x 180 x 140 mm frame built from 2020 extrusions
  const { outerW, outerD, height } = DIM.frame;
  const postX = outerW / 2 - DIM.extrusion.size / 2;
  const postZ = outerD / 2 - DIM.extrusion.size / 2;
  edged(box(outerW - 20, 6, outerD - 20, 0, 3, 0, MAT.grid, machine));
  for (const x of [-postX + 10, postX - 10]) {
    for (const z of [-postZ + 10, postZ - 10]) bolt(x, 6.4, z, machine);
  }
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

  // X axis: two MGN12 rails on a Ø8 T8 screw. Motor body is fixed; shaft spins.
  const railXLen = 160;
  for (const z of [-42, 42]) {
    edged(box(railXLen, DIM.mgn12.railH, DIM.mgn12.railW, 0, 11, z, MAT.steel, machine));
    box(railXLen, 0.8, DIM.mgn12.railW - 3, 0, 15.4, z, MAT.dark, machine);
  }
  const screwX = threadedRod(118, 21, 21.5, 0, 'x', machine);
  for (const x of [-38, 80]) {
    cylinder(6.5, 8, x, 21.5, 0, MAT.aluminium, machine, 24).rotation.z = Math.PI / 2;
  }

  // NEMA 17: 42.3 mm face, 40 mm body, 31 mm hole pitch, 22 mm pilot, Ø5 shaft.
  // Only the shaft/coupler sub-group spins; the motor body stays bolted down.
  function makeMotor(x, y, z, rotY, parent) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const { face, body, shaft, shaftLength, pilot, holePitch } = DIM.nema17;
    const faceZ = body / 2;
    const shell = new THREE.Group();
    g.add(shell);
    rbox(face, face, body, 2.2, 0, 0, 0, MAT.black, shell);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      bolt(sx * holePitch / 2, sy * holePitch / 2, faceZ + 0.4, shell, 'z');
    }
    cylinder(pilot / 2, 2, 0, 0, faceZ + 1, MAT.aluminium, shell, 32).rotation.x = Math.PI / 2;
    labelPlane(18, 9, motorTex, 0, 0, faceZ + 2.2, shell);

    const spin = new THREE.Group();
    g.add(spin);
    cylinder(shaft / 2, shaftLength, 0, 0, faceZ + shaftLength / 2, MAT.steel, spin, 20)
      .rotation.x = Math.PI / 2;
    cylinder(DIM.t8.diameter / 2 + 0.4, 10, 0, 0, faceZ + shaftLength + 5, MAT.copper, spin, 24)
      .rotation.x = Math.PI / 2;
    g.userData.shell = shell;
    g.userData.spin = spin;
    parent.add(g);
    return g;
  }
  const motorX = makeMotor(-88, 21.5, 0, Math.PI / 2, machine);

  // X carriage: MGN12 blocks, T8 nut, and the second-stage MGN9 rails.
  const stageX = new THREE.Group();
  machine.add(stageX);
  edged(box(80, 4, 112, 0, 30, 0, MAT.aluminium, stageX));
  for (const x of [-28, 28]) {
    for (const z of [-42, 42]) {
      rbox(DIM.mgn12.blockL, DIM.mgn12.blockH, DIM.mgn12.blockW, 1.2, x, 21.5, z, MAT.dark, stageX);
    }
  }
  cylinder(5.5, 10, 0, 21.5, 0, MAT.copper, stageX, 24).rotation.z = Math.PI / 2;
  for (const x of [-26, 26]) {
    edged(box(DIM.mgn9.railW, DIM.mgn9.railH, 100, x, 35.25, 0, MAT.steel, stageX));
    box(DIM.mgn9.railW - 2, 0.7, 100, x, 38.6, 0, MAT.dark, stageX);
  }
  const screwY = threadedRod(114, 0, 43.5, 21, 'z', stageX);
  for (const z of [-36, 78]) cylinder(6, 7, 0, 43.5, z, MAT.aluminium, stageX, 24).rotation.x = Math.PI / 2;
  const motorY = makeMotor(0, 43.5, -86, 0, stageX);

  // Y carriage: MGN9 blocks, T8 nut and the spin-coat chuck.
  const stageY = new THREE.Group();
  stageX.add(stageY);
  edged(box(74, 4, 54, 0, 50.5, 0, MAT.aluminium, stageY));
  for (const x of [-26, 26]) {
    rbox(DIM.mgn9.blockW, DIM.mgn9.blockH, DIM.mgn9.blockL, 1, x, 43.5, 0, MAT.dark, stageY);
  }
  cylinder(5, 9, 0, 43.5, 0, MAT.copper, stageY, 24).rotation.x = Math.PI / 2;

  const bed = new THREE.Group();
  stageY.add(bed);
  cylinder(21, 4, 0, 55.5, 0, MAT.dark, bed, 72);
  cylinder(19.4, 1, 0, 57.8, 0, MAT.steel, bed, 72);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(0.9, 0.4, Math.cos(a) * 16, 58.4, Math.sin(a) * 16, MAT.black, bed, 10);
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
  wafer.position.y = 58.6;
  wafer.receiveShadow = true;
  bed.add(wafer);
  const waferRim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.45, 10, 128),
    MAT.steel
  );
  waferRim.rotation.x = Math.PI / 2;
  waferRim.position.y = 58.6;
  bed.add(waferRim);

  // Drag chain follows the X carriage
  const dragChain = [];
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x1c242e, metalness: 0.25, roughness: 0.7 });
  for (let i = 0; i < 18; i++) {
    const link = rbox(5.5, 3.2, 6, 0.8, 0, 0, 0, chainMat, machine);
    dragChain.push(link);
  }

  // Optical head: fixed housing, voice-coil lens and the astigmatic QPD.
  const head = new THREE.Group();
  machine.add(head);
  rbox(34, 9, 34, 1.5, 0, 124, 0, MAT.dark, head);
  rbox(26, 4, 32, 1, 0, 129, -16, MAT.aluminium, head);
  labelPlane(26, 6.5, warnTex, 0, 124, 17.2, head);
  cylinder(9.5, 26, 0, 110, 0, MAT.aluminium, head, 48);
  for (let i = 0; i < 7; i++) cylinder(11.5, 1.2, 0, 100 + i * 3.5, 0, MAT.dark, head, 48);
  const lensGroup = new THREE.Group();
  head.add(lensGroup);
  cylinder(7, 3.5, 0, 93, 0, MAT.black, lensGroup, 40);
  cylinder(4.4, 1.5, 0, 91, 0, new THREE.MeshPhysicalMaterial({
    color: 0xa483ff, metalness: 0.1, roughness: 0.04, transmission: 0.7, thickness: 1,
  }), lensGroup, 40);
  cylinder(8.5, 2.2, 0, 97.5, 0, MAT.copper, lensGroup, 40);
  for (const s of [-1, 1]) cylinder(0.8, 8, s * 6, 95, 0, MAT.steel, lensGroup, 12);
  const qpd = rbox(11, 6.5, 11, 0.8, 14, 106, -11, MAT.black, head);
  box(6.5, 0.4, 6.5, 14, 109.4, -11, MAT.accent, head);

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

  // Enclosure: 2 mm amber panels sized to the 200 x 180 x 140 frame.
  const enclosureGroup = new THREE.Group();
  machine.add(enclosureGroup);
  const panelW = outerW - 2;
  const panelD = outerD - 2;
  const panelH = height - 10;
  const panelY = (height + 10) / 2;
  for (const x of [-outerW / 2 + 1, outerW / 2 - 1]) {
    edged(box(2, panelH, panelD, x, panelY, 0, MAT.amber, enclosureGroup), 0xffb14d);
  }
  for (const z of [-outerD / 2 + 1, outerD / 2 - 1]) {
    edged(box(panelW, panelH, 2, 0, panelY, z, MAT.amber, enclosureGroup), 0xffb14d);
  }

  const lid = new THREE.Group();
  lid.position.set(0, height - 4, -outerD / 2 + 1);
  enclosureGroup.add(lid);
  edged(box(panelW, 2.4, panelD, 0, 0, panelD / 2, MAT.amber, lid), 0xffb14d);
  box(panelW, 1.6, 3, 0, -1.8, 2, MAT.rubber, lid);
  for (const x of [-55, 55]) cylinder(4, 12, x, -2, -2, MAT.steel, lid, 24).rotation.z = Math.PI / 2;
  rbox(24, 4, 8, 1.2, 0, -2.5, panelD + 6, MAT.black, lid);

  const interlock = rbox(10, 8, 6, 0.8, outerW / 2 - 7, height - 12, outerD / 2 - 12, MAT.black, machine);
  const interlockLed = cylinder(1.5, 1.2, outerW / 2 - 7, height - 7.6, outerD / 2 - 12, MAT.ledOk, machine, 18);

  // Control panel, E-stop, screen, fume extractor with spinning fan
  const frontZ = outerD / 2 - 3;
  rbox(36, 24, 4, 1.5, -56, 84, frontZ, MAT.black, machine);
  const estop = cylinder(5, 3.5, -64, 87, frontZ + 3.5, MAT.red, machine, 28);
  estop.rotation.x = Math.PI / 2;
  cylinder(6.5, 1, -64, 87, frontZ + 1.8, MAT.steel, machine, 28).rotation.x = Math.PI / 2;
  const screen = box(18, 10, 1.2, -50, 81, frontZ + 2.6, new THREE.MeshStandardMaterial({
    color: 0x05202c, emissive: 0x064454, roughness: 0.2, metalness: 0.1,
  }), machine);
  for (let i = 0; i < 3; i++) cylinder(1.4, 1, -57 + i * 4, 75, frontZ + 2.6, MAT.accent, machine, 16).rotation.x = Math.PI / 2;

  rbox(36, 28, 18, 2, -52, 90, -outerD / 2 + 16, MAT.dark, machine);
  cylinder(5.5, 32, -52, 116, -outerD / 2 + 16, MAT.aluminium, machine, 24);
  const fan = new THREE.Group();
  fan.position.set(-52, 90, -outerD / 2 + 25.5);
  machine.add(fan);
  const fanRotor = new THREE.Group();
  fan.add(fanRotor);
  for (let i = 0; i < 7; i++) {
    const blade = box(3.2, 11, 0.8, 0, 6.5, 0, MAT.aluminium, fanRotor);
    blade.rotation.z = (i / 7) * Math.PI * 2;
    blade.position.set(Math.sin((i / 7) * Math.PI * 2) * 6.5, Math.cos((i / 7) * Math.PI * 2) * 6.5, 0);
  }
  cylinder(2.2, 1.4, 0, 0, 0.8, MAT.black, fanRotor, 20).rotation.x = Math.PI / 2;

  // Hotspot overlays
  const hotspots = [];
  const hotspotDefs = {
    head: { pos: [0, 126, 0] },
    stage: { pos: [-28, 31, 42], parent: stageX },
    wafer: { pos: [0, 59, 0], parent: stageY },
    lid: { pos: [55, 2, 90], parent: lid },
    interlock: { pos: [93, 129, 78] },
    motor: { pos: [-88, 22, 0] },
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
    overview: { pos: [230, 170, 245], target: [0, 70, 0] },
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

  // CC0 catalogue models add real surface detail; procedural geometry remains
  // as an instant fallback if a GLB is missing or fails to decode.
  const gltfLoader = new GLTFLoader();
  const assetStatus = { fan: false, motor: false };
  let fanSpinGroup = fanRotor;
  let fanSpinAxis = 'z';

  function loadGlb(url) {
    return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
  }

  function prepareFanModel(gltf) {
    const root = gltf.scene;
    const rotor = root.getObjectByName('Galvanised steel');
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.16, 0);
    root.add(pivot);
    if (rotor) {
      rotor.removeFromParent();
      rotor.position.y -= 0.16;
      pivot.add(rotor);
    }
    mergeStaticMeshes(root, new Set([pivot]));
    // The source is 442 x 430 x 360 mm; scale it into the fume-extractor bay.
    root.scale.setScalar(220);
    root.rotation.y = -Math.PI / 2;
    root.position.set(-52, 90 - 0.16 * 220, -outerD / 2 - 18);
    return { root, pivot };
  }

  function prepareMotorModel(gltf) {
    const root = gltf.scene.clone(true);
    const shaft = root.getObjectByName('D_shaft');
    if (shaft) shaft.removeFromParent();
    mergeStaticMeshes(root, new Set());
    // Source axes: motor body +Y, shaft +X. Map shaft to local +Z so the
    // existing shaft/coupler and screw kinematics stay unchanged.
    root.scale.setScalar(1000);
    root.rotation.y = -Math.PI / 2;
    root.position.set(0, -25, 7);
    return root;
  }

  async function loadDetailedAssets() {
    const results = await Promise.allSettled([loadGlb(ASSET_URLS.fan), loadGlb(ASSET_URLS.motor)]);
    const [fanResult, motorResult] = results;

    if (fanResult.status === 'fulfilled') {
      const { root, pivot } = prepareFanModel(fanResult.value);
      pivot.rotation.x = fanRotor.rotation.z;
      machine.add(root);
      fanRotor.visible = false;
      fanSpinGroup = pivot;
      fanSpinAxis = 'x';
      assetStatus.fan = true;
    } else {
      console.warn('Fan GLB unavailable; keeping procedural fan.', fanResult.reason);
    }

    if (motorResult.status === 'fulfilled') {
      const model = prepareMotorModel(motorResult.value);
      for (const motor of [motorX, motorY]) {
        const clone = model.clone(true);
        motor.userData.shell.visible = false;
        motor.add(clone);
      }
      assetStatus.motor = true;
    } else {
      console.warn('Motor GLB unavailable; keeping procedural motors.', motorResult.reason);
    }

    document.body.dataset.assets = assetStatus.fan && assetStatus.motor ? 'detailed' : 'fallback';
  }

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
    const x = THREE.MathUtils.clamp(xMm, -DIM.stage.travelX / 2, DIM.stage.travelX / 2);
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
    const fanRate = dt * (laserOn ? 6 : 2.2);
    if (fanSpinAxis === 'x') fanSpinGroup.rotation.x -= fanRate;
    else fanSpinGroup.rotation.z -= fanRate;
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
    const bottom = 58.8;
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
    lid, estop, interlockLed, fan, ...dragChain,
  ]));
  resize();
  setLeadScrew(leadKey);
  setStagePosition(0, 0);
  const whenAssetsReady = loadDetailedAssets();
  return {
    scene, camera, renderer, controls, machine,
    whenAssetsReady,
    getAssetStatus: () => ({ ...assetStatus }),
    setView, setStagePosition, setLeadScrew, setLaser, setLid, setEStop, setEnclosureVisible,
    setFocus, setPwm, setAutoOrbit, setBedSpinning, setWaferField, resize, render, getStats,
    getStagePosition: () => ({ x: lastX, y: lastY }),
    getMotion: () => ({ x: lastX, y: lastY, angleX, angleY, leadMm, leadKey }),
    get lidOpen() { return lidOpen; },
    get laserOn() { return laserOn; },
  };
}
