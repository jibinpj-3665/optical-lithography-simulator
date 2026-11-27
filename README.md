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
| Exposure | Gaussian waist `w(z) = w₀√(1 + (z/zR)²)`, `zR = πw₀²/λ`; scanned-line dose `D = P / (v·σ·√(2π))` in mJ/cm², using effective power `rated mW × PWM duty` |
| Development | Hill contrast curve `rate = r_dark + r_max·(D/Dth)^γ / (1 + (D/Dth)^γ)`, positive or negative tone |
| Autofocus | Astigmatic quadrant signal, S-curve `FES = 2[(A+C)−(B+D)] / Σ`, closed-loop Z steps until `|FES| < 0.02` |
| Metrology | Residual film thickness, exposed area, dose ratio, and an achievable-CD estimate from spot size, defocus and stage error |

All values are educational approximations, not process-control data for fabrication.

### Toolpaths
Generated jobs (line, line array, grid, serpentine, spiral, interdigitated electrodes, microfluidic channel, transistor) produce GRBL-style `G0/G1/G4/M3/M5/M2` G-code. The same segment list drives the 3D stage animation, the dose map and the developed image.

### Safety model
Opening the lid or pressing the E-stop forces the laser driver off, pauses the job and disables beam rendering. This mirrors the document's requirement for a UV-filtering amber enclosure and magnetic interlock. Real 405 nm lasers can cause instant permanent blindness; chemical handling needs ventilation.

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
