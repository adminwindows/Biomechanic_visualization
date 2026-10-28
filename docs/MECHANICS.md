# Pullover model: conventions and validation

Model version: `pullover-1`. This first interactive milestone implements the four pullover setups in the handoff: classic facing a central pulley, outside/inside facing away from two pulleys, and bench supported. The original handoff and its reconstructed prototype remain unchanged.

## Coordinates and meaning

The world frame is right handed: X runs from the cable outlet plane into the room, Y is lateral, and Z is vertical. Positions and segment lengths use metres, cable tensions use newtons. Public angle controls and setup values are degrees; internal trigonometry and derivatives use radians.

Elevation `q` starts at the hipward torso direction. At 180° the upper arm extends toward the head; 180–200° continues the same angle and is exploratory. This is simplified humerothoracic elevation, without an anatomical scapular model. Bench tilt is above the floor; standing torso tilt is from vertical. Facing transforms the body basis and the positive rotation axis together.

`geometry` is the sole source for drawing, force locations, collision checks, and curves. The pelvis/seat is anchored at `hipX, hipHeight`. Pulleys remain at the explicit outlet positions. Changing torso length moves the shoulders without moving the pelvis, bench or pulleys. The upper arm, forearm and wrist-to-grip offset have independent lengths. Elbow bend is held fixed throughout the repetition.

## Force and reported contribution

For cable attachment H, outlet P and nonnegative actual tension T:

`F = T (P − H) / |P − H|`

Coincident endpoints return a singular state and no force vector. The actual force is **per attachment**: two 100 N cables are not automatically equivalent to one 100 N cable, nor is their resultant generally 200 N. An optional pure conversion helper implements `T = selectedMass × 9.81 × transmissionFactor`; the initial UI uses actual N, avoiding ambiguous stack ratios.

`Q = Σ Fᵢ · dHᵢ/dq`, in N·m.

The reference action is **bringing the arms toward the torso**, so q decreases. A positive Q resists this action; a negative Q assists it. Animation direction and speed do not change this definition or the calculation. For a free cable with fixed outlet, the independent check is `Q = −T dL/dq`.

The displayed result is the **total cable contribution to the symmetric movement**, not an internal joint force or an individual shoulder moment. Both attachments and their three-dimensional force vectors are included. Cable pull, external moment, muscle force, and hypertrophy are distinct quantities.

The numerical singularity tolerance is 10⁻⁹ m. The visual near-zero threshold is 1.5% of `shoulder-to-grip reach × sum of cable tensions`. This is a display convention, not a physiological cutoff. The actual signed moment is preserved even within the visual near-zero region. A specified zero force is a separate `no-force` state. Unknown tension and explicitly slack cables are not implemented and must not be represented as a zero moment.

## Symmetric rigid-bar constraint

Both arms move in parallel sagittal planes. Their grips are exactly at shoulder width, and each hand coincides with a point on the same lateral rigid bar. Grip width is **derived**, not an independently adjustable pose parameter. Cable attachment spacing and outlet spacing remain independent. The bar is long enough to cover both grips and attachments, with 4 cm beyond each outermost point.

This intentionally constrained mode preserves segment lengths and geometric closure without suggesting that arbitrary grip widths are solved. A wider or narrower grip requires a future spatial arm constraint solver. Individual shoulder load sharing is not determined and no per-shoulder result is exposed.

## Contact and validity

The backrest is an oriented volume. Cable segments and the bar are checked against it in 3D with radii of 3 mm and 15 mm respectively. Radius inflation uses an expanded box, conservatively including its corners. A projected side-view crossing can pass outside the backrest laterally. A cable–backrest or bar–backrest contact invalidates the direct mechanical result: the curve has a gap and the moment is null, not zero. No cable routing around the backrest is invented.

Only contact with the represented backrest is assessed. Body, seat, uprights and bench feet are not collision models. Ground violations of the represented hip, shoulder, elbow or bar are invalid. Leg placement and full-body support constraints are outside this first upper-body engine.

Curves sample at at most 0.5° and refine detected contact/validity boundaries and sign reversals to below 0.02°. This is a sampled exploration, **not a certified continuous collision search**: a contact interval narrower than the sample spacing may be missed. A conservative continuous event solver is needed before offering a guaranteed usable-range limiter.

## Body profile and assumptions

The default 1.75 m profile is a **fictional demonstration**: 33 cm upper arm, 27 cm forearm, 10 cm wrist-to-grip offset, 59 cm hip-to-shoulder torso and 42 cm shoulder width. Height scaling of these values is an editable estimate based on this example, not a validated anthropometric prediction or population percentile. User measurements replace estimates; the UI/storage layer retains their provenance and locks. No complete neutral standing model or stature-consistency check is claimed.

The model assumes taut cables, available cable travel, fixed outlets, constant force, symmetric motion and no inertia. It excludes gravity/segment masses and bar weight; therefore the number is the cable contribution only. It does not estimate muscle length, muscle tension, recruitment, subjective effort, or growth. Dedicated machines need a known mechanism or supplied resistance profile and are outside this quantitative milestone.

## Verification and next work

`src/engine.test.ts` exercises analytical signed moments, force scaling and transmission, three-dimensional oblique forces, the handoff reversal fixture, finite-difference cable work, rotation/translation invariance, facing transformations, rigid grip closure, fixed equipment under body changes, elbow variation, continuous angles past 180°, singular/zero/near-zero states, spatial and boundary contacts, and agreement between curve and live evaluation.

The highest-value next engine steps are continuous contact event detection, supported lower-body constraints, and an explicit solver for grip width/arm-plane variation. The next analysis can compare pulley-height changes over a chosen elevation interval while holding body dimensions and actual force per attachment fixed.
