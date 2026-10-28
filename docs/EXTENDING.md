# Adding exercises, variants and machine models

This guide describes the current implementation, not a separate plugin API. Read [the mechanics conventions](MECHANICS.md) and the preserved [handoff](../EXERCISE_BIOMECHANICS_HANDOFF.md) first. Keep calculations independent of React, drawing scale and playback speed.

## Choose the right kind of addition

| Addition | Use it when | Main changes |
|---|---|---|
| Educational preset / variant | Existing joint coordinates, constraints and force application points describe the movement | Add a stable preset ID and settings in `src/engine.ts`, a teaching question, aliases where appropriate, and a representative fixture |
| Exercise within a family | The existing mechanics genuinely fit, but the exercise needs distinct defaults, discovery or explanation | Add a preset/catalog entry, precise labels and assumptions; check that every relevant parameter is available |
| New mechanical family | The joint, movement plane, coupled path, support or force application differs | Extend the engine contract, state validation, controls, rendering and analytical tests together |
| Known machine | A mechanism or measured resistance profile is available | Add its geometry/transmission or calibrated profile with provenance, units and valid domain |
| Unknown machine | Mechanism/profile data are absent | Keep a geometry-only illustration with null mechanical results; identify the measurements needed |

Changing a display name does not add missing mechanics. For example, a hip extension must load an ankle about a hip coordinate; it cannot reuse an elbow curl's joint and grip application point.

## Add a preset using an existing model

1. Copy the nearest appropriate preset's settings into the `presets` array in [engine.ts](../src/engine.ts). Give it a new, stable `preset` ID, a descriptive `name`, the correct `model`, and a justified movement range. Preserve existing IDs because saves and exercise-name mappings refer to them.
2. State one teaching question: for example, “Does raising this curl outlet from 10 to 30 cm move the peak elbow resistance?” Keep body, actual force and joint range fixed when the question isolates outlet height.
3. Check the starting pose and the entire selected range. An educational preset may deliberately demonstrate assistance or contact, but its name/explanation should make that purpose clear. Do not label it universally optimal.
4. Add explicit metadata and searchable aliases in [catalog.ts](../src/catalog.ts): navigation muscle tags, equipment, main joint, starting posture, unilateral/bilateral convention, and model status. Add exercise-list aliases in [training.ts](../src/training.ts). Retain ambiguity when a training label could mean several models. Do not infer actual force from a pasted stack-load number.
5. Add a representative mechanics fixture and, when introducing new interaction behavior, a browser workflow. Verify discovery in **Exercise catalog**, correct model controls/view, A/B compatibility, save/export and reload.

The catalog combines engine presets with explicit metadata in [catalog.ts](../src/catalog.ts), then renders through [WorkspaceTools.tsx](../src/WorkspaceTools.tsx). A new preset requires that metadata but no separate hand-written card. The six examples in [COMPARISON_GUIDE.md](COMPARISON_GUIDE.md) show how to give a preset a reproducible purpose.

## Add a new family or degree of freedom

Define the coordinate before writing the drawing: its joint/reference point, positive axis, zero position, reference action and units. In the current engine, coordinates are angles; derivatives are per radian and displayed contribution is `R = −actionDirection × Σ F · dH/dq`, in N·m. A dimensionless progress coordinate cannot be inserted into this contract and still be labeled N·m. A coupled movement needs its own justified coordinate/output definition.

The main integration points are:

- **Engine:** extend `Model`, `Setup`/`Profile` where needed, and `definitions` in [engine.ts](../src/engine.ts). Implement the actual pose in `geometry`, including each load's application point and derivative. Define fixed supports, geometric closure, singular states and unknown inputs. Add explicit loads to `Geometry.loads`; do not hide inferred masses in rendering code.
- **Comparison meaning:** choose an honest `metricKey` and update `compatible` when necessary. Matching units alone does not make shoulder, elbow and hip contributions comparable. Bilateral totals and unilateral quantities also need an explicit convention.
- **Validation and saved data:** update the allowlists/bounds in `validateSetup` and `validateProfile` in [state.ts](../src/state.ts). For new body dimensions, update provenance/locks, `PROFILE_KEYS`, defaults, measurement definitions and estimate rules. Preserve measured fields. Check named snapshots and round-trips in [library.ts](../src/library.ts); do not rely on transient preset references to reproduce a save.
- **Interface and drawing:** expose meaningful controls in [WorkspaceTools.tsx](../src/WorkspaceTools.tsx) / [App.tsx](../src/App.tsx). Render `Geometry.limbs`, loads and landmarks in [Scene.tsx](../src/Scene.tsx), with the model's preferred view. Update [BodyDiagram.tsx](../src/BodyDiagram.tsx) for new measurement landmarks. Dragging and numeric entry must modify the same physical inputs.
- **Curves and analysis:** use the same `evaluate` results in [Curve.tsx](../src/Curve.tsx) and [analysis.ts](../src/analysis.ts). Preserve null gaps for unknown/invalid mechanics. Keep contact and mechanical reversal separate; inspect region integration, difference tables and exported explanations for the new model.

The current analytic contact candidates require fixed outlets/obstacles and harmonic attachment paths `C + A cos(q) + B sin(q)`. A moving pulley or general coupled path must supply suitable continuous event handling; it cannot inherit that guarantee merely because it returns similar points.

Minimum validation should include an independent analytical pose, force scaling, finite-difference virtual work where applicable, axis/sign conventions, rigid segment lengths, support/closure validity, singular/unknown/zero states and agreement between live evaluation and the curve. Add gravity additivity and mirrored-load cases when the model uses them. Tests should establish the declared model's behavior, not physiological validity.

## Add a real machine without inventing its resistance

Record the machine's model/version and the source of dimensions or measurements. Specify whether a supplied profile is angle–force, angle–moment at the machine pivot, or moment about a human joint. Those quantities are not interchangeable. Include units, interpolation, valid range, transmission convention, measurement uncertainty and lifting/lowering differences when known.

For a mechanism model, represent the pivot/linkage/cam and actual application/support points. For a calibrated profile, use its supported domain and return unknown outside it; do not silently extrapolate. A machine-pivot moment becomes a human-joint contribution only through a modeled transmission/support relationship. Add reference fixtures from the supplied data and a comparison with stated assumptions.

Until those inputs exist, follow `machine-unknown`: show the mechanism/support illustration, explain what is missing, and leave force and moment null. A user-edited theoretical curve needs its own hypothetical provenance and must not become a claim about a commercial machine.

## Version, verify and deliver

Change `MODEL_VERSION` when a correction or new convention changes the meaning/results of saved configurations. Add an explicit migration only when its meaning is known. The current [state](../src/state.ts) and [library](../src/library.ts) paths retain backups of old-model snapshots and surface recalculation; extend that behavior rather than silently replacing historical results.

Run the checks relevant to the addition: `npm test`, `npm run build`, interactive workflows with `npm run test:e2e`, and `npm run test:pwa` when delivered assets or offline behavior change. Update [MECHANICS.md](MECHANICS.md), the [acceptance map](ACCEPTANCE.md), and a comparison brief with assumptions, sources and a conditional conclusion. Follow [AGENTS.md](../AGENTS.md): publish and verify the same hosted application, keep the review branch current, and explain the technical result, biomechanical meaning and limits. A passing test suite is not evidence of muscle-growth superiority.
