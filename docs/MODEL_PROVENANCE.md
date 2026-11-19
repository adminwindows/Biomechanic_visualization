# Where the model's knowledge comes from

The application combines standard mechanics, explicitly programmed geometric assumptions and values entered by the user. Its exercise catalog is a collection of configurable mechanical models. The repository does **not** document an experimentally validated anatomical model for every exercise, a population-derived body-proportion dataset, or a measured library of commercial-machine resistance profiles.

This distinction determines what a result can answer. With a defined force, its application point and a defined movement, the app can calculate an external mechanical contribution. To say that the same number describes a particular person on a particular machine requires measurements and a suitable movement model. To infer individual muscle force, joint contact load or training adaptation requires additional evidence and models that are not supplied by these calculations.

## 1. Physical laws and mathematical deductions

The preserved [handoff](../EXERCISE_BIOMECHANICS_HANDOFF.md), especially §§7.2–7.6 and its source table, defines the conventions. It explicitly identifies its detailed equations and numerical cases as project specifications and mathematical deductions. The references already cited there and in [MECHANICS.md](MECHANICS.md) support the following foundations:

| Existing source | What it supports here | What it does not validate |
| --- | --- | --- |
| [OpenStax, University Physics 10.6: Torque](https://openstax.org/books/university-physics-volume-1/pages/10-6-torque), handoff S3 | Moment as a cross product, perpendicular moment arms, direction and summation of moments | The application's chosen joint axes, exercise paths, body proportions or commercial-machine parameters |
| [OpenStax, University Physics 10.8: Work and Power for Rotational Motion](https://openstax.org/books/university-physics-volume-1/pages/10-8-work-and-power-for-rotational-motion), cited in MECHANICS.md | Rotational work and power relationships, with consistent coordinates and units | Muscle work, energy expenditure or a hypertrophy prediction |
| [OpenSim: How Scaling Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089158), handoff S7 | Segment-specific scaling from measurements and the distinction between geometry and mass properties | This app's illustrative height-scaling formula or its example segment lengths |
| [OpenSim: How Static Optimization Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619/How%2BStatic%2BOptimization%2BWorks), handoff S6 | Why estimating muscle forces needs additional anatomical, force-sharing and optimization assumptions | A muscle-force calculation in this app; no OpenSim muscle model or static-optimization solver is integrated |

These are existing project references, not a new systematic literature review. The handoff records its technical-reference consultation date as 27 October 2026. Citing a general method does not establish that every implementation choice has been externally validated.

The calculations use gravity directed downward with `g = 9.81 m/s²`, cable force directed from the attachment toward its last free outlet, and the following relationships:

- Moment about a declared unit axis: `a · ((H − O) × F)`.
- External contribution along a coordinate: `Q = Σ Fᵢ · dHᵢ/dq`.
- For a fixed cable outlet and tension: `Q = −Σ Tᵢ dLᵢ/dq`.

The reference action determines the displayed resisting/assisting sign. Angular derivatives use radians; translational derivatives use metres. A dimensionless compound progress coordinate produces J per unit progress. Those unit distinctions are part of the model, not interchangeable display options. The implementation is inspectable in [engine.ts](../src/engine.ts), [isolatedJoints.ts](../src/isolatedJoints.ts), [compoundEngine.ts](../src/compoundEngine.ts) and [machine.ts](../src/machine.ts).

For example, a theoretical 20 kg point load on a 0.4 m horizontal-reference lever at 60° gives `20 × 9.81 × 0.4 × cos(60°) = 39.24 N·m` about its pivot. This is a testable mechanics statement. Applying it to a gym machine requires establishing that the real load location, angle convention and transmission match that lever.

## 2. Exercise geometry and movement paths are declared assumptions

The project's exercise-specific kinematics were implemented from the handoff and explicit modeling choices. They were not recovered from motion-capture data or an anatomical atlas. An exercise name selects a configuration; it does not supply the missing measurements of how a particular person performs that exercise.

| Model layer | What is actually prescribed | Main boundary |
| --- | --- | --- |
| Isolated coordinates, [engine.ts](../src/engine.ts) and [isolatedJoints.ts](../src/isolatedJoints.ts) | Rigid segments, coordinate frames, a selected movement plane/axis, proximal placement, load points and declared support geometry | Shoulder elevation is simplified humerothoracic geometry. Scapular rhythm, shifting anatomical joint centers, soft-tissue deformation and internal joint forces are not reconstructed. |
| Compound movements, [compoundEngine.ts](../src/compoundEngine.ts) | A progress-dependent path, segment lengths, load positions and support locations | Path resistance describes that prescribed motion. Most closed-chain paths do not identify individual joint moments because support reactions and load sharing are unresolved. Selected fixed-torso arm models expose separately labeled external axis components. |
| Presets and navigation, [exercisePresets.ts](../src/exercisePresets.ts) and [catalog.ts](../src/catalog.ts) | Starting dimensions, posture/plane settings, equipment options and search categories | Preset counts are not counts of independently validated anatomical models. Muscle-group and grip labels are navigation metadata; they do not calculate recruitment. |
| Clearance, [collisions.ts](../src/collisions.ts) and [usableRange.ts](../src/usableRange.ts) | Represented backrests, bars, cables, optional body capsules and user-entered apparatus obstacles | The body capsules are illustrative proxies. A permitted interval is clearance in the represented model, not a personal mobility or safety assessment. Unknown/slack routing cannot establish cable clearance. |

Rigid grip and support closure checks prevent the code from stretching a limb to make incompatible inputs fit. They verify geometric consistency. They do not establish comfort, balance or physiological feasibility. The detailed assumptions and family-by-family boundaries are recorded in [MECHANICS.md](MECHANICS.md) and [COVERAGE.md](COVERAGE.md).

All current force calculations are quasi-static. Inertial forces, impact, elasticity, unspecified friction and unstated apparatus masses are excluded. Animation speed does not turn the model into a dynamic simulation.

## 3. Body measurements: examples, height estimates and user inputs

The default profile is an **editable demonstration**, including a 1.75 m reference height, 0.33 m upper arm and 0.27 m forearm. Those values appear in `defaultProfile` in [engine.ts](../src/engine.ts). The storage model explicitly identifies its reference as `handoff-illustrative-proportions-v1` in [state.ts](../src/state.ts).

Height regeneration currently applies this rule to each eligible dimension:

`new dimension = example dimension × entered height / example height`.

It preserves dimensions labeled measured or explicitly locked. It does not use sex, age, ethnicity, population percentiles or a fitted anthropometric prediction equation. The OpenSim scaling reference supports using segment measurements; it does not establish the accuracy of this linear demonstration rule. Two people of equal height can therefore need different measured profiles.

The `example`, `estimated` and `measured` labels describe how a stored value entered the app. Editing a dimension directly labels it user measured; this label does not independently verify the measurement method or locate a laboratory joint center. [calibrationGuide.ts](../src/calibrationGuide.ts) provides a stronger record when the user supplies repeated readings, units, protocol, instrument, source and uncertainty information. It can apply the result while retaining that record.

Segment masses are separate inputs. Optional isolated segment gravity requires explicit masses; compound defaults contain fictional editable segment masses. Segment centers of mass use declared uniform-segment midpoint assumptions. Height and total body mass do not automatically identify each segment's mass, center of mass or moment of inertia.

For a useful personal comparison, measure the dimensions that affect the result most, record the model landmarks consistently, and use the sensitivity tools to see whether plausible measurement differences change the conclusion. Replacing the default proportions with a specific published anthropometric dataset would require choosing its population, landmarks, scaling method and limitations, then recording that source and version.

## 4. Machine knowledge comes from a defined mechanism or supplied data

[machine.ts](../src/machine.ts) separates theoretical mechanisms from recorded curves:

- Lever, cable/belt and four-bar calculations use the entered geometry, mass/tension and transmission assumptions. Their default parameters are illustrative.
- A cam requires a supplied effective cable moment-arm curve. Its schematic drawing does not reveal the actual cam outline or cable routing.
- Measured/supplied profiles use the user's angle–force or angle–moment samples, their valid domain and separate lifting/lowering branches. Interpolation does not create measurements beyond that domain or invent a missing branch.
- A user-defined formula in [machineFormula.ts](../src/machineFormula.ts) evaluates the equation the user supplies, with explicit angle conventions and parameter annotations. Syntax, numerical-domain and interval checks protect calculation and plotting. They do not establish the equation's physical correctness or automatically prove dimensional consistency.

[machineCalibration.ts](../src/machineCalibration.ts) retains raw calibration information; [calibrationGuide.ts](../src/calibrationGuide.ts) distinguishes repeated-reading variation, instrument allowances and known-load checks. A source field or a successful known-load check is useful provenance, but does not independently certify the whole apparatus or protocol.

Actual force at a handle can differ from selected stack mass times gravity. The app requires the attachment force or an explicit transmission factor. Unknown force/transmission stays unavailable. A machine-input moment becomes an equivalent human-joint contribution only through an explicitly justified alignment or angular-ratio mapping; the machine curve alone cannot establish that mapping.

## 5. What has been verified, and what remains to validate

There are different questions to check:

| Question | Evidence available in this repository | What additional evidence would answer the next question |
| --- | --- | --- |
| Does the code implement its stated equations? | Analytical lever fixtures, sign/axis tests, virtual-work checks, finite-difference comparisons, segment-length invariants and singular/contact regressions in [engine.test.ts](../src/engine.test.ts), [isolatedJoints.test.ts](../src/isolatedJoints.test.ts), [compoundEngine.test.ts](../src/compoundEngine.test.ts) and [machine.test.ts](../src/machine.test.ts) | Independent implementation review and comparison against a separate reference solver for a selected model |
| Does the application retain and present the intended inputs? | Persistence, unit, import, calibration and browser workflow tests; completed runs belong in [VERIFICATION.md](VERIFICATION.md) | Acceptance on the actual device and careful checks using the user's real measurements |
| Does a model reproduce a real movement or machine? | Editable geometry, calibration records and explicitly scoped assumptions; no documented exercise-wide experimental validation dataset | Measured motion/geometry and force records, a matching protocol, a comparison of predictions with observations, and quantified discrepancies |
| Does a configuration change muscle loading, comfort or growth? | The app can retain questions, observations and citations; its external mechanics alone does not answer this | A suitable anatomical/force-sharing model for muscle loads, personal observations for comfort, and relevant training studies for adaptation claims |

Tests that compare two mathematical formulations are valuable checks against implementation errors. Their agreement cannot independently confirm that both formulations represent the person's anatomy or movement. A saved empirical-study citation also needs assessment of its population, protocol, range, training exposure, measured outcomes and uncertainty before it supports a recommendation.

The next useful validation is therefore concrete: choose one movement and one apparatus; record segment landmarks, outlet/load locations and actual attachment force; compare the predicted direction and external moment with an independent simple reference; then examine sensitivity and any systematic discrepancy. More detailed anatomical or muscle-force modeling should be added when that question requires it and when its data can be identified and checked.

This provenance document records the current sources and modeling boundaries. It does not add new literature findings or claim new experimental validation. Source-specific refinements should update the relevant engine assumptions, saved model version, tests and this record together.
