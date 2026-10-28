# Exercise Biomechanics Lab

An interactive pullover workbench for comparing how body dimensions, posture and cable equipment change external resistance. This is the first runnable milestone from [the project handoff](EXERCISE_BIOMECHANICS_HANDOFF.md), which is preserved unchanged.

## Run locally

Use Node.js 22.12+ (verified with Node 24) and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. On a remote development machine, forward that port before opening it on your own device.

```sh
npm test          # Mechanics and comparison/profile/storage tests
npm run build    # Strict TypeScript checking and production build
npm run preview  # Serve the production build
```

For browser workflows:

```sh
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path instead of installing another copy. Tests start or reuse the development server.

Initial verification: the production build passes, all 46 mechanics/state tests pass, and all 18 browser cases pass across desktop and 360 px emulated-phone layouts in Chromium. Actual Android hardware and offline installation remain untested.

## First things to try

1. Move the elevation slider through the repetition and watch the signed cable contribution and its marker on the curve.
2. Copy A into B, then change only B's pulley height. Enable **Same body** and **Same force per cable** for a controlled comparison.
3. Select **Inside · upright**, set the arm elevation to 180°, and observe that a taut cable can assist bringing the arms toward the torso.
4. Select a bench preset, then switch to **Top view**. Outlet separation, bar attachment separation and backrest width affect spatial clearance.
5. Open **Body profile**. Enter a measured upper-arm length, then change height: that measurement stays fixed while unmeasured estimates update.

## Implemented

- Eight educational presets covering the classic, outside, inside and bench-supported pullover setups.
- Side/top SVG projections from one three-dimensional geometry engine and shared A/B scale.
- Same-angle, equal-progress and independent positions, animation, copy/swap, undo/redo.
- Signed total cable contribution and overlaid curves with gaps for contact or invalid geometry.
- Actual force in newtons per cable, fixed elbow bend, body segments and equipment dimensions.
- Backrest–cable and backrest–bar contact checks in space.
- Example/estimated/measured body provenance and segment locks; body changes preserve equipment placement.
- Automatic browser-local saving, versioned JSON export/import with validation and protection for unreadable previous saves.
- English interface, keyboard controls and stacked mobile comparison.

No account, server database, telemetry, or transmission of body measurements is used. Browser storage is local to the browser/origin and can be cleared; export comparisons to retain a portable copy.

## Meaning and limits

The reported N·m value is the **total external cable contribution to a symmetric, fixed-elbow movement**. Positive means resistance to bringing the arms toward the torso; negative means assistance, regardless of animation direction. It is not per-shoulder torque, muscle tension, or a hypertrophy score.

Force is specified **per attachment**. The default A has one 100 N cable; B has two 100 N cables. Their difference combines setup and loading differences. Use the copy/change-one-parameter workflow to isolate geometry.

The first model derives grip width from shoulder width to preserve rigid-bar closure. Bar attachment spacing is separate. Height estimates scale fictional demonstration proportions and are not a validated prediction of individual anatomy. The current model covers the upper body; standing support and leg geometry are not solved.

Contact checks cover the represented backrest only. Curves use refined sampling, not guaranteed continuous collision detection. Gravity, inertia, friction, cable routing after contact and unknown machine resistance are excluded. Detailed equations and reference tests are in [docs/MECHANICS.md](docs/MECHANICS.md).

## Project structure

- `src/engine.ts` — pure geometry, forces, contacts and presets.
- `src/state.ts` — body profiles, comparison synchronization, validation and persistence.
- `src/Scene.tsx`, `src/Curve.tsx` — geometry views and overlaid resistance curves.
- `src/App.tsx`, `src/styles.css` — responsive controls and explanations.
- `src/*.test.ts`, `e2e/` — numerical and browser workflow checks.

## Next review

This is a first J0/J1 slice, not completion of the handoff's full release. Review drawing clarity, equipment controls and the usefulness of the A/B comparison before expanding the catalog.

The next useful comparison is a height–distance map over a selected overhead elevation range, constrained by represented bench clearance. Before adding a guaranteed usable-range limiter, implement continuous event detection. Other remaining work includes draggable geometry/zoom, broader body and equipment models, the other exercise families, named comparison libraries, and PWA installation/offline caching. Android device behavior and PWA installation have not been verified.
