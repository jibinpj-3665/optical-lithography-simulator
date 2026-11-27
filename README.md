# Optical Lithography Simulator

An interactive **3D simulator of a DIY desktop UV direct-write lithography machine**. It recreates the machine described in the uploaded project documents — a 405 nm focused laser on an X–Y lead-screw stage inside an amber, interlocked enclosure — and couples it to a simplified but physically motivated process model: spin coating, laser exposure, resist development and astigmatic autofocus.

Everything runs in the browser. Three.js is vendored in `vendor/`, so there is no build step and no runtime network dependency.

## Live demo

Published with GitHub Pages at **https://jibinpj-3665.github.io/optical-lithography-simulator/**

## Run locally

```bash
git clone https://github.com/jibinpj-3665/optical-lithography-simulator.git
cd optical-lithography-simulator
npm start          # http://localhost:8080
```

`npm start` uses only Node's standard library. You can also open `index.html` directly if your browser allows ES modules from `file://`; a local server is recommended.

## What it simulates

### 3D machine
- PBR-lit 2020 aluminium frame with chamfered extrusions, T-slot grooves, bolts and a gridded base plate. Procedural brushed-metal textures and a room-environment map give the metals realistic reflections.
- X–Y stage with NEMA 17 motors, lead screws with visible helical threads, MGN rails, a drooping cable chain and a rotating wafer chuck.
- Two CC0 catalogue meshes add real component detail: an Innerscene NEMA 17 motor with mount and an Innerscene inline-round duct fan used as the fume extractor. The procedural versions remain as fallbacks.
- Fixed optical head with heatsink, voice-coil lens, quadrant photodiode and an amber-transmission safety label.
- Wafer surface uses a texture-mapped resist layer that updates after development, with bump mapping for topography.
- Amber enclosure with a hinged lid, rubber gasket, magnetic interlock LED, control panel, E-stop and a spinning fume-extractor fan.
- Clickable component hotspots (attached to moving parts where relevant), five camera presets, orbit/zoom controls and optional auto-orbit.

### Mechanical dimensions and motion
- The scene uses **1 unit = 1 mm**. The frame is 200 × 180 × 140 mm; X/Y travel is 50 × 50 mm.
- Parts follow catalogue dimensions: 20 × 20 mm T-slot extrusion with a 6.2 mm slot, NEMA 17 motors with a 42.3 mm face / 40 mm body / Ø5 mm shaft / 31 mm mounting centres, MGN9/MGN12 rails and blocks, and Ø8 mm T8 screws with a 2 mm thread pitch.
- **Lead screw selector:** T8x2 (1 start, 2 mm lead), T8x4 (2 starts, 4 mm lead) or T8x8 (4 starts, 8 mm lead). Changing the selection swaps the visible helices and updates the resolution readout.
- **Kinematics:** motor bodies stay fixed; only the shaft, coupler and screw rotate. Screw angle = travel ÷ lead × 360°. With 1.8° NEMA 17 motors and 16× A4988 microstepping, GRBL-style steps/mm = 200 × 16 ÷ lead (1600, 800 or 400 steps/mm).
- **Jog pad / Home:** move 5 mm per tap or return to origin with smooth acceleration/deceleration; the stage, cable chain and live position/angle readouts follow the programmed feed.
- **Run job:** the generated G-code drives the stage at the selected feed; the cable chain follows the carriage and the laser beam follows the focal plane.
- **Spin coat now:** spins the chuck for 3 s using ω = 2π·rpm/60; high rpm aliases at display frame rate, as on a real camera.
- **Lid/E-stop:** the lid swings open on its hinge, the interlock LED turns red, and the laser, beam and job stop.

### Process physics
| Stage | Model |
| --- | --- |
| Spin coat | `h ∝ (solids/viscosity)^a · rpm^-1/2`, with edge bead and soft-bake effects |
| Exposure | Gaussian waist `w(z) = w₀√(1 + (z/zR)²)`, `zR = πw₀²/λ`; scanned-line centre dose `D = 0.1·√(2/π)·P/(v·w)` in mJ/cm², using effective power `rated mW × PWM duty`. Matches the beam/dose formulation in Ghalehbeygi et al. (ACC 2018). |
| Development | Hill contrast curve `rate = r_dark + r_max·(D/Dth)^γ / (1 + (D/Dth)^γ)`, positive or negative tone |
| Autofocus | Astigmatic quadrant signal, S-curve `FES = 2[(A+C)−(B+D)] / Σ`, closed-loop Z steps until `|FES| < 0.02` |
| Metrology | Residual film thickness, exposed area, dose ratio, and an achievable-CD estimate from spot size, defocus and stage error |

All values are educational approximations, not process-control data for fabrication.

### Toolpaths
Generated jobs (line, line array, grid, serpentine, spiral, interdigitated electrodes, microfluidic channel, transistor) produce GRBL-style `G0/G1/G4/M3/M5/M2` G-code. The same segment list drives the 3D stage animation, the dose map and the developed image.

### Safety model
Opening the lid or pressing the E-stop forces the laser driver off, pauses the job and disables beam rendering. This mirrors the document's requirement for a UV-filtering amber enclosure and magnetic interlock. Real 405 nm lasers can cause instant permanent blindness; chemical handling needs ventilation.

## Performance notes

Recent three.js guidance was applied in `js/machine.js`:
- device pixel ratio capped at 1.5× to avoid rendering 9× the pixels on 3× displays;
- a 1024² `PCFShadowMap` instead of the deprecated soft-shadow constant;
- static frame/rail/fitting geometry is merged per material (`js/machine.js`), cutting draw calls from ~458 to ~185 even after adding the two detailed GLB assets;
- hotspot DOM positions are reprojected only when the camera or an attached part moves;
- a live FPS / draw-call HUD is shown in the viewport toolbar;
- physics solves triggered by slider input are coalesced to one per animation frame in `js/main.js`.

## Online references used for the model

- [Three.js docs](https://threejs.org/docs/) — renderer and shadow guidance
- [Ossila spin-coating guide](https://www.ossila.com/pages/spin-coating) and [Meyerhofer (1978)](https://doi.org/10.1063/1.325357) — thickness ∝ ω⁻¹ᐟ² and viscosity dependence
- [Ghalehbeygi et al., ACC 2018](https://www.precisionmechatronicslab.com/wp-content/uploads/2021/02/C18c.pdf) — Gaussian beam intensity and scanned dose
- [Andersen et al., Applied Optics 41, 895 (2002)](https://opg.optica.org/ao/abstract.cfm?uri=ao-41-5-895) — linewidth vs power/velocity
- [Hnilicka et al., CCA 2002](http://congres.cran.univ-lorraine.fr/2002/CCA%202002/pdffiles/papers/154_ThA2-2.pdf) — astigmatic focus-error S-curve
- [MicroChemicals spin-coating notes](https://www.microchemicals.com/dokumente/application_notes/spin_coating_photoresist.pdf) — resist film thickness vs rpm, viscosity and soft bake
- [LDgraphy](https://github.com/hzeller/ldgraphy) — open 405 nm scanned-laser lithography and PRU-timed motor/laser control
- [GRBL settings](https://github.com/gnea/grbl/blob/master/doc/markdown/settings.md) — `$100/$101` steps/mm = motor steps × microsteps ÷ lead
- [OpenFlexure Block Stage](https://openflexure.org/projects/blockstage) — precision stage mechanics, flexures and backlash practice
- [Heidelberg MLA150 datasheet](https://heidelberg-instruments.com/wp-content/uploads/2025/06/Heidelberg-Instruments-MLA150-Datasheet.pdf) — raster-scan maskless writing and continuous autofocus
- [Colorado State LW405C](https://physlabs.colostate.edu/lithography/) — scanned UV spot, dose control and interferometric positioning
- [Desktop Maskless Lithography](https://iliasidorov.com/) — GDSII-driven desktop prototype with closed-loop stages and calibration

## 3D asset credits

The requested CGTrader and BlendSwap fan pages were checked, but the usable files were account-gated or had unclear redistribution terms, and `.blend` conversion is unavailable here. Bambu Lab / Creality-branded meshes likewise have no verified free-license download. The simulator therefore uses these original, explicitly CC0 alternatives, vendored locally in `assets/models/`:

- [NEMA 17 stepper motor with mount](https://www.innerscene.com/tools/library/3d-parts/nema-17-stepper-motor-with-mount-4eb49da6) — Innerscene, CC0 1.0. Used for both axis motors; the procedural shaft/coupler still spins so kinematics remain exact.
- [Inline round duct fan 200 mm](https://www.innerscene.com/tools/library/3d-parts/inline-round-duct-fan-200-mm-68691a8b) — Innerscene, CC0 1.0. Scaled into the rear fume-extractor bay; its rotor mesh spins independently.

## Source material

Built from these files in the parent folder:
- `Building a laboratory desktop semiconductor lithography machine.docx`
- `DIY UV spot-line lithography machine.docx`

The BOM and cost table are transcribed directly from the second document (₹13,668–₹20,400 including 20% contingency). The documents name NEMA 17 motors, T8 screws, MGN9/MGN12 rails, 2020 extrusion and a 405 nm laser but do not give exact part dimensions, so the model uses standard catalogue sizes for those components. The three accompanying `.jpg` photos could not be analysed by the available models, so the 3D geometry is reconstructed from the written specifications rather than traced from the photos.

## Project structure

```
index.html          UI shell and import map
styles.css          dashboard styling
server.js           dependency-free static server
js/config.js        document-derived constants, BOM, safety notes
js/patterns.js      toolpath generators + minimal G-code parser
js/process.js       physics solver and field colourisation
js/machine.js       Three.js scene, camera, PBR materials, moving mechanics
js/textures.js      procedural brushed metal, grid plate and label textures
js/ui.js            controls, charts, tables, event log
js/main.js          state orchestration, jogging and job animation
assets/models/      vendored CC0 GLB motor and fan assets
vendor/             vendored Three.js r180 modules and add-ons (including GLTFLoader)
```

## License

MIT — see `LICENSE`.
