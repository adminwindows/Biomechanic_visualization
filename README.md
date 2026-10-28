# Exercise Biomechanics Lab

**[Open the app](https://exercise-biomechanics-lab-charles.charlestahan93.chatgpt.site)** — no local installation or build required.

An interactive workspace for asking what changes when you move an outlet, alter a body dimension, choose another movement path or supply a measured resistance curve. Compare the resulting mechanics, check whether the conclusion survives plausible measurement error, and keep the evidence with the configuration. The [original handoff](EXERCISE_BIOMECHANICS_HANDOFF.md) is preserved unchanged.

## Choose a workspace

The shared catalog searches exercises, aliases and equipment across the application and opens the relevant workspace. Muscle tags help navigation; they do not measure recruitment.

| Workspace | What you can compare | Meaning of the result |
|---|---|---|
| **Joint & exercise comparison** | Pullovers, curls, triceps extensions, raises, flyes/reverse flyes, isolated hip/knee/wrist movements, forearm rotation and shrugs | External contribution about the declared coordinate: rotational N·m or translational N |
| **Compound movements** | Coupled pullovers, pulls, rows, presses, bodyweight movements, hinges, squats/lunges, calves and trunk movements | External contribution along a prescribed path, in J per unit progress; selected arm-axis moments where their assumptions permit |
| **Machines & measured profiles** | Plate-loaded levers, cable/belt transmissions, supplied cam arms, four-bar linkages and measured/supplied curves | Machine-input moment or measured force, with explicit coordinate, domain, provenance and uncertainty |
| **Find a setup & research** | Height–distance placement maps, constrained search, measurement sensitivity, prescribed-speed power and an evidence notebook | Several mechanical trade-offs under stated constraints, linked to reproducible comparisons |

[COVERAGE.md](docs/COVERAGE.md) maps every family in handoff §9.3 to its workspace and model. An exercise name does not establish that all its joint moments or a particular commercial mechanism are known. Each workspace states which quantities it can calculate.

## A useful first comparison

1. Open **Example comparisons** and load a prepared study, or choose an exercise for A from the catalog. Enter your body dimensions if available; the starting proportions are editable examples.
2. Copy A into B. Enable **Same body** and **Same force per attachment**, then leave **Same equipment** off when equipment is the variable you want to change. Move only B's pulley height and inspect the differences table.
3. Choose a criterion and movement region. Check resistance sign, contact/travel limits and unavailable portions before comparing means or work. Equal progress is a timing convention; it does not mean equal joint angles.
4. Open **Find a setup & research** to map several placements. The search holds the original body, load convention, actual force and movement range fixed. Inspect the trade-off candidates and the sampled measurement envelope, then load one against the original baseline.
5. Save a research note with the question, finding, limitations, next measurement and any relevant citations. Choose its source workspace explicitly: joint, compound or machine. The note retains that comparison and can restore it later. A model calculation, personal observation, study result and hypothesis remain separate categories.

The [comparison guide](docs/COMPARISON_GUIDE.md) and [portable examples](public/examples/README.md) give reproducible starting questions. [COVERAGE.md](docs/COVERAGE.md#worked-workflows) adds compound, machine-data and uncertainty workflows.

## Keep and restore your work

A and B have separate settings, body snapshots and movement positions. Copy/swap, undo/redo, movement synchronization and body/load/equipment locks support controlled and practical comparisons. Joint/exercise drafts return when you revisit an exercise; shared view, zoom and pan are saved. Compound and machine comparisons also have persistent workspaces and named libraries.

Use **Whole workspace backup** to export the current comparison, per-exercise drafts, libraries, compound and machine workspaces, saved research notes, favorites and confirmed training-list mappings. Import previews the included sections, validates them and retains a recovery copy before replacement. An unsaved research note or unapplied machine-curve edit blocks whole-workspace export, restore and the managed app-update reload until you save/apply or explicitly discard it. Navigating between workspaces preserves these open drafts; an ordinary browser reload can still lose unfinished text. Individual comparison, profile, library, notebook and map exports remain available.

Data stays in this browser unless you export it. Browser storage can be cleared, so keep a portable backup. The app has no body-measurement upload, telemetry, application account database or automatic cloud synchronization. Private hosted access is handled by the hosting service. A native mobile package is not required or promised.

## Read the quantities correctly

Positive resistance opposes the named reference action; negative resistance assists it. Returning through the movement does not rename that action. Actual attachment force, selected stack mass and resultant force are different quantities. Shared implements and independent loads have explicit conventions; two oblique 100 N cables need not produce a 200 N resultant.

A rotational coordinate yields N·m. A shrug's vertical coordinate yields N. A compound path uses J per unit progress, which must not be labeled as joint torque. Closed-chain support reactions and joint sharing are not reconstructed from the external load alone. A machine's pivot moment becomes an equivalent human-joint contribution only through an explicitly declared alignment/transmission assumption.

The views and calculations share the same geometric inputs. Optional body capsules and named seat/frame boxes or capsules let you test represented obstructions; these are simplified proxies. User-declared equipment adjustment bounds are separate from collision geometry and cable-travel limits. Segment lengths, grip closure, support reach, represented contacts and declared cable travel can invalidate a pose or result. **Usable range according to the model** selects a connected permitted portion while retaining the original range. It is a geometric restriction, not an assessment of personal mobility, balance or real-equipment safety.

These models do not predict muscle activation, internal muscle forces, exact muscle lengths or hypertrophy. A higher curve answers a specified mechanical question; it does not establish a better exercise. Measured machine data and user observations add evidence without turning a hypothetical mechanism into a calibrated one. See [MECHANICS.md](docs/MECHANICS.md) for equations, assumptions and numerical limits.

## Offline use and verification

On the first production load, wait for **Offline ready** before disconnecting. Install through the browser's offered action or its add-to-home-screen menu. Updates wait for **Save & update**. [OFFLINE.md](docs/OFFLINE.md) describes preparation, cache repair and update behavior.

[ACCEPTANCE.md](docs/ACCEPTANCE.md) maps the handoff requirements and [VERIFICATION.md](docs/VERIFICATION.md) records the checks actually run. Phone emulation is distinct from installation, storage retention and performance on a physical Android device. Source changes and test definitions alone are not evidence of a completed device or physiological validation.

## Development

Use Node.js 22.12+ and npm. The hosted app is the normal feedback route; local commands are for development.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
npm run test:pwa  # Build first; production offline/update checks
npm run preview
```

Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing executable. Browser suites start or reuse their own servers. Do not build concurrently with the offline-update suite, which temporarily exercises alternate production assets.

The code separates isolated mechanics (`engine.ts`, `isolatedJoints.ts`), compound paths (`compoundEngine.ts`), machine profiles (`machine.ts`), analyses, views and validated persistence. [EXTENDING.md](docs/EXTENDING.md) explains their different contracts. [CHANGELOG.md](CHANGELOG.md) records the development history. Delivery obligations, including a working hosted link and an explanation of the biomechanical meaning, are in [AGENTS.md](AGENTS.md).
