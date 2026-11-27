// Values transcribed from the two source documents in the parent folder.
export const MACHINE = {
  wavelengthNm: 405,
  laserRatedMw: 60,
  laserMwMin: 10,
  laserMwMax: 100,
  spotMinUm: 0.8,
  spotMaxUm: 8,
  stageTravelMm: 50,
  workAreaMm: 10,
  waferRadiusMm: 15,
};

// 3D scene units are millimetres. Values are standard catalogue dimensions:
// 2020 extrusion 20x20 mm with 6.2 mm slot; NEMA17 42.3 mm face / 40 mm body /
// 5 mm shaft / 31 mm mounting centres; MGN9 and MGN12 from the HIWIN MG datasheet;
// T8 trapezoidal screws are 8 mm OD with 2 mm thread pitch.
export const DIM = {
  extrusion: { size: 20, slot: 6.2, slotDepth: 6.1, bore: 4.3 },
  nema17: { face: 42.3, body: 40, shaft: 5, shaftLength: 20, pilot: 22, holePitch: 31 },
  mgn12: { railW: 12, railH: 8, holePitch: 25, blockW: 27, blockL: 34.7, blockH: 13 },
  mgn9: { railW: 9, railH: 6.5, holePitch: 20, blockW: 20, blockL: 28.9, blockH: 10 },
  t8: { diameter: 8, pitch: 2 },
  frame: { outerW: 200, outerD: 180, height: 140 },
  stage: { travelX: 50, travelY: 50, waferRadius: 15 },
};

// Lead = linear travel per one 360° screw/motor revolution.
// T8x2 is the precision choice: 200 full steps/rev ÷ 2 mm = 100 steps/mm.
export const LEAD_SCREWS = {
  'T8x2': { lead: 2, starts: 1, label: 'T8x2 · 2 mm lead · precision' },
  'T8x4': { lead: 4, starts: 2, label: 'T8x4 · 4 mm lead · balanced' },
  'T8x8': { lead: 8, starts: 4, label: 'T8x8 · 8 mm lead · fast' },
};

// NEMA 17 is 1.8°/full step. A4988 drivers are configured for 16× microstepping.
export const DRIVE = { stepAngleDeg: 1.8, fullStepsPerRev: 200, microsteps: 16 };

export const SCALES = [
  {
    name: 'Micro project',
    goal: 'Static UV exposure rig',
    resolution: '~500 µm (mask dependent)',
    controller: 'Arduino Uno / MSP430',
    challenge: 'LED driver stability',
  },
  {
    name: 'Mini project',
    goal: 'X-Y scanning mask lithography',
    resolution: '~50 µm (mechanical play)',
    controller: 'Arduino Mega / ESP32',
    challenge: 'G-code parsing & motor sync',
  },
  {
    name: 'Major project',
    goal: 'Maskless direct-write (DWL)',
    resolution: '~1–5 µm (optical focus limit)',
    controller: 'STM32 (Cortex-M4) + Raspberry Pi',
    challenge: 'Real-time auto-focus loop & DAQ',
  },
];

export const MATERIALS = {
  'Standard photoresist': { dose: 60, thickness: 1.4, color: '#f472b6', note: 'Positive tone, spin-coated glass or silicon.' },
  'Chitosan + PAG': { dose: 95, thickness: 2.2, color: '#a78bfa', note: 'Cheap biopolymer test film from the micro project.' },
  'P3HT / PEDOT:PSS': { dose: 80, thickness: 0.9, color: '#22d3ee', note: 'Organic TFT channel patterning.' },
  'Silk fibroin': { dose: 120, thickness: 3.5, color: '#fbbf24', note: 'Biocompatible sensors and microfluidics.' },
  'Gelatin': { dose: 110, thickness: 4.0, color: '#34d399', note: 'Soft biopolymer, low-temperature processing.' },
  'Silicon / compound wafer': { dose: 70, thickness: 1.2, color: '#94a3b8', note: 'High-contrast diodes and MEMS structures.' },
};

export const BOM = [
  {
    category: 'Electronics & Processing',
    items: [
      ['Arduino Uno compatible board', 450, 600],
      ['CNC Shield V3', 180, 250],
      ['A4988 stepper drivers (×2)', 240, 350],
      ['12 V 5 A DC SMPS', 650, 900],
    ],
  },
  {
    category: 'Mechanical Drive & Motion',
    items: [
      ['NEMA 17 stepper motors (×2)', 1200, 1600],
      ['T8 lead screws + nuts + couplers (×2)', 800, 1200],
      ['MGN9 / MGN12 linear rails (×2)', 1800, 2600],
      ['Flexible aluminium couplers (×2)', 120, 200],
    ],
  },
  {
    category: 'UV Optics & Enclosure Safety',
    items: [
      ['365/405 nm focused laser diode + TTL driver', 2200, 3500],
      ['Adjustable laser housing / heatsink', 400, 700],
      ['Safety enclosure (MDF / opaque acrylic)', 800, 1200],
      ['Lid interlock microswitches + E-stop', 250, 400],
    ],
  },
  {
    category: 'Structure, Wiring & Hardware',
    items: [
      ['2020 aluminium extrusions + brackets', 1200, 1800],
      ['3D printed mounts + substrate bed', 500, 800],
      ['Wires, sleeves, heat-shrink, M3/M4 fasteners', 600, 900],
    ],
  },
];

export const SAFETY = [
  '405 nm laser can cause permanent blindness instantly: keep the amber UV-filtering enclosure closed.',
  'Magnetic lid interlock must cut laser power whenever the lid opens.',
  'Photoresist, acetone and IPA need ventilation; use a filtered mini fume-extractor box without a cleanroom hood.',
];

export const COMPONENTS = {
  head: {
    title: '405 nm optical head',
    text: 'Focused violet laser diode (or salvaged Blu-ray PHR-803T pickup). A heatsink and TTL/PWM driver set the dose; the voice coil moves the lens for focus.',
  },
  stage: {
    title: 'X–Y stage',
    text: 'NEMA 17 steppers turn Ø8 mm T8 screws on MGN9/MGN12 rails. With a T8x2 screw, one 1.8° full step advances 10 µm; at 16× microstepping the resolution is 0.625 µm. The stage travels 50 × 50 mm.',
  },
  wafer: {
    title: 'Substrate + resist',
    text: 'Spin-coated glass slide, silicon fragment, polymer or biopolymer. Film thickness falls with roughly the square root of spin speed.',
  },
  lid: {
    title: 'Amber safety lid',
    text: 'UV-filtering acrylic panel. Opening it trips the magnetic interlock and immediately disables the laser driver.',
  },
  interlock: {
    title: 'Magnetic interlock',
    text: 'Hardware safety switch in series with the laser driver. The simulator refuses to fire when the lid is open or the E-stop is pressed.',
  },
  motor: {
    title: 'NEMA 17 + A4988',
    text: '42.3 mm face, 40 mm body, 31 mm mounting centres and a 5 mm D-shaft. A4988 at 16× gives 3200 microsteps/rev; GRBL needs $100/$101 = 3200/lead steps/mm (1600 for T8x2). Only the shaft and coupler rotate.',
  },
  qpd: {
    title: 'Astigmatic focus sensor',
    text: 'The four-quadrant photodiode reads an ellipse whose aspect ratio flips through focus. The S-curve (A+C)−(B+D) drives the Z-axis voice coil.',
  },
};
