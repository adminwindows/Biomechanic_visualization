# Exercise Biomechanics Lab

**[Open the app — no installation or local build required](https://exercise-biomechanics-lab-charles.charlestahan93.chatgpt.site)**

An interactive workspace for understanding how exercise setup changes external resistance. Compare body proportions, posture, equipment, force and movement ranges, then record what the comparison establishes. The [original project handoff](EXERCISE_BIOMECHANICS_HANDOFF.md) is preserved unchanged.

## Try it

1. Open **Exercise catalog** and load a low-cable curl into A. The model rotates about the elbow; a lateral raise uses a different shoulder coordinate and front view, while hip extension loads the ankle.
2. Copy A into B and change only B's pulley height. Use the body, equipment and actual-force locks to define what stays constant. A differences table makes the changed variables visible.
3. Compare cable and dumbbell lateral raises at the same force per attachment. Select a movement region to compare the minimum, maximum and mean external contribution, and mechanical work over that interval.
4. Drag a pulley, pelvis or active grip/ankle. Numeric fields and keyboard controls provide alternatives. Zoom and pan remain shared between A and B.
5. Save named comparisons and body/equipment profiles. Export a comparison, the entire library, or a readable comparison report. Paste an exercise list or CSV to find supported movements and resolve ambiguous names.

For a faster start, open **Example comparisons** and load one of the three prepared studies directly. Undo returns to your previous comparison; each example is also available as portable JSON.

On first production load, wait for **Offline ready** before disconnecting. Installation depends on your browser: use the install action when offered, or the Android browser's install/add-to-home-screen menu. An update waits for the explicit **Save & update** action. See [offline behavior and verification](docs/OFFLINE.md).

## Exercise models

| Family          | Included scenarios                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Pullover        | Conventional single cable including horizontal/kneeling; facing away outside; inside the outlet plane; bench-supported from flat to upright |
| Elbow flexion   | Low-cable curl; upper arm behind torso / Bayesian curl                                                                                      |
| Elbow extension | Pushdown; overhead extension with adjustable upper-arm posture and facing direction                                                         |
| Lateral raise   | Unilateral cable with fore–aft outlet placement; dumbbell with gravity and body inclination                                                 |
| Shoulder fly    | Two independent cable handles in the transverse plane                                                                                       |
| Hip movement    | Cable hip extension with an ankle attachment                                                                                                |

There are 18 educational presets spanning the 12 specified scenarios, including extra pullover examples and a clearly non-quantitative unknown-machine illustration. Presets use appropriate kinematics, axes and force application points; the catalog does not relabel one drawing as different exercises.

## What is implemented

- Side, front and top SVG projections of a shared 3D engine; articulated body/support geometry, force arrows, draggable points and shared framing.
- Equal-angle, equal-progress and independent positions; animation speed/reduced-motion controls; copy/swap and undo/redo. Incompatible joint coordinates show separate curves and no numerical ranking.
- Explore mode retains the chosen range; **Usable range according to the model** constrains movement to a selected clear interval without replacing the original range. Shared movement respects both panels. Unknown mechanisms and slack cable routes remain unavailable for this clearance constraint.
- Actual cable force, selected mass with an explicit transmission factor, dumbbell weight, distinct unknown/slack/zero-force states, and optional explicitly supplied arm or leg segment masses.
- Cable and gravity contributions separately and combined; signed moments, selected-region summaries, external work, separate contact/reversal events, settings differences, parameter sweeps and sensitivity checks.
- A symmetric rigid-bar grip solver preserving upper-arm/forearm/hand lengths and the fixed elbow bend. Incompatible grip/bar/support constraints are reported, without stretching body segments or moving equipment.
- Spatial backrest–cable and backrest–bar contacts. Analytic event candidates prevent narrow represented contacts and tangencies from falling between regular curve samples.
- Height plus refined arm, torso, shoulder, pelvis, thigh, lower-leg, foot and head/neck dimensions; landmark diagram, example/estimated/measured provenance and locks. Explicit regeneration preserves measurements and locked fields.
- Named comparison, body and equipment/setup libraries; favorites, validated portable JSON, readable reports, and backups before legacy-model or unreadable saved data is replaced.
- Searchable exercise aliases and filters for navigation muscle tags, equipment, joint, posture, unilateral/bilateral setup, and available model. Three ready-to-load comparisons provide reproducible starting questions.
- Exercise-name/CSV matching that retains ambiguous and unsupported names and the user's explicit resolutions.
- A comparison notebook distinguishing model calculations, assumption-based estimates, empirical evidence and hypotheses. It does not fabricate training-study findings.
- Install manifest/icons, verified offline caching, cache repair and controlled updates that retain in-progress state.

## Interpreting the results

A positive external contribution resists the **named reference action**; a negative one assists it. Playback direction does not change that definition. The quantity is about the modeled coordinate and load convention; it is not automatically an individual shoulder moment, muscle tension, or hypertrophy score.

Force is entered per attachment. Two oblique 100 N cables do not necessarily produce a 200 N resultant. The default pullover A/B examples have different cable counts: use copy-and-change-one-parameter for a controlled geometry comparison. Matching selected mass can still produce different actual force when transmission factors differ.

For a simple gravity example, an upright 5 kg dumbbell raise with 0.70 m straight shoulder-to-grip reach produces about 17.2 N·m at 30° and 34.3 N·m at 90°, with segment weight excluded. The changing leverage explains these numbers; it does not establish a muscle-growth advantage over a cable setup.

Body estimates scale fictional reference proportions, not a validated individual anthropometric prediction. Support checks preserve modeled segment lengths but do not solve balance, ground reactions or stability. Collision results cover the represented backrest; seats, frames, cable guides and the body are not comprehensive contact models. Friction, inertia, muscle forces and commercial-machine cams require additional models or measurements. These assumptions are detailed in [MECHANICS.md](docs/MECHANICS.md).

The broader exercise wishlist, muscle-model research and commercial-machine calibration in the handoff require their own suitable models and data; unsupported movements are not presented as simulated.

## Verification and acceptance

[ACCEPTANCE.md](docs/ACCEPTANCE.md) maps all 26 handoff acceptance criteria to implementation and checks. [VERIFICATION.md](docs/VERIFICATION.md) records observed results, and [OFFLINE.md](docs/OFFLINE.md) explains production cache/update verification. Automated browser checks cover desktop, a 360 px phone viewport and phone landscape. Actual Android installation and performance on the user's physical device remain device acceptance, not a claimed result of emulation.

Use the [comparison guide](docs/COMPARISON_GUIDE.md) for questions and conditional interpretations across the six families, and the [importable examples](public/examples/README.md) for portable starting comparisons. The [extension guide](docs/EXTENDING.md) explains how to add a suitable model or preset. [CHANGELOG.md](CHANGELOG.md) records delivered behavior and decisions.

## Development

Use Node.js 22.12+ and npm. Local setup is for development; the hosted link above is the normal way to test deliveries.

```sh
npm ci
npm run dev
```

```sh
npm test          # Mechanics, state, libraries, analyses, exercise-name matching
npm run build    # TypeScript + production assets + generated offline worker
npm run test:e2e  # Interactive browser workflows and responsive layouts
npm run test:pwa  # Production offline/cache/update workflows (build first)
npm run preview  # Serve production assets locally
```

Run `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing Chromium executable. Browser tests start/reuse their own development or production servers. Do not run another build while the offline-update tests temporarily exercise alternate build assets.

The app has no account database, telemetry or body-measurement upload. Settings and libraries stay in browser storage; export portable backups because browser storage may be cleared. Private Site access uses the hosting service's account gate.

## Source organization

- `src/engine.ts`: geometry, supports, forces, grip/contact solvers and exercise definitions.
- `src/state.ts`, `src/library.ts`, `src/training.ts`: state invariants, provenance, persistence and exercise-name matching.
- `src/Scene.tsx`, `src/Curve.tsx`, `src/BodyDiagram.tsx`: interactive views and measurement landmarks.
- `src/analysis.ts`, `src/AnalysisPanel.tsx`: comparable metrics, events, differences and interpretation.
- `src/App.tsx`, `src/WorkspaceTools.tsx`, `src/Field.tsx`: controls, catalog and saved workspaces.
- `src/offline.ts`, `src/OfflineStatus.tsx`, `scripts/generate-sw.mjs`: installation/offline/update behavior.

Every delivery must include a verified hosted test link, an explanation of the technical and biomechanical work, the checks actually performed, the remaining limits, and the GitHub source location. This requirement is recorded in [AGENTS.md](AGENTS.md).
