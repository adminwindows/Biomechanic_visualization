# Exercise mechanics: conventions, models and validation

Model version: `biomechanics-2`. The handoff remains unchanged. The engine now covers the twelve first-release scenarios through six distinct mechanical families, plus a geometry-only unknown-machine illustration.

## Models and coordinates

The world frame is right handed: X points from the nominal cable outlet plane into the room, Y is lateral, and Z is vertical. An outlet can be offset in X explicitly. Lengths are metres and forces are newtons. Public angles are degrees; internal derivatives use radians.

| Scenarios | Coordinate and reference action | Represented mechanism |
|---|---|---|
| Classic, outside, inside and bench pullover | Upper-arm elevation; bring the arms toward the torso (decreasing angle) | Symmetric shoulder motion with a fixed true elbow bend and a rigid bar |
| Low-cable and Bayesian curl | Elbow flexion; flex the elbow (increasing angle) | Forearm/hand rotate about a fixed elbow; upper-arm placement is independent |
| Pushdown and overhead extension | Elbow flexion; extend the elbow (decreasing angle) | Elbow mechanism with different upper-arm placement and cable routing |
| Cable and dumbbell lateral raise | Arm elevation; raise the arm (increasing angle) | One loaded arm in a frontal plane; optional prescribed supported torso lean |
| Bilateral cable fly | Horizontal adduction from lateral; bring the hands forward (increasing angle) | Two independent handles, mirrored arm motion and separate derivatives |
| Cable hip extension | Hip extension from neutral; move the thigh backward (increasing angle) | Straight thigh/shank chain rotating at one hip with an ankle attachment; opposite leg supports the body |
| Unknown pullover machine | Illustrative upper-arm elevation | No fabricated resistance mechanism, curve or numerical moment |

For upper-arm elevation, 0° follows the torso toward the hips, and 180° extends toward the head. The angle continues beyond 180° without folding through inverse cosine. It describes simplified humerothoracic elevation, not isolated glenohumeral motion; no anatomical scapular model is included. Elbow flexion uses 0° for a straight elbow. Hip extension uses 0° for the straight leg along the hipward torso direction.

Standing torso tilt is from vertical; a bench angle is above the floor. Lateral raises use a frontal lean, while pullover/curl/extension use sagittal torso inclination. Facing transforms body directions and the joint axis together. Drawings, forces, collisions and curves all consume the same three-dimensional geometry.

`getDefinition` declares each coordinate, reference action, positive action direction and metric key. `compatible` permits overlays only for matching metric meanings; curl and extension have opposite reference actions and are deliberately separate. Unilateral and bilateral elbow totals are not silently overlaid. A cable and dumbbell lateral raise can be compared on the same unilateral coordinate.

## Forces, signs and units

For attachment H, fixed final outlet P and nonnegative tension T:

`F = T (P − H) / |P − H|`

A cable pulls toward its outlet. Coincident endpoints are singular and produce no force arrow or moment. The distance tolerance is 10⁻⁹ m. T is actual force **per attachment**, not selected stack mass. In explicit mass mode:

`T = selectedMass × 9.81 × transmissionFactor`

The factor is attachment force divided by selected mass times gravity. Its absence means force is unknown. The engine cannot determine stack topology or whether a manufacturer's display already includes a transmission correction.

For a model coordinate q in radians, the generalized force is:

`Q = Σ Fᵢ · dHᵢ/dq`

For fixed outlets, the independent cable-work check is `Q = −Σ Tᵢ dLᵢ/dq`. The displayed resisting contribution is:

`R = −actionDirection × Q`

Thus **positive resists the named reference action; negative assists it**, regardless of playback direction. The unit is N·m. Movement progress is only a synchronization control; it is never used as a dimensionless derivative mislabeled N·m. Every fly handle has its own mirrored derivative; the engine does not reuse one arm's derivative or cancel opposite joint axes incorrectly.

For an independent fixed axis, `axisMoment` implements `a · ((H − O) × F)`. For the bar pullover, the result is total contribution to the symmetric movement. It is not an inferred force distribution or individual shoulder moment. Cable tension, summed tensions and resultant force magnitude are distinct quantities.

The visual near-zero region is 1.5% of the sum of `|force| × |application-point derivative|`, with a small numerical floor. This is a display tolerance, not a physiological threshold. The actual signed value is retained.

## Gravity and load availability

Dumbbell weight acts vertically downward at the loaded grip: `Fgravity = [0, 0, −mass × 9.81]`. A unilateral raise has one weight; it is not doubled. The optional arm-segment model requires explicit upper-arm and combined forearm/hand masses. It assumes uniform rods, with centres at segment midpoints; these are declared mechanical assumptions, not personalized anatomical mass estimates. Segment masses are never inferred from height.

Curl/extension upper-arm gravity contributes zero to the elbow coordinate because the upper arm is fixed. Lateral-raise lean changes the arm's orientation to world gravity. Fly segment gravity can be zero about its horizontal-adduction coordinate while the segments still have weight. Hip segment gravity uses explicitly supplied masses for the moving thigh and shank, with midpoint centres. The support leg is fixed with respect to that coordinate and contributes zero to its generalized effect. Missing requested masses give an unknown total instead of invented values.

The result exposes cable and gravity contributions separately and sums them only when both are known. An unknown cable force keeps the total unknown even if a gravity component can be calculated. A specified zero force, a slack cable, a singular direction and a near-zero moment remain different states. A slack cable contributes zero force; its hanging route is not predicted, so straight-line cable/backrest contact is not asserted for it. Known gravity can still produce a nonzero total when the cable is slack.

All models are quasi-static. Speed, inertia, elastic cable behavior, friction and bar weight are excluded. Cable tension/travel are assumed available unless slack or unknown force is explicitly selected. The engine does not infer a resting stack or travel stop.

## Body dimensions, grips and supports

The default 1.75 m profile is a fictional demonstration: 33 cm upper arm, 27 cm forearm, 10 cm wrist-to-grip offset, 59 cm hip-to-shoulder torso, 42 cm shoulder width, 43 cm thigh, 43 cm shank, 24 cm foot length, 30 cm pelvis width and 24 cm shoulder-to-crown offset. Height scaling is an editable illustrative estimate, not a population percentile or validated individual prediction. User measurements, provenance and locks belong to the profile/storage layer.

The pelvis/seat and equipment remain anchored when body dimensions change. Torso length moves the shoulders; it does not move the bench or pulleys. Segment-specific changes recompute reach, directions, moments and contacts. Foot length is a horizontal heel-to-toe dimension. A declared 6 cm ankle-to-floor offset is separate from it. The neutral vertical reference stature is thigh + shank + 6 cm + torso + shoulder-to-crown; this convention is separate from the bent or leaning current pose.

Standing and seated legs use exact two-link inverse kinematics. For thigh length a, shank length b and hip-to-ankle distance d, a solution requires `|a − b| ≤ d ≤ a + b`. Standing ankles are 6 cm forward of the hips; the hip-extension support ankle is directly below its hip to permit a straight active neutral leg. Seated ankles are 48 cm forward. Kneeling uses a grounded knee and horizontal lower leg. These are explicit placement assumptions; inconsistent measurements/placements are rejected rather than stretching limbs. Full-body balance and support reaction forces are not calculated.

Pullover upper arms remain in parallel sagittal planes. Grip width defaults to shoulder width but can be changed with a constrained symmetric solver. For distal length R, actual fixed elbow bend β and lateral grip offset `δ = (gripWidth − shoulderWidth)/2`:

- `r = sqrt(R² − δ²)` is the sagittal distal reach.
- `γ = acos(R cos(β)/r)` is the derived sagittal bend.
- The actual forearm/hand vector contains lateral component ±δ and sagittal component `r × direction(q + γ)`.

A solution requires `|δ| ≤ R |sin β|`; a straight elbow therefore permits only the matching shoulder-width grip. Both hands must also lie on the fixed bar, and attachments must fit it. Incompatible combinations are marked invalid, with a preserved-length illustrative pose. The individual wrist points split the true distal vector using the separate forearm/hand dimensions. The default bar length depends on equipment attachment spacing (plus 8 cm, minimum 60 cm), not body dimensions; an explicit bar length overrides it.

Independent-handle fly/raise/elbow models do not inherit rigid-bar constraints. A supported leaning raise prescribes support without calculating its reaction. None of these support assumptions establishes comfort, stability or training suitability.

## Contact and movement events

The backrest is an oriented box in the same orthonormal frame used by the renderer. Cables and the bar are tested in space with 3 mm and 15 mm radii. Radius inflation uses a conservatively expanded box, including its corners. A side-view cable crossing can pass outside the backrest laterally. Cable–backrest contact invalidates the direct cable force calculation; a rigid bar contact invalidates that position. The curve has a gap rather than a zero value. No routing around equipment is invented.

Contact detection across the movement uses the structure of these single-coordinate models. With fixed outlets and pose, each attachment follows `H(q) = C + A cos(q) + B sin(q)`. Candidate contact angles are solved analytically where the endpoint crosses a box face or the cable lies in a plane through the outlet and a box edge. The bar's fixed lateral span and moving sagittal coordinates use box-face candidates. Sampling each resulting interval, its boundaries and adjacent points prevents a narrow modeled contact from disappearing between ordinary 0.5° plot samples. Candidate planes can produce irrelevant roots; every point is re-evaluated through the ordinary contact engine.

These guarantees apply to the represented inflated box and harmonic paths, subject to numerical tolerance. A future coupled-joint path, moving outlet, different cable routing or different obstacle must supply its own event method. Mechanical reversals are separate events and are refined independently; neither event implies the other.

The backrest is the implemented collision obstacle. Seats, frame uprights, cable guides and the full body are not certified collision volumes. Ground/support checks are additional kinematic validity checks, not a comprehensive equipment-clearance certificate.

## Verification and extension

`src/engine.test.ts` covers analytical signed moments, oblique three-dimensional forces, explicit transmission, force scaling, finite-difference cable work, facing/rotation/translation invariance, angles past 180°, every family, asymmetric fly derivatives, unilateral loading, gravity additivity, known/unknown/slack states, preserved segment lengths, support infeasibility, rigid-grip closure and spatial contact boundaries. Each of the twelve release scenarios has a valid representative-pose test.

The engine models geometry and external mechanics. It does not calculate muscle tension, exact muscle length, joint reaction forces, activation, relative effort or hypertrophy. A mechanical preference requires matched force conventions, a chosen coordinate/range and a defined criterion. Anatomical interpretations and growth hypotheses require separate evidence.

To add a family: define its coordinate/action/metric key; produce rigid geometry and per-attachment derivatives; declare applied loads and support constraints; specify valid collisions/events; provide a meaningful preset and an analytical fixture. Never implement a new exercise by relabeling unrelated kinematics. A real machine needs measured or specified mechanism data before its geometry-only status can become quantitative.
