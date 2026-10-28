# Catalog and tool coverage

This document maps the whole target catalog in [handoff §9.3](../EXERCISE_BIOMECHANICS_HANDOFF.md#93-extensible-target-catalog), not just its starting examples. The shared catalog opens the matching workspace. The catalog currently has 74 isolated entries and 57 compound entries. Of these, 73 isolated entries and 50 compound entries have declared quantitative mechanics; the remainder are unknown-mechanism illustrations. Those are preset counts, not independent anatomical models. The authoritative selectable entries live in [the expanded isolated presets](../src/exercisePresets.ts), [the base engine](../src/engine.ts), [catalog metadata](../src/catalog.ts) and [the compound preset library](../src/compoundEngine.ts).

“Covered” means there is an appropriate model, editable configuration or explicitly labeled illustration for the stated question. It does not mean every variation is anatomically complete or every commercial machine has been calibrated. A preset changes mechanics only through parameters its engine actually uses.

## Target-family map

| Handoff family | Workspace and represented coverage | Quantity and important conditions |
|---|---|---|
| **Pullovers** | Joint comparison: standing/kneeling, facing toward/away, inside/outside outlet plane, seated/bench-supported, configurable inclination and free weights. Compound movements: changing elbow angle. Machines: elbow-pad/unknown mechanism illustration and user-defined machine data. | Fixed-elbow symmetric contribution in N·m; coupled movement has a prescribed path plus eligible arm-axis moments. Bench support and rigid grip must close geometrically. A dedicated machine requires its transmission or data. |
| **Cable curls** | Fixed elbow rotation with editable humeral placement, torso/support posture, movement plane, grip annotation and outlet locations: low/high cable, behind-body/Bayesian, preacher/spider/concentration positioning, hammer and cross-body configurations. | External elbow contribution. Positioning a humerus does not solve pad reaction forces or shoulder stabilization. A rope/grip label does not produce an anatomical recruitment estimate. |
| **Free-weight curls** | The same elbow model with gravity, unilateral/bilateral loading and independent or shared implement conventions; standing, incline, supported, straight/EZ bar, hammer and reverse-grip configurations. | Dumbbell mass is per loaded hand; shared implement mass is total. Grip orientation is an annotation unless the separate forearm-rotation coordinate is being modeled. Alternating sides can be inspected as unilateral positions; a timed bilateral alternating controller is not implied. |
| **Triceps extensions** | Pushdown, overhead, lying/skull-crusher, kickback and cross-body configurations using elbow extension, proximal-arm placement, cable/free-weight loads and support orientation. | The reference action is elbow extension. Changing humeral posture does not calculate individual triceps-head length or force. |
| **Shoulder raises** | Cable/dumbbell lateral, front and oblique/scaption planes, unilateral/bilateral loading, supported lean and seated/lying body orientations. | External elevation contribution in the declared plane. Body roll and plane angle are geometric inputs, not a scapulohumeral-rhythm or anatomical shoulder model. |
| **Chest flyes** | Cable and dumbbell adduction, unilateral/bilateral and bench inclination, with adjustable outlet height/width and fixed elbow bend. Pec-deck mechanisms use the machine workspace when data is supplied. | Low-to-high/high-to-low variants use an explicitly inclined movement plane as well as outlet placement. Changing outlet height alone changes force direction, not that plane. Machine input moments require a separate justified joint mapping. |
| **Rear-delt movements** | Isolated reverse fly with cable/gravity and supported positioning; compound face-pull path; reverse-pec-deck data in the machine workspace. | Reverse fly uses its own reference action. Face pull exposes a coupled path, not identified external-rotation or muscle-force sharing. |
| **Vertical pulls** | Compound pronated/neutral/supinated pulldowns, unilateral/kneeling pulls and high row; pull-up/chin-up and assisted pull-up paths. | Fixed-torso open-arm models can expose declared shoulder/elbow-axis moments. Fixed-hand bodyweight paths expose J/progress; hand reactions and joint sharing are unresolved. Grip names encode spacing/path choices, not physiological differences. |
| **Horizontal pulls** | Seated/standing/unilateral cable rows, chest-supported dumbbells and barbell rows; T-bar and converging-machine illustrations. | Open-arm external moments and path mechanics where loads are defined. Fixed trunk support is assumed. A T-bar pivot path alone does not specify its load location, bar mass or transmission. |
| **Presses** | Flat/incline/decline barbell/dumbbell presses, shoulder and cable presses; push-up/dip paths; landmine and converging-machine illustrations. | Open-arm models expose their declared axis components. Closed-chain movements use path mechanics. Unknown lever/machine resistance remains unavailable; a geometric landmine arc is not a calibrated force model. |
| **Isolated hip movements** | Cable hip extension/kickback, abduction/adduction, attachment and body/support orientation; dedicated machines through supplied mechanism/profile data. | The active leg uses a hip coordinate and ankle load. Pelvic frame and support reach are explicit; balance and support reactions are not solved. |
| **Isolated knee movements** | Knee extension/flexion with thigh placement, cable/gravity and seated/lying/standing positioning; compound assisted/unassisted Nordic paths. | An isolated knee coordinate can yield N·m. Nordic path mechanics include entered segment masses and assistance but do not claim a complete reaction-force solution. Real machine cams require data. |
| **Ankle/calves** | Standing, unilateral and seated calf paths; leg-press/guided calf illustrations and machine profiles. | Path work under declared supports and load transmission. Unknown guide/sled mechanisms stay unavailable. Ground/contact sharing is not inferred as an ankle moment. |
| **Compound hip extension** | Romanian deadlift, deadlift, good morning, pull-through, hip thrust, glute bridge and back-extension paths. | Entered external/segment loads along a prescribed chain. J/progress is distinct from hip or lumbar torque; unsupported force sharing is not filled in. |
| **Squats and lunges** | Back/front/goblet squat, declared vertical-load Smith demonstration, hack-machine illustration, defined linear sled, split/Bulgarian squat, planted lunge and step-up. | Fixed support/path assumptions and explicit loads. Smith/hack/leg-press names do not specify arbitrary commercial transmissions. Stepping impact, support transfer, balance and complete joint reactions are outside the model. |
| **Trunk and other movements** | Cable crunch, side bend, Pallof and woodchop paths; crunch-machine illustration/data; isolated shrug, wrist flexion/extension and pronation/supination. | One prescribed trunk segment is not a spinal model. Pallof can show a cable moment about the pelvis, explicitly not spinal torque. Shrug is a translation in cm with external force in N. Wrist/forearm rotations use declared axes and lever geometry. |

The compound library labels its examples as experimental declared mechanics or geometric illustrations. Its broad coverage does not erase those distinctions. Unknown machine entries are useful starting points for measurement and configuration, not numerical simulations of a manufacturer's product.

## Machine coverage

| Category | What the workspace requires and calculates |
|---|---|
| Fixed-pivot / plate-loaded lever | Pivot-to-load radius, mass, angle offset and reference action; gravity moment about the input pivot |
| Cable or belt transmission | Actual tension, input drum radius, travel ratio and winding sign; ideal input moment |
| Cam | Supplied effective moment-arm samples and tension; interpolation within their domain. The schematic cam is not a recovered physical cam outline. |
| Multi-link mechanism | Specified four-bar lengths, assembly branch and output load geometry; closure and transmission derivative. Impossible or dead-center configurations remain unavailable. |
| Measured/supplied profile | Separate angle–force or angle–moment branches, source/measurement protocol, domain and absolute uncertainty; no extrapolation or fabricated missing return branch |
| Human-joint conversion | Optional aligned-axis or constant angular-ratio mapping, with a required justification. Without it, machine quantities remain machine quantities. |

Theoretical parameter sets remain labeled theoretical. Measured data requires identifying the machine and source; a source label is not an independent audit of measurement quality. A/B overlays require matching output units, action signs and the user's confirmed coordinate equivalence.

## Tool coverage

| Tool | What it does | Boundary |
|---|---|---|
| Catalog and exercise-list mapping | Searches aliases and family/equipment/joint/posture/model tags; retains explicit resolutions for ambiguous names | Search tags are not recruitment or validation scores |
| Profiles and equipment | Quick/refined body dimensions, provenance/locks, positions, loads, outlets, attachments, declared adjustment/travel limits and optional body/seat/frame contact proxies | Demonstration proportions and segment masses are not personal measurements |
| A/B comparison | Independent values, selective locks, same coordinate/progress or independent positions, differences, copies and history | Compatibility is based on coordinate and load meaning, not matching units alone |
| Explore / usable range | Original range or one connected permitted interval, including shared movement constraints | Only represented geometry/routing; unknown or slack routes do not become “clear” |
| Analysis | Signed extrema/means, resisting fraction, external work, contact/reversal events and reports | Unavailable intervals are not bridged with zeros; extrema and reversals retain sampling/tolerance limits |
| Placement map and search | Pulley height × pelvis position, explicit objective/floor, whole-ROM geometry/sign checks, multiple trade-off candidates | Finite grid, fixed load/body/original ROM; no universal best exercise |
| Sensitivity and power | User-specified measurement scenarios and optional prescribed coordinate speed | Sample envelopes are not confidence intervals or guaranteed bounds; quasi-static power excludes inertia |
| Research notebook | Questions, findings, classifications, scoped citations and immutable joint, compound or machine comparison snapshots | User-entered studies/observations are distinct from calculations; no supplied hypertrophy findings |
| Persistence and portability | Drafts, framing, named libraries, individual exports and whole-workspace backup/recovery | Browser storage and explicit files; no automatic cloud synchronization |
| Offline installation | Prepared production cache, readiness, repair and controlled updates | Browser/PWA support and actual device acceptance; no native package promise |

## Worked workflows

### Is a pulley change worth testing on real equipment?

Load the portable pulley-height comparison in **Joint & exercise comparison**. Verify matched body and actual force, leave equipment unlocked, and move only B's outlet height. Inspect the full range for contact and travel limits before interpreting the target-region average. If a small dimension change reverses the conclusion, measure that dimension before treating the setup preference as settled.

### Find several placements that meet a criterion

In **Find a setup & research**, choose a baseline and target region. Keep full-ROM clearance and assistance checks enabled when they are part of the question. Select a realistic map domain and a plausible uncertainty interval for a body or equipment measurement. Compare a high-score candidate with one requiring less relocation or showing less sensitivity. **Compare selected placement with baseline** keeps force, body and original ROM matched and records search settings in the criterion. Export the map to retain all evaluated cells and assumptions.

A rejected placement is not automatically unsafe; it may have unknown geometry, unavailable loading or a failed user-selected criterion. A permitted placement is not a real-machine clearance certificate.

### Compare a row's external arm effects

In **Compound movements**, copy a seated cable row into B and change its outlet height with the same force per active cable and the same body profile. Inspect the prescribed path, fixed supports and separate shoulder/elbow axis components. The chart's J/progress value describes the complete prescribed motion; it is not an extra shoulder torque. Record whether the changed path, equipment or another variable explains the difference.

For a squat or pull-up, inspect the path and declared loads instead. The absence of individual joint moments reflects unresolved support sharing, rather than a claim that those joints are unloaded.

### Bring a real machine into the comparison

Open **Machines & measured profiles**, choose supplied/measured data and record what was measured, at what point, under which load setting and angle convention. Enter lifting and lowering data separately, with only the uncertainty you can justify. Check the valid domain and gaps. Overlay A/B only after confirming coordinate equivalence. Keep output force in N when its signed moment arm is unknown; add a human-joint mapping only when its alignment/transmission is supported.

A theoretical lever/cam/linkage can test a mechanical explanation before measurement. It does not become a measurement because its curve looks plausible.

### Keep the conclusion testable

In the research notebook, choose **Snapshot source** to select the joint, compound or machine comparison you studied. Open and configure that workspace first. Apply any measured-curve edits, then save the note: its source settings, coordinates, body dimensions where applicable, and machine data/provenance are retained. Editing the prose keeps the captured comparison unchanged. Source-specific restore opens the corresponding workspace and retains a recovery copy of replaced compound/machine data; a compound restore keeps its captured body dimensions rather than relinking them to a different current profile. Put the prediction and missing data in the question; put the calculated result, limits and next test in the finding. Record comfort/stability as personal observations. For a training study, cite the source and note the population, protocol, duration, outcome measurements and uncertainty. Use **Whole workspace backup** after saving the note so the comparison, exercise drafts and other workspaces can move to another browser together. Unfinished note text and unapplied machine-curve edits must be saved/applied or explicitly discarded before this export, a whole-workspace restore or the managed update reload. They remain open while navigating, but are not silently promoted to saved evidence.
