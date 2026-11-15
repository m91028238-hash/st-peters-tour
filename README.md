# St Peter’s Basilica: a walking tour (v5)

Static site: open `index.html` through any web server (e.g. `python3 -m http.server`). No build step.

- `js/basilica.js` – the building (metres, crossing centre at the origin, entrance at +z)
- `js/tour.js` – renderer, light, bloom, walk / free camera, info points; walking uses a floor grid sliced from the built geometry (solid walls, piers, altars and railings only), so every aisle, chapel, transept, the apse and the space round the baldacchino can be reached
- `js/main.js` – page UI and fullscreen
- `tools/` – asset preparation and screenshot scripts: `sculpt/` sculpts the statues (sdf.py, fig.py, body.py; peter.py, crossing.py, founders.py, angel.py) and bakes them in headless Blender (bake.py, bakeq.sh, lobake.sh for the mobile versions, finish.sh, turn.py), `shoot.py` and `touchtest.py` use a local headless Chrome, `errs.py` checks the console, `fps.py` measures frame rate at 412×915
- `tools/photoproj/` – v5 photo projection: landmarks (lm/*.json), solved cameras (cams/*.json), mesh warp, projection/blending (texture.py), alignment checks; working files live in /workspace/v5 and /workspace/sc5
- `tools/walktest.py` – walks to every area with the touch joystick at 412×915 and reports arrival or where it got stuck
- `previews/v5/` – before (v4) / after (v5) views of every statue, in the scene (mobile and desktop) and as front and three-quarter model renders
- `previews/v4/` – before/after views of every statue and the new altar mosaics and monuments (mobile and desktop)
- `previews/` – 25 views at 412×915 (touch) and 1280×800, the touch test, and `previews/statues/*-turnaround.jpg` (six-angle renders of every statue model)

Credits and licences: see ASSETS.md.
