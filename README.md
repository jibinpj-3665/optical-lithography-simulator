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
- 2020 aluminium frame, base plate, X–Y stage with NEMA 17 motors, T8 lead screws and MGN linear rails.
- Fixed optical head with heatsink, voice-coil lens and a quadrant photodiode.
- Wafer chuck and a texture-mapped resist surface that updates after development.
- Amber enclosure with a hinged lid, magnetic interlock and emergency stop.
- Clickable component hotspots, six camera presets and orbit/zoom controls.

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
- hotspot DOM positions are reprojected only when the camera changes;
- a live FPS / draw-call HUD is shown in the viewport toolbar;
- physics solves triggered by slider input are coalesced to one per animation frame in `js/main.js`.

## Online references used for the model

- [Three.js docs](https://threejs.org/docs/) — renderer and shadow guidance
- [Ossila spin-coating guide](https://www.ossila.com/pages/spin-coating) and [Meyerhofer (1978)](https://doi.org/10.1063/1.325357) — thickness ∝ ω⁻¹ᐟ² and viscosity dependence
- [Ghalehbeygi et al., ACC 2018](https://www.precisionmechatronicslab.com/wp-content/uploads/2021/02/C18c.pdf) — Gaussian beam intensity and scanned dose
- [Andersen et al., Applied Optics 41, 895 (2002)](https://opg.optica.org/ao/abstract.cfm?uri=ao-41-5-895) — linewidth vs power/velocity
- [Hnilicka et al., CCA 2002](http://congres.cran.univ-lorraine.fr/2002/CCA%202002/pdffiles/papers/154_ThA2-2.pdf) — astigmatic focus-error S-curve

## Source material

Built from these files in the parent folder:
- `Building a laboratory desktop semiconductor lithography machine.docx`
- `DIY UV spot-line lithography machine.docx`

The BOM and cost table are transcribed directly from the second document (₹13,668–₹20,400 including 20% contingency). The three accompanying `.jpg` photos could not be analysed by the available models, so the 3D geometry is reconstructed from the written specifications rather than traced from the photos.

## Project structure

```
index.html          UI shell and import map
styles.css          dashboard styling
server.js           dependency-free static server
js/config.js        document-derived constants, BOM, safety notes
js/patterns.js      toolpath generators + minimal G-code parser
js/process.js       physics solver and field colourisation
js/machine.js       Three.js scene, camera, hotspots, animation hooks
js/ui.js            controls, charts, tables, event log
js/main.js          state orchestration and job animation
vendor/             vendored Three.js r180 modules
```

## License

MIT — see `LICENSE`.
