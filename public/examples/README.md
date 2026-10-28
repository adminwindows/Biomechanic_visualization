# Importable comparison examples

These three files are complete, portable comparison snapshots for `biomechanics-2`, schema version 1. All body dimensions are fictional examples; none are presented as personal measurements or training recommendations.

Use the application's **Example comparisons** loader when available. To import manually, download a JSON file, open the application, choose **Import**, and select that file. The comparison replaces the current workspace; use **Export** or **Save comparison** first if you want a separate copy of your current study. The imported comparison remains editable. **Reset setup preset** restores the catalog preset and therefore removes the example-specific changes in that panel.

## 1. Change only pullover outlet height

File: [pullover-pulley-height.json](pullover-pulley-height.json)

A and B have identical body dimensions, a horizontal torso, straight elbows, a 103 cm rigid bar and a single central cable with **100 N actual tension**. The pelvis is 135 cm along X from the outlet plane and 90 cm above the floor. The 175 cm example profile has 33 cm upper arms, 27 cm forearms and a 10 cm wrist-to-grip offset.

Only outlet height changes: **A = 225 cm; B = 185 cm**. Both panels explore 120–180° of arm elevation and initially display 160°. Body and force locks are enabled; the equipment lock is off because pulley height is the variable being changed.

At the initial position, the current model gives approximately **A +67.18 N·m and B +67.59 N·m**, both resisting the pull toward the torso. This small difference at one angle does not establish that the curves match throughout the range. Move through the repetition or inspect the selected-region results to see where the effect changes. Lowering an outlet is not a universal way to increase or decrease resistance.

## 2. Cable versus dumbbell lateral raise

File: [cable-vs-dumbbell-raise.json](cable-vs-dumbbell-raise.json)

Both panels use the same upright body, one loaded arm and a fixed straight elbow. A applies **49.05 N cable tension**; B applies the weight of a **5 kg dumbbell**, which is **49.05 N vertically downward** using `g = 9.81 m/s²`. The force lock equalizes the scalar external force magnitude at the loaded handle, not its direction or moment. This is not a claim of equal stack setting, relative effort, or muscle stimulus.

A's cable outlet is 10 cm above the floor, X = −20 cm, and Y = +5 cm. The pelvis is at X = 75 cm and height 90 cm. B retains those equipment fields for a reproducible snapshot, but pulleys have no mechanical effect on its dumbbell load. Both torsos are upright: B intentionally differs from the catalog's supported-lean dumbbell preset so the example isolates resistance source.

Both panels explore 5–120°, start at 60°, and select 20–100° for region analysis. At 60°, the model gives approximately **A +27.49 N·m and B +29.73 N·m**, both resisting arm elevation. These are contributions about the same unilateral shoulder-elevation coordinate. Body-segment gravity is excluded in both; dumbbell gravity is included in B.

## 3. Equal height with different arm proportions

File: [equal-height-proportions.json](equal-height-proportions.json)

Both profiles are **175 cm tall**. A uses upper arm / forearm / wrist-to-grip lengths of **33 / 27 / 10 cm**, giving 70 cm straight-arm reach. B uses **37 / 30 / 10 cm**, giving 77 cm reach. The changed values retain **example** provenance; they are deliberately different fictional proportions, not measured anatomy.

Torso, shoulder width, lower-body dimensions, posture, pelvis anchor, 103 cm bar, 225 cm pulley outlet and single 100 N central cable are identical. The body lock is off; force and equipment locks are on. Both panels explore 120–180° and initially display 160°.

At 160°, the model gives approximately **A +67.18 N·m and B +72.93 N·m**. The longer reach changes force application geometry while equipment stays fixed. This does not imply the same difference for every pulley location or joint angle, and does not turn body size into a prediction of strength or hypertrophy.

## Assumptions and validation

All three snapshots use fixed cable outlets, available cable travel and quasi-static calculations. Cable tension is constant where included; segment weight, bar weight, friction and inertia are excluded. The examples do not model whole-body balance or certify clearance from unrepresented equipment. The reported values are external mechanical contributions, not internal joint loads or muscle forces.

The files were generated from the application's actual preset/state modules, validated using `validateState`, serialized as JSON, read back from disk and parsed with the same `parseComparison` path used for portable snapshots. Each exported state survived an exact round-trip. The actual engine also evaluated every curve sample across each example's selected movement range with finite moments and no invalid/contact/unknown gaps. These checks establish reproducibility within the current model, not anatomical or training validity.

If a later mechanics version changes the results, preserve these source files and review the application's migration notice instead of treating the rounded reference numbers above as timeless measurements.
