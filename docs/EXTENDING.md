# Extend the model without changing its meaning silently

Start with a question, the quantity needed to answer it and the inputs needed to calculate that quantity. Choose the existing mechanical contract that fits. A familiar exercise name is not enough to justify reusing a path, force convention or result label.

| Contract | Appropriate extension | Output obligation |
|---|---|---|
| Isolated coordinate | A declared joint rotation or translation with defined application-point motion | N·m for rotation defined in radians or N for translation defined in metres; compatible coordinate/action metadata and valid geometry |
| Compound path | Several prescribed joint/segment motions, possibly with supports | J per unit progress; individual axis moments only where the force/support assumptions identify them |
| Machine input | A specified mechanism or supplied/measured profile | Machine-input moment or force, valid domain, provenance and conditional joint mapping |

## Add a preset or catalog entry

Use a preset when an existing model already represents the required degrees of freedom, load, support and constraints. The expanded isolated settings live in [exercisePresets.ts](../src/exercisePresets.ts), merged with the base presets in [engine.ts](../src/engine.ts). [catalog.ts](../src/catalog.ts) supplies search/navigation metadata. Compound entries and their declared mechanics live in [compoundEngine.ts](../src/compoundEngine.ts).

Give the entry a stable identifier, an honest name, aliases and a concrete comparison purpose. Confirm that every changed parameter affects the intended geometry or force. A grip annotation can help discovery without claiming that it changes muscle recruitment. A high/low fly trajectory must change its movement plane; moving only an outlet does not create a new hand path.

Declare status and provenance. A theoretical machine, unknown mechanism or prescribed compound path must retain its explanatory status in the catalog, selection controls, exports and training-list matching. Ambiguous imported names need a user resolution; do not map them to an unrelated drawing just to produce a match.

Check discovery, preferred view, controls, a representative valid pose, actual parameter effects, persistence and export/reload. Verify that switching exercises restores the correct panel's draft rather than another exercise's values.

## Add an isolated coordinate

Define the coordinate before drawing it: origin/axis or translational direction, zero, units, reference action, positive direction and load convention. `getDefinition` supplies the coordinate unit and conversion to SI. Its `metricKey` must distinguish incompatible actions or unilateral/bilateral meanings even when their units match.

The result follows `R = −actionDirection × Σ F · dH/dq`. Here q is radians for a rotation or metres for translation. Public controls can use degrees or centimetres, but derivatives, integration and power must use the declared conversion. Do not use dimensionless progress as a derivative and label the result N·m.

Integration points:

- Add true geometry/application-point derivatives in [engine.ts](../src/engine.ts) or the relevant module, such as [isolatedJoints.ts](../src/isolatedJoints.ts). Declare supports, grip closure, floor/travel limits and unknown inputs. Rendering consumes that geometry rather than maintaining a second pose model.
- Represent each load explicitly, including per-hand versus total shared mass. Keep actual force, selected mass, transmission, slack and unknown states consistent with the shared force helpers and UI locks.
- Extend the schema and bounds in [state.ts](../src/state.ts). New body fields need measurement definitions, provenance, locks and explicit estimate-regeneration behavior. Validate snapshots, not just preset references.
- Update controls, diagrams, [Scene](../src/Scene.tsx), [Curve](../src/Curve.tsx), [analysis](../src/analysis.ts), differences and reports. All must display the correct coordinate/output unit and preserve unavailable results.
- Supply event handling suited to the trajectory. Current harmonic rotational and affine translation candidates cover their declared fixed geometry. A new path or obstacle cannot inherit continuous-detection claims merely by returning similar-looking points. Update usable-range constraints and search validity as well as plotted curves.

Useful independent checks include an analytical pose, force scaling, finite-difference virtual work, coordinate reversal, gravity additivity, load-count conventions, rigid segment lengths and support/closure boundaries. Verify zero, unknown, singular, contact and out-of-travel states separately.

## Add a compound path

Declare progress, start/end geometry, fixed/moving supports, loads, assistance and segment masses. The path derivative produces `−Σ F · dH/dp` in J per unit progress. Preserve segment lengths and verify neighbouring poses before differentiating.

A stationary support can do zero path work while its unknown reaction still prevents a unique individual-joint result. A moving support can contribute unknown work. Do not derive complete squat, pull-up or press joint moments from the external implement alone. Selected open-arm components need explicit axes and a defensible distal load set; they are not muscle forces or joint contact forces.

Add the entry to the compound catalog, controls and explanation. Keep scene bounds shared while labeling each quantitative chart's scale. Test path geometry, endpoint/intermediate validity, load directions, mass counting, stationary supports, singular derivatives and any claimed axis moments. A commercial-machine path with missing transmission remains an illustration.

## Add a machine or measured profile

The [machine engine](../src/machine.ts) separates lever, cable/belt, effective cam arm, four-bar linkage, data-curve and runtime-formula definitions. Reuse the appropriate mechanism only when its parameters are known. A cam-arm curve is not a physical cam reconstruction; a generic linkage is not every machine with several links.

Record coordinate/zero definition, reference action, domain, machine/source identity, load setting, measurement location/protocol and uncertainty. Keep lifting and lowering branches separate. Return unavailable outside the supported domain; do not silently extrapolate or synthesize the other branch.

Force data remains force unless a signed moment arm is supplied. A machine pivot is not automatically a human joint. A constant-ratio/aligned-axis conversion needs its explicit assumption and virtual-work mapping. More general human-machine coupling requires its own contact/transmission model.

Validate profiles, workspace comparisons and libraries together. Supply reference fixtures from real data when claiming measured agreement; label invented teaching values theoretical. Check coordinate-equivalence confirmation and incompatible-output display in machine A/B.

A new resistance function can use the existing runtime formula editor without adding a source preset. `MachineProfile.formula` declares expression, `angleUnit`, output quantity, optional signed force moment arm and named parameters with unit/meaning text. The profile domain remains degrees; a moment expression is signed against increasing input angle before `referenceAction` is applied. [machineFormula.ts](../src/machineFormula.ts) owns parsing, evaluation and conservative interval checks. Adding an operator/function requires syntax/arity and point-domain validation **plus interval semantics**; do not add dynamic JavaScript evaluation. Consumers of `sampleMachine` must honor `connectFromPrevious === false` even when both endpoint values are finite. It denotes an unsafe or unresolved intervening interval, not necessarily an invalid endpoint.

For raw measurements, reuse `buildCalibration` and `validateMachineCalibration` in [machineCalibration.ts](../src/machineCalibration.ts). Preserve original rows, separate branches, units, source/protocol and repeat statistics. The stored curve's `uncertainty` field carries the selected descriptive display spread for these imports; it must not be relabeled as a confidence interval. Mark `calibration.curveModified` when editing derived values or their reference sign independently, and retain the original record. Existing version-1 machine profiles remain valid without optional formula/calibration fields; validate new fields through profile, library, workspace and research-snapshot imports.

## Preserve and deliver the result

Update the relevant model version when meaning or results change. Migrate only known schemas/conventions; preserve originals and disclose recalculation. Comparison snapshots, per-exercise drafts, machine/compound libraries and notebook source versions all need compatible validation. [workspaceBackup.ts](../src/workspaceBackup.ts) explicitly allowlists portable stores; adding a new saved workspace requires a validator and restore/recovery behavior, not arbitrary storage-key import.

Check current edits and saved items separately. Research notes use an explicit save action. Typed source attachments must pass the original compound/machine validator, retain model/data provenance, and restore only their named workspace after a recovery copy. Preserve the mandatory joint-context snapshot for older notebooks. A source capture flushes current workbench edits first; it bypasses only the note form’s own draft guard, never unapplied machine data or storage failures.

The shared `biomechanics:flush-workspaces` event must either persist the latest valid work or append a clear error to its `detail.errors`. Unsaved note text and unapplied curve, formula or raw-calibration text block workspace export/restore and managed app-update reload until saved/applied or discarded. Backup guidance must not imply that unfinished text is silently included, or that an ordinary browser reload has the same guard. Editor source-sync effects must replace a draft only when the persisted source actually changes; effect reconnection during lazy workspace loading must not clear unfinished edits. Include newly required production assets/data in offline preparation and test update behavior when that path changes.

Use checks appropriate to the changed contract, followed by TypeScript/build and relevant browser/offline workflows. The [verification record](VERIFICATION.md) should state observed results rather than treating test definitions as evidence. Add a worked question with hypotheses, controlled variables, metrics, assumptions, checks, conditional interpretation, sources and next measurement. Explain why a new model improves a decision; a larger name count is not the scientific objective.

Follow [AGENTS.md](../AGENTS.md) for delivery: working hosted link, inspectable source, actual checks and a clear explanation of technical and biomechanical meaning. Update [COVERAGE.md](COVERAGE.md), [MECHANICS.md](MECHANICS.md) and the [acceptance map](ACCEPTANCE.md) when their contracts change. Keep the original handoff and historical changelog intact.
