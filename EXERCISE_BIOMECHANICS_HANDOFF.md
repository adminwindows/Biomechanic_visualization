# Exercise Biomechanics Lab — implementation plan and handoff

**Standalone handoff — 27 October 2026**  
**Audience:** a development agent, particularly Codex running on the user's computer  
**Current deliverable:** a self-contained specification with the reconstructed prototype source in Appendix A; development of the full application has not started.

This document contains the project brief, collaboration approach, mechanics, milestones, and reference code needed to begin designing and building the tool with the user.

## 1. Read this first

Build an interactive tool to **show how a bodybuilding exercise changes when its setup changes**, and to make genuine comparisons between two configurations. The user selects an exercise, moves the pulleys, adjusts body position, body dimensions, the bench and joint positions, then moves through the repetition. The drawing and mechanical results update together.

**Purpose: help the user understand the biomechanics of bodybuilding movements and reason about exercise selection and setup in pursuit of hypertrophy.** The agent is a design partner across three areas: software, functionality and biomechanical relevance. It should propose useful questions, analyses and features, examine assumptions against available knowledge, and iterate with the user. Section 17 describes this role; it applies from the first milestone, not only after development.

The starting point is a series of pullover/lat-prayer visualizations described in a conversation. The user found them much easier to understand than abstract explanations. They want the same freedom to explore many other exercises, with concrete controls and comparisons between variants.

**Proposed format: a responsive web application that can be installed on Android as a PWA.** The same application should work on computers and phones. Start with vector side and top views, a three-dimensional geometry engine and explicitly simplified mechanical models. A realistic 3D character is not a prerequisite for delivering something useful.

**First milestone:** reconstruct and validate the pullover model, its A/B comparator and the edge cases described here. **First complete release:** extend it to 12 scenarios covering six model families. The target catalog is much broader, but every exercise needs suitable parameters and a suitable model; changing its name alone is insufficient.

**The product calculates geometry and selected external mechanical effects.** It does not directly measure muscle tension, subjective effort, internal joint forces or hypertrophy. Labels should make that distinction clear without burying the interface in warnings.

The small reconstructed pullover comparator was received positively, but the user expects a more elaborate final tool. Treat it as an interaction and behavior reference, not as the ceiling for visual quality, anatomical detail, analysis or functionality. The personal body-size workflow—including height and editable segment proportions—is specified in section 4.4.

### How to begin and collaborate

Your first response should briefly summarize the intended tool, propose two or three useful biomechanical questions and a small first interactive milestone, and invite feedback on those concrete choices. Ask only questions whose answers would materially change the next step. Do not make the user repeat the background or complete a long questionnaire before seeing progress.

1. Read the specification and reference source, and retain this handoff in the repository.
2. Inspect an existing repository and its instructions, or choose a lightweight structure if none exists.
3. Discuss the initial design with the user, then build and verify a small pullover/A–B comparison milestone. Show it early and use feedback to guide the next iteration.
4. At each review, discuss the interface, the usefulness of the features, and what the biomechanics does or does not establish. Propose improvements in all three areas rather than waiting for the user to invent every feature.
5. Verify the mechanical conventions with section 13 before expanding the catalog. Numerical examples are modeling examples, not universal training targets.
6. Clarify “better according to which criterion,” investigate the relevant evidence, and discuss implications for hypertrophy at the level supported by that evidence. Initial model limitations do not prohibit investigating more advanced models later.

The proposed stack, milestone breakdown, and catalog priorities are a starting design to refine together. Keep progressing on reasonable assumptions while collecting targeted feedback; do not build the entire product before the first review.

## 2. Background and preferences to preserve

### 2.1 What the user wants to understand

- How pulley height, distance, body inclination and segment lengths change resistance during a repetition.
- Whether resistance is still present when the target muscle is in a posture generally associated with a more lengthened position.
- Why a taut cable can resist a movement, produce almost no moment about an axis, or assist the movement.
- How to compare standing, leaning, seated, lying and supported variants, using one or two cables, free weights or a machine.
- Which portion of the movement remains feasible before physical contact, a stop, a cable-travel limit or a reversal in the direction of resistance.
- Which settings actually depend on the user's body dimensions and equipment.

The user wants concrete directions, examples and controls they can manipulate. An answer reduced to “everyone is different” does not meet that need. Equally, invented precision or a fictitious exercise ranking is unacceptable.

### 2.2 What is known and what remains unknown

| Item | Usable project context |
|---|---|
| Presentation | Drawings first; short explanations connected to the controls |
| Intended use | Comparing and understanding exercises, on a computer and ideally on Android |
| User profile | No exact personal height or segment measurements are supplied; begin with an editable demonstration profile |
| Body-size personalization | Explicitly requested: enter height and refine relevant body dimensions; see section 4.4 |
| Equipment discussed | A machine with two adjustable cable outlets, a bar attached at both ends, a centrally attached bar and an adjustable bench |
| Equipment models and dimensions | Unknown; provide editable dimensions |
| Training program | The user may supply it later; do not block initial development on it |
| Original visualizations | Their relevant behavior is specified in sections 6–8; their original source has not been recovered |
| Reconstructed reference | The complete source of the recreated pullover comparator is included in Appendix A; the user broadly approves it but expects a more elaborate final application |

The task is to **reconstruct the described behavior faithfully**, without pretending that the original software has been recovered. If the user later supplies its source, audit it and reuse useful parts without preserving its errors.

### 2.3 Reference prototype and source

Appendix A contains the complete HTML/CSS/JavaScript source of the small comparator recreated for this project: two configurations, adjustable settings, arm movement, side and top views, resistance direction, and backrest-contact detection. It is a behavior and interaction reference, not the original visualization's recovered code or the finished application. Its simple drawing and mechanics are a starting point to improve and validate against this specification.

No additional source file is needed to start. The original conversation can remain undisturbed. If original code is supplied later, review it for useful ideas; recovering it is not a prerequisite.

## 3. Format and scope

### 3.1 Recommended approach

| Option | Decision and rationale |
|---|---|
| Responsive web application + PWA | Initial choice: accessible through a link, installable on Android depending on the browser, usable on computers, and capable of offline operation after its cache is prepared [S1–S2] |
| Native Android application | Reconsider if a concrete need for sensors, distribution or system integration justifies it |
| Android wrapper around the web application | A later option; do not make it a dependency of the first release |
| Monolithic HTML file | Suitable for a disposable prototype, but not as the lasting architecture for the catalog and models |

A PWA does not imply publication in the Play Store. Installation and offline operation are separate requirements and must be tested separately. Exact capabilities depend on the browser; retain normal browser access when installation is unavailable.

### 3.2 Included in the first release

- Interactive movement visualizations and numerical controls.
- Simultaneous A/B comparison with consistent dimensions and scales.
- External-resistance curves through the movement where the model supports them.
- An editable body-size profile, equipment configurations and exercise presets.
- Local saving, duplication, export and reimport of configurations.
- A touch-friendly interface and offline access to installed content.
- A genuinely functional initial catalog, with explicit status for exercises not yet supported.
- Reproducible calculations and comparisons, with explanations tied to the selected configuration.

### 3.3 Keep outside the initial scope

A complete workout log, an automated coach, video-based movement recognition, detailed simulation of muscles and tendons, muscle-growth prediction, automatic machine reconstruction from a photograph, mandatory accounts, community sharing and photorealistic rendering.

Training-data import initially serves to **prioritize and retrieve exercises**, rather than turning the tool into a training-management platform.

## 4. User journey and interface

### 4.1 Main workflow

1. Choose a family, exercise and variant.
2. Load an example or a personal configuration.
3. Adjust body dimensions, equipment and the start/end positions.
4. Move the movement slider or start a slow animation.
5. Inspect forces, angles and obstacles in the drawing, and read the associated curve.
6. Duplicate the configuration into B, change one or more parameters and compare.
7. Save, rename or export the configuration, or return to the initial example.

On first launch, open a working example without requiring a form. One useful starting pair is A = conventional pullover with a horizontal torso, and B = pullover on a 60° bench. Demonstration dimensions must be marked as fictional rather than presented as the user's measurements. The body-profile workflow in section 4.4 should be available without becoming an onboarding barrier.

### 4.2 Screen organization

| Area | Contents |
|---|---|
| Selection | Exercise search, aliases, family, exercise, variant and favorites |
| Visualization | Articulated body, equipment, cable, force application points, arrows and useful dimensions |
| Comparison | A and B panels, duplication, swapping, selective locks and visible differences |
| Movement | Current position, movement limits, play/pause, speed and outward/return travel |
| Settings | Body, equipment, placement, load and model options, in collapsible groups |
| Results | Resistance direction, known or assumed force, external moment, curve and possible contact |
| Explanation | Two or three sentences tied to the current configuration, with details available on demand |

In phone portrait orientation, stack A and B using the same scales, keep a shared slider accessible, and provide a difference table. Offer a side-by-side landscape mode. Switching between two tabs must not be the only way to compare.

### 4.3 Essential behavior

- Every slider has an explicit label, value, unit and numerical-entry alternative.
- Important points can be dragged in the drawing; numerical input remains available as an alternative.
- Angles identify their reference: “backrest angle above the floor” and “torso inclination from vertical” are different parameters.
- Distances identify both endpoints. “Distance from machine” alone is too ambiguous.
- Show the plane of the cable outlets and which side contains the shoulders, hands and attachment points.
- Show both the current hand positions AND the upper-arm positions; do not substitute one for the other.
- Preserve proportions on screen; provide zooming and panning without changing physical dimensions.
- Preserve a shared scale for A/B; independent framing can be offered as a clearly identified option.
- Support undo/redo, resetting a group and restoring the full preset.
- Do not overwrite a personal configuration when the user changes exercises.
- Combine text, symbols and color for “resists,” “assists,” “almost zero” and “not calculated.”
- Allow annotations to be hidden; avoid obscuring the movement with arrows and numbers.

### 4.4 Personal body-size and proportion profiles

**Include this in V1.** The user explicitly wants to enter their height and other relevant dimensions. A saved body profile must affect the physical model, not merely resize the illustration.

Offer two levels without requiring a lengthy onboarding form:

1. **Quick profile:** enter standing height, optionally wingspan. Initialize an editable set of approximate segment dimensions from a documented reference model. Clearly label inferred values “Estimated from height”; they are starting estimates, not measured individual anatomy.
2. **Refined profile:** replace selected estimates with user measurements. Show a simple landmark diagram and consistent measurement definitions. Keep a usable example profile available when the user does not want to enter measurements yet.

Two people of the same height can have different body proportions. Do not treat stature as a complete description of arm reach, torso length or femur-to-shank ratio. Segment-specific scaling is a standard modeling approach: OpenSim, for example, supports both measured distances and manually specified segment scale factors [S7]. This reference supports the modeling principle; it does not validate a particular height-only prediction formula for this application.

| Input | Role in this application | Availability |
|---|---|---|
| Standing height | Quick initialization and a check against the model's neutral standing height | Basic profile |
| Wingspan | Optional reach-related measurement; must not uniquely determine every arm segment | Optional refinement |
| Upper-arm length | Modeled shoulder-to-elbow distance | V1 |
| Forearm length and wrist-to-grip offset | Elbow-to-wrist distance and position of the actual handle/bar grip | V1; a simplified combined measure may be offered |
| Torso length | Distance between the model's pelvic and shoulder reference points | V1 |
| Shoulder width | Bilateral geometry and hand/bar constraints | V1 |
| Thigh and lower-leg lengths | Hip–knee and knee–ankle geometry; standing height and later lower-body exercises | Profile schema in V1; expose where the exercise model uses them |
| Foot dimensions and pelvic/body widths | Ground contact, stance and body-clearance models when implemented | Progressive extension |
| Body mass | Optional input for explicit bodyweight or segment-gravity models | Not required for cable-only geometry |
| Left/right differences | Separate dimensions when an asymmetric model supports them | Advanced extension; symmetry is the initial default |

Define the measurement endpoints in the UI and data schema. Home measurements are approximations to model reference points; they must not be represented as laboratory measurements of joint centers. A total arm or wingspan input should constrain a model consistently rather than silently assigning exact upper-arm, forearm and hand lengths.

Keep three concepts separate: body dimensions, posture/joint angles and available range of motion. Do not derive flexibility, pain-free range, strength, muscle insertions or training suitability from height. Body mass also does not uniquely specify each segment's mass, center of mass or muscle strength.

**Profile editing rules**

- Give each value a provenance: example, height-based estimate or user-supplied measurement. Record units, reference-model version and measurement definition; optionally store a user-provided uncertainty range.
- Changing height may update unmeasured estimates. Preserve measured or explicitly locked segment lengths. Provide a separate, explicit action to regenerate estimates; never overwrite measurements silently.
- Do not stretch a measured segment merely to make every input agree. If reported stature and the assembled neutral pose disagree, identify the discrepancy and let the user refine the uncertain fields.
- Enable the stature-consistency check only when the complete neutral standing model is defined, including head/neck dimensions, foot/ankle offsets and the pose convention. Summing leg and hip-to-shoulder lengths alone gives neither a complete standing model nor total stature; missing estimated offsets must not trigger a false inconsistency warning.
- Store real dimensions independently of rendering scale. Use metric units by default; additional display units must convert consistently without changing the model.
- Use the same saved profile in A and B by default. Allow an explicitly labeled “Compare body proportions” mode using cloned profiles, including equal-height profiles with different segment lengths.
- Preserve profile snapshots in saved configurations and exports so changes to a default model do not silently change an old comparison.
- Save the profile locally using the persistence rules in section 11.

**Physical behavior when dimensions change**

Keep the equipment dimensions and locations fixed unless the user explicitly moves them. Recompute the body geometry, reach, relevant application points, cable directions, modeled external moments and clearance. Preserve the declared pose/support constraints: for example, seat contact for a seated setup or foot contact in a supported standing model. If these constraints conflict with locked joint positions, show the conflict rather than stretching the skeleton or moving the bench silently.

For the pullover, longer modeled arms can change bar position and cable direction at a given upper-arm angle. A longer modeled torso changes shoulder position relative to a fixed seat and backrest. These are geometric consequences to calculate, not automatic claims about which body type grows more muscle. Repositioning a pulley after changing body size is a separate comparison step.

Choose and document the initial proportion model during implementation. Do not invent precise population percentiles or universal ratios. If the reference data has a restricted population or measurement protocol, record that scope. The interface should still let the user replace estimates directly; the first version does not need demographic profiling.

## 5. The comparator must genuinely compare

### 5.1 Two independent states

A and B each have their own exercise, variant, equipment, load, pose and range of motion. A change in A affects B only when the relevant parameter is explicitly synchronized.

Actions: duplicate A into B; swap A/B; lock body dimensions; lock equipment; lock actual force; synchronize or separate movement positions; name and save the pair; show only the settings that differ.

### 5.2 Three synchronization modes

| Mode | Purpose | Limitation to display |
|---|---|---|
| Same reference anatomical angle | Compare compatible variants at the same upper-arm–torso or elbow angle | Joints and conventions must correspond; otherwise disable this mode |
| Same 0–100% progression | Move through two different ranges simultaneously | 50% of the movement does not imply the same posture or muscle length |
| Independent positions | Freely compare two positions or two ranges | Display both angles and positions without implying synchronization |

Define range of motion using joint positions, not “stretched/contracted” as a universal truth. For the pullover, explanatory text may say that elevated arms generally correspond to a more lengthened lat posture without claiming to calculate muscle length.

In “same angle” mode, use the shared range or explicitly mark a panel as outside its selected range. Do not silently change a limit or move one panel to a different angle to preserve apparent synchronization. If there is no shared domain, offer independent positions.

### 5.3 Comparable results

- Overlay A and B curves using the same axes and units.
- Display assumptions: force per cable, number of cables, pulley ratio, whether gravity is included, and whether the result is total or per side.
- Offer “same actual force” to isolate geometry when the models are compatible.
- Also allow “same selected load,” while making clear that this need not produce the same force at the attachment.
- Show a moment difference at the selected position only when the axes, definitions and units are comparable.
- Compare normalized profiles only through a named option; do not conceal absolute force magnitudes.
- Do not directly overlay a shoulder moment and a knee moment as though they had the same meaning for a muscle.
- Do not generate an overall “effectiveness” or “hypertrophy” score from an angle, peak value or area under a curve.

For “same actual force,” define what is being equalized. Between identical cable arrangements, lock force **per attachment** by default. Between one and two cables, distinguish force per attachment, the sum of tensions and the magnitude of the resultant: these conventions are not equivalent. Display the chosen convention or ask the user to specify it. If the resultant is matched at a reference posture, retain those tensions throughout the repetition; do not readjust them frame by frame without a separate, explicitly experimental mode.

## 6. Reference case: pullover / lat prayer

This section describes the behavior to reconstruct before extending the application.

### 6.1 Variants to represent

| Variant | Required setup and freedom |
|---|---|
| Conventional, facing one pulley | Centrally attached bar; standing or kneeling; torso can become horizontal; adjustable pulley height and distance |
| Facing away from two pulleys, outside the machine | Body on the room side; upright, leaning forward or leaning slightly backward; bar with two attachments |
| Facing away from two pulleys, inside the machine | Shoulders behind the outlet plane; bar can be in front of, in or behind that plane; do not infer hand position from torso position |
| Facing away from the pulleys, on a bench | Backrest adjustable from 0 to 90° above the floor; upright, reclined or lying with the head toward the machine |
| Dedicated pullover machine | Illustration of its mechanism and supports; quantitative resistance only when a mechanism or resistance profile has actually been defined |

The shared geometry model should also support kneeling and chest-supported examples. Their refinement can follow the first milestone; do not create an independent engine for every variant.

### 6.2 Pullover parameters

| Group | Parameters |
|---|---|
| Body | Upper-arm/forearm/hand lengths, shoulder width, torso length, pose height and leg dimensions when legs are represented; use the personal profile described in section 4.4 |
| Position | Facing toward/away, signed horizontal offset, lateral position, torso inclination, standing/kneeling/seated/lying posture |
| Joints | Upper-arm elevation relative to the thorax, elbow flexion and start/end positions; elbow angle fixed by default |
| Pulleys | Outlet positions, height of each outlet, separation, optional symmetry and available travel if known |
| Bar/handles | Central or end attachments, distance between attachments, grip width, mass if known or explicitly excluded |
| Bench | Angle, seat height, backrest length/width/thickness, body position relative to the backrest and position on the floor |
| Load | Force per cable, or displayed load with a documented ratio; optional inclusion of body-segment weight |

Shoulder-to-grip reach is derived from segment geometry and elbow angle. A simplified mode may set reach directly, but it must be distinct from the segmented anatomical mode. Do not allow two contradictory controls to be active at the same time.

### 6.3 Movement ranges and exploratory settings

- Conventional torso position: 0–90° inclination from vertical, with a fully accessible horizontal position.
- Backrest: 0–90° above the floor, with shortcuts for 0, 30, 45, 60, 75 and 90°.
- Arms: permit exploration up to 200° of modeled elevation, explicitly identifying values beyond 180° as exploratory. This is neither an isolated measurement of the glenohumeral joint nor a prescribed range of motion.
- Preserve a continuous angle beyond 180°; a simple inverse cosine (acos) cannot represent that continuation.
- Pulley heights and distances: limits come from an editable equipment profile, with an exploration mode that can expand them.
- Permit negative distances so the user can cross the cable-outlet plane.
- Elbows: distinguish full extension, a small fixed bend and variable elbow flexion. Variable flexion creates a coupled movement and changes the meaning of the indicators.

Interface limits support exploration and must be configurable. They do not certify the anatomical or physical feasibility of every combination.

### 6.4 Educational presets to reconstruct

| Preset | What it should demonstrate |
|---|---|
| Conventional horizontal torso, bar beneath a high outlet | A largely transverse pull across the arms in the elevated position |
| Same conventional setup, farther from the machine | The change in leverage as the cable approaches alignment with the shoulder-to-grip line |
| Facing away, upright, first close and then farther away | The effect of horizontal separation when the outlets are below the hands |
| Inside, torso leaning forward around 60° | Shoulders behind the outlets while hands and bar extend beyond them; a resistive pull can be possible |
| Inside, upright, bar behind the outlets | The cable can assist the beginning of bringing the arms toward the torso |
| Bench at 75°, 60°, 45°, 30° and flat | The useful pull direction changes with inclination; high pulleys are not a universal solution |
| Hands slightly beyond arm–torso alignment | Upper-arm angle, hand position and resistance direction are recalculated |
| Same bench, wider backrest | Real contact can occur even though the side view is unchanged |
| Same bench, longer arms | Changed reach; compare a fixed pulley with a repositioned pulley |

Implement the presets above as geometric examples, then verify them. No preset should be called an “optimal hypertrophy setup.”

### 6.5 Display two distinct limits

**Physical contact:** a cable segment, bar or body part meets a represented object. If the backrest redirects a cable, the straight-line model between attachment and outlet is no longer valid after contact.

**Mechanical reversal:** the cable's contribution to the studied movement passes through zero and changes sign. This can occur without any contact, and contact can occur before the reversal.

With two cables, a crossing of the backrest in the side view **does not prove contact**: the cables can pass along its sides. The top view and spatial calculation must resolve that ambiguity.

### 6.6 Direction of the repetition

For the pullover, use “bring the arms toward the torso” as the reference action. The indicator shows whether the cable resists **that reference action**, including when the animation shows the return.

When the cable resists bringing the arms toward the torso, it can drive the return toward the elevated-arm position while the user controls that return. Do not confuse this with a region in which the cable assists bringing the arms toward the torso. If an instantaneous-work indicator is added, give it a separate label.

## 7. Geometry and mechanics engine

### 7.1 Levels of output

| Level | Permitted output | Requirements |
|---|---|---|
| Geometry | Pose, angles, distances, paths and represented obstacles | Defined segments and coordinate frames |
| External mechanics | Force vectors, moments and work along the movement path | Defined forces, application points and assumptions |
| Simplified mechanism | Effect of an ideal lever or cam | Known or explicitly fictional parameters |
| Unknown machine | Illustrative movement and identification of missing parameters | No invented resistance profile presented as real |
| Physiology | Qualitative, sourced explanation of the posture | No percentage of muscle tension or growth inferred from the diagram |

Store the output level in the data and show it with the results. “Not calculated” is different from zero.

### 7.2 Coordinate frames and conventions

- Internal units: meters, radians, newtons, kilograms and seconds. Interface units: cm/m, degrees, N and N·m as appropriate.
- Use a fixed, orthonormal, right-handed world frame: X points from the machine into the room, Y is lateral and chosen so that X × Y = Z, and Z is vertical. Gravity acts along −Z.
- Facing toward or away from the machine is a transformation of the body and its local frame, not an arbitrary sign change in the renderer.
- For the pullover, define upper-arm elevation from the direction along the torso toward the hips: 0° means the arm lies alongside the torso, 180° means it extends along the torso toward the head, followed by continuous movement beyond alignment up to the exploration limit.
- Define the reference joint, its axis, zero position, positive direction and reference action for each exercise.
- Limb position relative to the thorax and limb position in the room are distinct quantities.
- The first version does not resolve scapular motion anatomically; the pose represents simplified humerothoracic elevation. Do not label it as a measured glenohumeral angle.
- Use the same transformations for drawings, forces, curves and collision checks.

### 7.3 Cable force and moment about an axis

For attachment H, the last free cable outlet P and tension T ≥ 0:

\[
\mathbf F=T\frac{\mathbf P-\mathbf H}{\|\mathbf P-\mathbf H\|}.
\]

The cable pulls toward P; it never pushes. If the distance is nearly zero, return a singular state rather than dividing by zero.

For a force applied at H and a reference point O:

\[
\boldsymbol\tau_O=(\mathbf H-\mathbf O)\times\mathbf F,
\qquad \tau_a=\mathbf a\cdot\boldsymbol\tau_O.
\]

`a` is the unit vector of the axis under examination. The magnitude of the moment vector and its component about an axis are not interchangeable. For multiple forces, add their contributions about the same point using the same convention. The magnitude is the product of the magnitudes of r and F and sin(θ), where θ is their unsigned angle; preserve the sign about the axis separately. These mechanical foundations are described in [S3]. The application rules below are specifications and deductions for this project.

Do not call the angle between the cable and the shoulder-to-grip line the “anatomical arm angle” when the elbow is bent. Do not rely exclusively on the side-view projected angle in a model with two laterally separated cables.

### 7.4 “Resists / assists” and coupled movements

For a movement described by coordinate q, calculate the generalized contribution:

\[
Q_{\mathrm{cables}}=\sum_i\mathbf F_i\cdot\frac{\partial\mathbf H_i}{\partial q}.
\]

The sign of `Q × dq` indicates cable work over a small displacement: negative means resistance, positive means assistance. Define `dq` in the direction of the exercise’s reference action; do not infer the sign solely from a displayed acute angle.

- If q is an angle in radians about a fixed joint, Q is expressed in N·m.
- If q is dimensionless progress from 0 to 1, Q is expressed in joules per unit of progress; **do not label it N·m**.
- If several joints move together, the contribution along the path is not automatically the torque at any one joint.
- A multi-joint system may use a Jacobian and contributions for each coordinate, but only with the external forces and constraints actually represented in the model.
- Define a numerical tolerance and a separate visual “near zero” region; do not create an arbitrary physiological threshold.

A useful derivation for testing: for a free cable segment of length L(q), with outlet P fixed during the movement, `Q = −T × dL/dq`. If bringing the arms toward the torso lengthens that free segment, positive cable tension resists the action. Do not extend this relation without adaptation to a moving outlet, moving pulleys or a different cable routing.

### 7.5 Loads, transmission ratios and gravity

Recommended mode for scientific comparisons: enter the **actual force at each attachment in N**. Practical mode: enter the displayed load in kg together with an explicit transmission factor.

Define `k = attachment force / (selected mass × g)`. In the ideal model, `T = k × m × g`. For example, display “20 kg selected, factor 0.5, approximately 98.1 N at this attachment” rather than an undefined “2:1” label. Friction, changes in the mechanism and inertia cannot be inferred from the displayed mass.

- Distinguish the mass actually moved, a manufacturer’s displayed resistance that is already transmission-corrected, and measured force. Do not apply a second transmission correction to a manufacturer’s already corrected value. For a simple ideal transmission, `k` is the reciprocal of the grip-displacement / stack-displacement ratio.
- Distinguish two independent stacks from a machine with a shared stack; do not count a force from the same mechanism twice.
- For a shared stack or unknown machine with no known transmission ratio, request an explicitly measured/estimated force or remain in geometry-only mode.
- If calibration is added later, retain its provenance, uncertainty and any difference between the lifting and lowering directions.
- Dumbbell/barbell weight: a vertical force at the represented center of mass.
- Body-segment weight: an advanced option based on declared masses and centers of mass; do not silently infer these from height.
- Show the cable/external-load contribution, estimated body-weight contribution and available total separately.
- V1 is quasi-static: it makes no predictions involving speed, inertia, jerks or cable elasticity. Animation speed must not artificially change the result.
- If cable travel limits or stack position are unknown, display “Tension and travel assumed available,” without claiming to detect a resting stack or a stack reaching its stop.

### 7.6 Two cables and a rigid bar

Calculate the forces at both attachments and their moments. Outlet spacing, attachment spacing and grip spacing are separate parameters.

Enforce geometric closure: both hands must coincide with their grip points on the same rigid bar while preserving segment lengths. Define which parameters are free and which the solver derives. If shoulder positions, angles, grip width and bar length become incompatible, flag the impossible configuration or offer to release a lock. Do not artificially stretch limbs or allow hands to float away from the grips.

Cancellation of lateral components in the overall resultant does not mean that the hands or shoulders experience no lateral loading. The exact distribution between hands may depend on unresolved forces and moments.

For the first version, provide a documented, bilaterally symmetric mode showing the total contribution to the symmetric movement. A “per shoulder” result requires additional load-sharing and transmission assumptions; hide it when those assumptions are not satisfied. Two independent handles are a different case, with loads more directly attributable to each side.

Do not arbitrarily display twice one arm’s torque or half an overall resultant. Do not equate grip width with attachment spacing.

### 7.7 What the model must not infer

The same cable-to-grip-line angle does not guarantee the same effect when actual force, lever arm, axis, elbow angle, spatial geometry or gravity changes. Even at an identical external moment, this engine does not know how effort is shared between muscles, their internal moment arms or their physiological state.

Estimating muscle forces requires a muscle model and additional assumptions: OpenSim’s documentation describes activation–force relationships and an optimization procedure, among other requirements [S6]. This project does not implement them in V1.

Do not convert: angle → latissimus dorsi tension; torque → EMG activation; posture → exact muscle length; area under a curve → hypertrophy score; low moment → useless exercise.

The scientific question “Does this variation produce more hypertrophy?” requires specific evidence. The software can show a mechanical difference and explain its implications; it cannot automatically turn that difference into a conclusion about muscle growth.

## 8. Collisions, constraints and movement paths

Represent the backrest as an oriented volume, not a line in a side view. Represent cables as line segments with a small configurable thickness, and bars and limbs as capsules or simple volumes.

Test intersections in space and show the affected point or region. As the model expands, distinguish cable–backrest, bar–backrest, cable–body, bar–body and represented frame contacts.

**The first milestone may validate only backrest contact.** In that case, display “No contact detected with the represented backrest,” not “Unobstructed movement.” Unmodelled seats, uprights, bench feet and cable guides must not be treated as absent.

Evaluate the whole range of motion and detect first contact separately from resistance-reversal regions. Avoid skipping an obstacle because sampling steps are too large; refine sampling near events or use appropriate continuous tests.

In exploration mode, allow movement beyond contact using a ghosted drawing and mark the direct mechanical result as invalid. In “Usable range according to the model” mode, restrict the movement to the clear portion. Do not invent a path for a cable sliding around the bench.

Moving a bench must move the supported body according to explicit constraints. Do not allow shoulders, backrest and pelvis to become disconnected unless the editing mode explicitly permits it.

## 9. Catalog: broad coverage through reusable models

### 9.1 Organization

Each exercise has a stable identifier, a display name and searchable aliases, a mechanical family, variations, relevant parameters, a movement definition, forces, assumptions and a status.

Suggested statuses: **validated within the model**, **experimental**, **geometric illustration**, **planned**. “Validated” means that the calculations comply with the declared model, not that they have clinical validation or establish training effectiveness.

Muscle-group filters help users find exercises; they are not measurements of muscle recruitment. Also provide filters for equipment, main joint, posture, unilateral/bilateral movement and available model.

### 9.2 First release: 12 scenarios across six families

| No. | Family | Scenario and included variations | What it validates |
|---:|---|---|---|
| 1 | Pullover | Classic single-cable version, standing/kneeling, including a horizontal torso | Facing-machine reference, height and distance |
| 2 | Pullover | Facing away from two pulleys, standing outside, upright or leaning | Pull direction and dual cables |
| 3 | Pullover | Facing away from two pulleys, inside the machine, with the bar crossing their plane | Signed positions and resistance reversal |
| 4 | Pullover | Bench from 0 to 90°, facing away from the outlets | Incline, body proportions and spatial collisions |
| 5 | Elbow flexion | Low-cable curl, upper arms near the torso | Rotation about the elbow |
| 6 | Elbow flexion | Cable curl with upper arms behind the torso, standing or supported | Shoulder position and pulley effects |
| 7 | Elbow extension | High-cable pushdown | Different movement direction within the same joint family |
| 8 | Elbow extension | Overhead extension, facing toward or away from the outlet | Upper-arm elevation, elbows and movement path |
| 9 | Lateral raise | Unilateral cable raise, cable in front of or behind the body where supported by the model | Frontal plane and lateral positioning |
| 10 | Lateral raise | Dumbbell raise, upright or leaning with support | Gravity compared with cable pull |
| 11 | Shoulder fly | Cable fly with two independent handles | Transverse plane and forces on each side |
| 12 | Hip movement | Cable hip extension with an ankle attachment | Another joint and force-application point |

Commercial names or more elaborate variations of these scenarios remain presets as long as they genuinely use the same degrees of freedom. Do not claim faithful reproduction of a variation if its required movement plane or motion is not supported.

### 9.3 Extensible target catalog

This list aims to cover a broad range of common resistance-training exercises. It is not a promise to simulate every commercial machine comprehensively in V1. Named variations may share a model, but each must be checked.

| Family | Exercises and variations to cover | Model or particular difficulty | Release |
|---|---|---|---|
| Pullovers | Standing lat prayer; kneeling; seated facing the machine; chest-supported; standing facing away; inside-machine; bench at 90/75/60/45/30/0°; dumbbell; barbell; elbow-pad pullover machine | Shoulder, fixed or coupled elbow, bar and supports | V0–V2 |
| Cable curls | Low cable; behind-the-body/Bayesian; preacher; spider; concentration; high cable; rope hammer; cross-body | Elbow, humeral position and movement-plane orientation | V1–V2 |
| Free-weight curls | Standing dumbbell; alternating; incline; spider; preacher; concentration; straight/EZ bar; hammer; reverse curl | Gravity; pronation/supination handled separately | V2 |
| Triceps extensions | Bar/rope/unilateral pushdown; standing/seated overhead extension; lying cable extension; barbell/dumbbell skull crusher; dumbbell/cable kickback; cross-body | Elbow, humerus and gravity | V1–V2 |
| Shoulder raises | Dumbbell/cable lateral raise; supported leaning; seated; side-lying; cable/dumbbell front raise; scaption | Elevation plane and spatial orientation | V1–V2 |
| Chest flyes | Horizontal, low-to-high and high-to-low cables; unilateral; flat/incline bench; flat/incline dumbbell fly; pec deck | Adduction, fixed elbow; machine-specific mechanism | V1–V2 |
| Rear-delt movements | Cable/dumbbell reverse fly; incline bench; reverse pec deck; face pull | Multi-joint face pull, potentially including external rotation | V2–V3 |
| Vertical pulls | Pronated/neutral/supinated lat pulldown; unilateral; kneeling; high row; pronated/supinated/neutral pull-up; assisted pull-up | Shoulder + elbow + torso; assistance/body weight | V3 |
| Horizontal pulls | Seated cable row; standing; unilateral; chest-supported; dumbbell; barbell; T-bar; converging machine | Distribution between joints and supports | V3 |
| Presses | Barbell/dumbbell bench press; incline; decline; shoulder press; standing/seated cable press; landmine press; converging machine; push-up; dip | Multiple joints, movement path and contacts | V3 |
| Isolated hip movements | Cable kickback; kneeling hip extension; cable abduction/adduction; lying variations; abduction/adduction machines | Pelvic frame, attachment point and mechanism | V1–V2 |
| Isolated knee movements | Leg extension; seated/lying/standing leg curl; cable variations; assisted/unassisted Nordic curl | Joint, support and gravity; known mechanisms required | V2–V3 |
| Ankle/calves | Standing; seated; unilateral; leg-press calf raise; guided calf raise | Ground support and load transmission | V3 |
| Compound hip extension | Romanian deadlift; deadlift; good morning; pull-through; hip thrust; glute bridge; back extension | Joint chain, supports and body-segment masses | V3 |
| Squats and lunges | Back/front/goblet squat; Smith squat; hack squat; leg press; split squat; Bulgarian split squat; lunge; step-up | Contacts, reaction forces and balance | V3 |
| Trunk and other movements | Cable/machine crunch; side bend; Pallof press; woodchop; shrug; wrist flexion/extension; pronation/supination | Rotation, isometrics, multiple axes or segments | V3+ |

Do not fabricate complete joint moments for squats or presses by considering only the bar while ignoring supports and body-segment masses. An initial kinematic illustration may precede the mechanical model, with the corresponding status shown.

### 9.4 Dedicated machines

Identify a machine by its mechanism and, where possible, its brand/model/version. Support these categories: fixed pivot, plate-loaded lever, cable/belt transmission, cam, multi-link mechanism, and measured or supplied resistance profile.

The side on which the weights are located is insufficient to determine resistance. Without reliable geometry or a resistance profile, provide an illustration and request the missing parameters. A “Theoretical machine” mode may allow curve editing, but it must remain distinguishable from a real machine and retain its provenance.

A moment about the machine pivot is not automatically a moment about the human joint. Specify the pivot to which a curve refers and model the supports/transmission before converting it.

## 10. Data model and extensibility

Avoid a long chain of conditions based on exercise names. Separate the catalog, geometry, forces, rendering, persistence and explanations.

| Entity | Minimum contents |
|---|---|
| `AnthropometryProfile` | Identifier, standing height, optional wingspan, segment lengths and widths, optional mass inputs, units, per-value provenance and locks, measurement definitions, reference-model version and optional uncertainty; see section 4.4 |
| `EquipmentProfile` | Cable outlets and routing, transmission factors, known limits, bench, attachments and dimensions |
| `ExerciseDefinition` | Stable identifier, names and aliases, family, parameters, constraints, degrees of freedom, plane/axes, force and movement model |
| `VariantDefinition` | Settings and constraints specific to a variation; dependency on an existing model |
| `Configuration` | Exercise, variation, profile references and snapshots, settings, movement limits, data version and model version |
| `Comparison` | Configurations A/B, active synchronization settings, framing and comparison units |
| `SimulationResult` | Positions, forces, moments or generalized contributions, signs, events, assumptions and validity for each indicator |
| `SavedPreset` | Name, description, parameters, teaching objective, provenance, version and favorite status |
| `MachineResistanceProfile` | Angle–force or angle–moment relationship, joint/axis, interpolation, valid domain, provenance and uncertainty |
| `ExerciseMapping` | Imported label, selected exercise/variation and confirmed/ambiguous/unrecognized status |

An exercise module’s contract: declare its parameters, construct a pose, calculate force-application points and forces, produce the permitted indicators, define available obstacles, provide presets and explanations, and expose its version and reference tests.

Store independent values; derive positions and results. An export must contain enough data to reproduce a configuration even if the original preset changes. Do not rely solely on local profile identifiers to restore a file on another device.

Plan schema migrations and `modelVersion`. When a mechanics correction changes a result, disclose it when reopening the configuration and preserve the original configuration before migration. Do not silently retain an incorrect old calculation in the name of reproducibility.

## 11. Proposed technical architecture

These choices are implementation recommendations. If an existing repository already uses a suitable stack, retain it rather than rewriting everything.

| Layer | Initial choice |
|---|---|
| Application | TypeScript + React; Vite tooling; compatible stable versions checked at project startup [S4–S5] |
| Engine | Pure, typed mathematical functions with no dependency on React or pixels |
| Calculations and explanations | Reproducible for the same inputs and model version; explanatory content follows the modeled configuration |
| Rendering | Interactive side, front and top SVG views as appropriate to the family; projections of the same spatial geometry |
| Curves | SVG or a lightweight library; the same conventions and data as the scene |
| State | Separate A/B state, normalized parameters and derived results; specific state-library choice is secondary |
| Persistence | IndexedDB for profiles/configurations; portable, versioned JSON export |
| PWA | Manifest, icons, caching strategy and controlled updates; HTTPS hosting for actual use |
| Testing | Engine unit tests, property tests, browser workflows and targeted visual checks |
| Delivery | Documented repository, development/test/build commands and milestone history |

Suggested logical structure: `domain`, `geometry`, `mechanics`, `exercises`, `equipment`, `renderer`, `comparison`, `storage`, `import-export`, `ui`, `tests`, `docs`. These are responsibilities; do not create an independent subproject for each one.

The engine uses three-dimensional data from the outset for the relevant forces and collisions; this does not require WebGL rendering. Add an orbitable 3D view later only if it helps explain a case that the projections do not communicate well.

### Persistence, privacy and offline use

- No account or data server is required in V1.
- Process profiles, training files and settings locally by default.
- Do not implicitly add telemetry or transmission of training data.
- The application must work after a successful initial load and cache preparation; communicate this clearly.
- Test offline startup, reloads, icons, catalog, presets and models.
- Update the service worker without losing an in-progress configuration or mixing incompatible versions.
- Browser storage can be cleared; provide export/reimport and state that data is not automatically synchronized across devices.
- For future imports: limit file size, validate the schema, do not execute imported text, reject non-finite values and invalid files, and provide a readable report.
- If URL sharing is added, do not expose body measurements or the full training log without an explicit user choice; local export is sufficient initially.

## 12. Optional training-program import

Initially accept a pasted list or simple CSV of exercise names. Subsequently support an actual format supplied by the user; do not assume which training app they use.

Process: read the names; retain the original labels; suggest matches through aliases; ask the user to resolve ambiguities; create favourites and development priorities; retain unknown entries in a list for follow-up.

For example, “pull” alone does not distinguish a row from a pulldown. “30 kg” does not identify a total load, one stack, one dumbbell or actual attachment force. Do not silently normalize these details.

Useful fields when available: name, variation, equipment, side, machine brand/model, load and unit, load convention, and setup notes. Repetitions, sets and dates are optional for the initial purpose.

The first version can function fully without an import. Once the user’s list is available, change catalog priorities without changing the mechanical principles or restarting the architecture.

## 13. Validation: success criteria and reference tests

### 13.1 Numerical mechanics tests

The following coordinates describe synthetic mathematical cases, not recommended body positions. Compare results using tolerances appropriate to the units. For example, use `g = 9.81 m/s²` consistently.

| Case | Inputs | Expected result |
|---|---|---|
| Collinear, zero moment | `O=[0, 0, 0]`, `H=[0, 0, 0.7]` in m; `F=[0, 0, 100]` in N | Zero moment |
| Perpendicular force | `r=[0.7, 0, 0]` in m; `F=[0, 100, 0]` in N | Moment of +70 N·m about +Z |
| Same unsigned angle, opposite direction | Same r; `F=[0, -100, 0]` in N | Moment of −70 N·m about +Z; opposite sign despite the same 90° angle |
| Angular leverage | r=0.7 m, F=100 N, angles of 30°, 75°, and 90° in the same plane | Magnitudes of 35, approximately 67.61, and 70 N·m |
| Force scaling | Same configuration, twice the force | Twice the cable contribution, with unchanged geometry |
| Explicit transmission factor | 20 kg, k=0.5 | 98.1 N at the attachment in the ideal model |
| 3D force | Force of 100 N, with a projection of 60 N into the plane | Do not use 100 N as the in-plane force when calculating the moment component being studied |
| Two oblique forces | Two cable tensions of 100 N; each has 80 N in the same sagittal direction and opposite lateral components of 60 N | A sagittal resultant of 160 N, not 200 N; moments calculated at the attachments |
| Singular cable geometry | P=H | Explicitly non-computable state; no propagated NaN and no arbitrary force arrow |

**Practical convention for code fixtures:** use numerical arrays with decimal points, such as H=[0, 0, 0.7] and r=[0.7, 0, 0]. Avoid locale-dependent punctuation ambiguities in tests.

**Direction-reversal fixture in the X–Z plane:** shoulder `S=[0, 0, 0]`, outlet `P=[-1, 0, 1]`, grip `H=[L cos(q), 0, L sin(q)]`, cable tension 100 N. Use the positive axis `a=[0, -1, 0]`, so q increases from +X toward +Z. With L=0.5 m, the moment component is approximately +44.7214 N·m at q=90°, zero at 135°, and −44.7214 N·m at 180°. With L=0.8 m, the zero remains at 135°. For a reference action in which q decreases, the first case resists and the last assists. This fixture uses a world-space angle, not the interface's humerothoracic elevation convention.

Additional mandatory tests:

1. Check `Q = −T dL/dq` against an independent finite-difference calculation in free-cable cases.
2. With a fixed shoulder and pulley and a grip at positive radial distance L, verify that increasing L does not change the collinear orientations at which the moment becomes zero, excluding singularities. Repositioning the pulley must, in contrast, be able to shift the reversal.
3. Apply the same translation to the body, pulleys, and bench: results must remain unchanged.
4. Rotate the entire scene and gravity together: results must be equivalent in the rotated axes. Rotating only the camera must not change the mechanics.
5. Verify left/right symmetry and facing-toward/facing-away transformations, including their expected signs.
6. Change elbow flexion: hand height and upper-arm orientation must not be confused.
7. Move beyond 180°: no folding back to 160°, no pose discontinuity, and the force direction must be recalculated.
8. Separate cable and gravity contributions; their sum must match the reported total.
9. With two oblique cables, verify the vector sum and moments at the attachments; verify that per-shoulder results remain unavailable when force sharing is undefined.
10. Sample the full curve using the same engine as the displayed position; the curve, status indicator, and drawing must agree.
11. Animation speed must not change the quasi-static model.
12. An unknown value, zero force, an explicitly modeled slack cable, and a near-zero moment must remain four distinct states.
13. With a rigid bar, verify that hands coincide with grips, segment lengths remain constant, and incompatible configurations are flagged.

### 13.2 Collisions and constraints

- A cable crosses the backrest in a projection but passes to its side: no 3D collision.
- The same configuration with the backrest widened until it reaches the cable: collision detected.
- Tangential contact, contact near edges, and contact at the thickness boundary: stable behavior.
- The first contact is detected even when it occurs between two coarse slider samples.
- Collision and moment reversal appear as separate events.
- After contact deflects the cable, the direct-line force calculation is not presented as valid.
- An object is not represented: no automatic assertion of clearance from that object.

### 13.3 Product acceptance tests

| ID | The user must be able to… |
|---|---|
| R01 | Set the torso horizontal in the classic pullover |
| R02 | Position the shoulders behind the cable-outlet plane and the hands in front of it |
| R03 | Explore elevation beyond 180° without artificially changing elbow flexion |
| R04 | Move the bench from upright to flat while retaining coherent geometry |
| R05 | See two configurations simultaneously at the same scale |
| R06 | Modify A without modifying B, then synchronize only the arms |
| R07 | Compare equal joint angles and equal movement progress while understanding the difference |
| R08 | Identify when the cable resists, becomes almost neutral, and then assists the reference action |
| R09 | Understand that the eccentric return does not change the definition of that status indicator |
| R10 | Adjust segment lengths, backrest dimensions, and attachment spacing |
| R11 | Distinguish a crossing in the side view from a calculated physical contact |
| R12 | Switch from a pullover to a curl, raise, or hip extension without receiving the same drawing with a new name |
| R13 | Save a comparison, reload the page, and recover every parameter |
| R14 | Export, import into an empty installation, and reproduce the saved state |
| R15 | Operate the essential controls by touch and keyboard |
| R16 | Open the installed application offline after its offline content has been prepared successfully |
| R17 | Clearly recognize when a result is hypothetical, unknown, or outside the model |
| R18 | Inspect an unknown machine without being shown an invented real-world resistance curve |
| R19 | Define a comparison criterion and see which variables are held constant |
| R20 | Distinguish a mechanical calculation, an estimate, a study result, and a hypothesis |
| R21 | Understand what a comparison establishes and which analysis would be useful next |
| R22 | Create two body profiles with the same height but different segment proportions and obtain the corresponding differences in modeled geometry and mechanics |
| R23 | Change height without silently overwriting measured segment lengths; any regeneration of estimates must respect the profile's provenance and locks |
| R24 | Change body dimensions and have physical geometry, force effects, and collision checks recalculated, rather than merely resizing the drawing |
| R25 | Change a body profile while bench dimensions and pulley positions remain fixed unless explicitly edited |
| R26 | Export and restore a body profile with its measurements, units, estimate provenance and locks intact |

Responsiveness targets to measure on an Android device selected for acceptance testing: visible control updates generally within 100 ms; smooth animation without blocking the controls; curve updates that do not disrupt manipulation. These are project targets, not compatibility that has already been demonstrated.

Test at least a narrow screen around 360 px wide, a phone in landscape, and a desktop. Keep touch targets large enough, text readable, keyboard focus visible, and provide a reduced-animation option.

## 14. Implementation plan by milestone

### J0 — Technical scope and conventions

**Work:** discuss the initial design and first useful comparisons with the user; inspect the environment; establish conventions for axes, angles, units, signs, and metric names; define entities and validity states; choose the first examples; record assumptions.

**Biomechanical work:** propose two or three concrete questions to address first, suitable metrics, and any information needed to interpret the results. Use the existing pullover questions to make progress without waiting for a complete new discovery phase.

**Output:** a minimal runnable repository, brief convention documentation, and baseline mechanics fixtures. Unknown equipment properties are parameters, not invented personal measurements.

**Gate to the next milestone:** cable force, signed moment, and facing-toward/facing-away transformations pass analytical reference cases.

### J1 — Pullover reference and genuine comparison

**Work:** implement the four pullover scenarios in the initial catalog; side and top views; movement; the quick and refined body profiles in section 4.4; bench; signs; curves; A/B; minimal saving; and backrest collision checks.

**Output:** an interactive browser version demonstrating criteria R01–R11 with educational presets. The dedicated machine may remain a clearly non-quantitative illustration.

**Review with the user:** clarity of the drawings, usefulness of the controls, phone readability, and relevance to their equipment. Ask for measurements only when they would concretely improve that review.

**Biomechanical review:** demonstrate a controlled comparison and a comparison of two usable installations; explain the trade-offs, distinguish model results from still-hypothetical implications for hypertrophy, and propose the next analysis or feature.

The reconstructed pullover comparator in Appendix A is a useful reference for these interactions. It is a prototype, not the final application's target level of sophistication: use it to retain what the user understands while developing the richer controls, anatomy profiles, calculations, comparisons, and presentation specified here.

### J2 — Generalise to multiple families

**Work:** extract shared interfaces without regressions; add the other eight V1 scenarios; adapt axes and parameters; compare cable loading with gravity; add search and favourites.

**Output:** all 12 scenarios work, each with a mechanics test, representative preset, stated limitation, and comparison example. No catalog entry should appear to be simulated when it is not.

### J3 — First version suitable for regular use

**Work:** PWA installation; offline caching; complete profiles and presets; export/import; migrations; touch ergonomics; Android and desktop acceptance testing; documentation.

**Output:** an application usable without an account, delivered source code, instructions for running/building/testing, and a report of the tests actually performed. List known issues with reproduction steps.

### J4 — Catalog prioritized by the user

**Work:** incorporate the user's exercise list; confirm mappings; progressively add curls, triceps movements, flyes, isolated hip/knee movements, and free weights; add profiles for actual equipment where information is available.

**Output for each family:** appropriate parameters, a useful comparison, tests, a visual example, the provenance of assumptions, and a changelog. Do not postpone all usefulness until a very large catalog is complete.

### J5 — Advanced models

**Consider separately:** multi-joint pulls and presses, lower-body contacts and supports, real mechanisms and cams, calibrated curves, an orbitable 3D view, an Android wrapper, and optional data synchronisation.

Each extension must justify the necessary data and equations. Do not extend a single-joint formula to the whole body merely by changing its label.

## 15. Questions to ask at the right time

These answers are useful but do not block demonstration models.

1. Which 10–20 exercises does the user actually perform, or what training-program export is available?
2. Which height and segment lengths should be represented? Allow a demonstration profile before measurements are taken.
3. Which machines, outlet-height and spacing ranges, and bar are used?
4. What are the bench dimensions: seat, backrest, width, and its extension above the shoulders?
5. Which Android phone and browser will be used for acceptance testing?

Do not ask the user to choose a database, drawing library, or Android implementation now: the proposed decisions are sufficient to start. Revisit them only if a real constraint invalidates them.

## 16. Deliverables expected from the development agent

- Organised, version-controlled source code, with locked dependencies and documented compatible versions.
- A locally runnable application and reproducible build, with web/PWA installation instructions.
- A mechanics engine that can be tested independently of the interface.
- Catalog, presets, and demonstration profiles separated from rendering code.
- Documentation of conventions, equations, assumptions, unknowns, and limitations.
- Relevant tests and the results of acceptance checks actually performed.
- Importable example exports and a migration strategy.
- A short guide to adding a family, exercise, variant, or machine.
- Screenshots or a demonstration of reference cases, with a clear list of what is validated, experimental, illustrative, or planned.
- A change history, important decisions, and next priorities.
- Biomechanical question briefs, sources, and assumptions for each family; conditional conclusions linked to comparisons; proposed extensions justified by an exercise or training question.

**Definition of the first completed version:** all 12 scenarios are interactive; A/B comparison is genuine; essential controls work on a phone; mechanics results are tested and correctly named; configurations can be saved and exchanged; and the advertised offline behavior works. An attractive static catalog or four renamed versions of the same drawing does not meet this definition.

## 17. Mandate for biomechanical co-design and decision support

### 17.1 Three areas of collaboration

| Area | Work expected from the agent with the user |
|---|---|
| Software | Build, verify, correct, and maintain a reliable application |
| Product | Understand usage, select useful interactions, and propose and assess features |
| Biomechanics and hypertrophy | Formulate useful questions, select metrics, examine models and studies, interpret comparisons, and propose further analyses |

The agent must not wait for the user to invent every feature or identify every source. It should propose directions and explain the question each one addresses. It may challenge a line of reasoning or a metric, but must offer an actionable alternative. Where possible, “the model cannot establish that” should be followed by “this information or analysis would help resolve it.”

### 17.2 Compare to answer a question

Comparison is a central feature: it can isolate a setting's effect or reveal trade-offs between variants. Before calling A preferable to B, specify:

1. **The target and action:** which muscle, joint function, or setup question?
2. **The criterion:** resistance in a selected region, profile across the range, unobstructed trajectory, available range, support, repeatability, or equipment compatibility?
3. **The matched conditions:** body dimensions, joint pose, force and force-sharing convention, range of motion, and equipment constraints?
4. **The changes:** one isolated variable or a complete combination of settings?
5. **The scope of the conclusion:** a calculated result, anatomical interpretation, training hypothesis, or observation from a study?

Offer two kinds of experiment. A **controlled comparison** changes one parameter to understand its effect. A **practical comparison** contrasts two usable installations whose parameters may differ in several ways; it shows their trade-offs without attributing every difference to one variable.

“Better” is allowed when it refers to a defined criterion. For example: “At the same force and range of motion, A maintains a greater resisting contribution in the selected region without contacting the represented backrest.” This may be a sound conclusion within the model without establishing superior muscle growth.

Stability, tolerance, comfort, and the limiting muscle can be recorded as user observations; do not generate them as objective measurements from the drawing. Likewise, matching external force does not automatically match relative effort or proximity to failure.

### 17.3 Metric catalog to develop according to usefulness

The aim is to cover metrics relevant to the questions encountered, with a definition and validation for each. A large number of displayed values is not a goal in itself.

| Group | Possible metrics or analyses | Conditions and interpretation |
|---|---|---|
| Geometry | Angles, distances, reach, trajectory, range, clearance, and event locations | Define reference frames; distinguish posture from muscle length |
| External forces | Tension per cable, resultant, components, direction, and application points | Cable tension is distinct from muscle tension |
| Rotational effect | Moment arm, signed moment about each axis, separate contributions, and profile across the range | Name the coordinate and transmission assumptions |
| Selected movement region | Minimum, maximum, and mean on a defined axis; resisting, nearly neutral, or assisted region; peak locations | Match force and interval for comparison; thresholds are chosen values, not physiological claims |
| Work and power | External mechanical work by integration; power conditional on a prescribed velocity | Mechanical indicators, not calories expended or a hypertrophy dose; quasi-static power remains approximate |
| Sensitivity | Effect of changing height, distance, segment length, load, or an assumption | Show whether results are robust to measurement uncertainty |
| Advanced muscle model | Estimated length, internal moment arm, and estimated muscle-force contributions | A specific extension requiring an anatomical model, data, and validation; keep muscle-force sharing explicit [S6] |
| Training context | Reported support, repeatability, and limitations; working load and relative effort when supplied | User observations or separate measurements, not results automatically inferred from geometry |

Present four separate categories: **calculation within the model**, **assumption-dependent estimate**, **empirical study result**, and **hypothesis to explore**. Do not collapse numerical correctness, anatomical realism, and the strength of hypertrophy evidence into a single confidence gauge.

Advanced muscle estimates are a possible direction, not a feature promised by V1's equations. Before adding them, explain how they would help a decision and examine whether their uncertainty changes the conclusion. A formula using one fictitious muscle must not be presented as the actual force of the latissimus dorsi or biceps.

### 17.4 Scientific iteration loop

For every new family and important question: **question → hypotheses → metrics → model/visualization → checks → interpretation → discussion with the user → next improvement**.

Keep a brief record for each question: objective, variables, assumptions, required data, sources, compared configurations, conclusion, and next step. If a conclusion remains uncertain, suggest an equipment measurement, another comparison, a targeted literature search, or a more suitable model.

For hypertrophy claims, look for studies relevant to the muscle, movement, and protocol concerned. Distinguish anatomy and theoretical mechanisms, acute measurements, simulations, and results from sustained training. Examine the population, duration, range of motion, volume, load/effort, growth measurements, and uncertainty. Do not turn a failure to detect a statistically significant difference into evidence of equivalence, or automatically extrapolate from one muscle to all others.

When a source changes an assumption, revise the interpretation and recommendations. If the engine was incorrect, also correct its tests and identify affected configurations. Software and scientific reasoning must be able to evolve together.

### 17.5 Features the agent should consider and propose

| Feature | Question it helps answer | Proposed priority |
|---|---|---|
| Selecting a movement region on the A/B curves | Where do the installations actually differ? | V1 |
| Annotated comparison with conditions and assumptions | Why does this difference occur, and what can be concluded? | V1 |
| Parameter sweep | What happens as I gradually move the pulley closer? | Near-term extension |
| Height–distance or angle–distance map | Which setup regions satisfy my objective and constraints? | Near-term extension |
| Constrained setup search | Which trade-offs load the target region without contact or an unwanted reversal? | After the relevant model is validated |
| Sensitivity analysis and uncertainty ranges | Does the result hold if my measurements are off by a few centimetres? | After the first comparisons |
| Hypothesis notebook linked to configurations | What have we tested, and what remains to be checked? | Incremental |
| Evidence notes linked to conclusions | Does this preference rest on a calculation, a hypothesis, or training studies? | Incremental |

An optimiser must fix the force convention, movement interval, allowed parameters, and constraints. It must not artificially improve its score by increasing the load or removing the difficult region. Prefer several solutions with trade-offs to a single “best setup.” Optimisation of a mechanical criterion must not be labelled “guaranteed hypertrophy optimisation.”

These features are proposals to prioritize with the user. Do not delay the first interactive version to implement all of them at once.

### 17.6 Three starting questions already available

- **Bench-supported pullover:** which height–distance combinations maintain resisting cable action in a chosen elevation region while allowing the cables to clear the equipment? Compare solutions and their sensitivity to backrest dimensions.
- **Cable versus dumbbell lateral raise:** how does the moment distribution change over the same joint-angle interval, under a stated force convention? Keep this finding separate from the question of muscle growth.
- **Curl with the upper arm in front of or behind the torso:** which differences come from external loading, and which require an additional anatomical model? Propose the information to investigate before attributing an advantage to the biceps.

At every milestone review, the agent should present a technical result, a biomechanical finding with its scope clearly stated, and a useful next improvement. The user can redirect these three areas separately.

## 18. Project brief for the receiving agent

Build the application described here and work with me on its design. Help me understand bodybuilding biomechanics and compare exercise setups with hypertrophy as the training objective. We will iterate on the software, the features, and the scientific relevance. Propose useful questions, metrics, comparisons, research, and improvements; discuss them with me instead of treating this as a fixed feature checklist.

Begin with a short interpretation of the goal, the first questions worth exploring, and a concrete first milestone. Then show an interactive version early and improve it through our feedback. The starting point is a pullover model with genuine A/B comparison, height and editable body proportions, and meaningful mechanical results; expand to the proposed catalog through validated models. The prototype source is included in Appendix A. Preserve its useful interactions while developing richer visuals and analyses.

When we ask what is better, define the criterion and distinguish calculations, estimates, study findings, and hypotheses. Do not present an angle or external moment as a direct measurement of muscle tension or growth. Investigate more advanced models when useful and supported by the available data. I may later provide my training program and equipment measurements to refine priorities; their absence should not block the first useful version.

## 19. References and status of claims

The product requirements are consolidated in this handoff. Proposed settings are mechanical examples to validate, not medical prescriptions or conclusions from comparative hypertrophy trials.

The detailed equations and numerical cases are design specifications and mathematical deductions developed for this document. The sources below support general principles or technical choices; they do not independently validate every exercise or machine.

| Ref. | Primary/official source | Use |
|---|---|---|
| S1 | [web.dev — PWA installation](https://web.dev/learn/pwa/installation) | Installation capabilities and browser differences |
| S2 | [MDN — Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) | Offline-operation principles and the role of service workers |
| S3 | [OpenStax — University Physics, 10.6 Torque](https://openstax.org/books/university-physics-volume-1/pages/10-6-torque) | Cross product, moment arm, direction, and summation of moments |
| S4 | [React — Using TypeScript](https://react.dev/learn/typescript) | Support for the proposed interface architecture |
| S5 | [Vite — Getting Started](https://vite.dev/guide/) | Tooling and verification of environment requirements at project start |
| S6 | [OpenSim — How Static Optimization Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619/How%2BStatic%2BOptimization%2BWorks) | Additional models and assumptions required to estimate muscle forces |
| S7 | [OpenSim — How Scaling Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089158) | Measured/manual segment-specific scaling; distinction between geometric and mass-property scaling |

Technical references consulted on 27 October 2026. Verify their versions and browser requirements when development begins. For a future precise anatomical claim, commercial-machine profile, or hypertrophy comparison, add a specific source with its scope and limitations rather than treating a statement from the conversation as evidence.

## Appendix A. Reconstructed pullover comparator — complete source

This is the exact source of the recreated in-chat comparator that the user reviewed. It preserves that reference, including its French labels. It is not the unavailable original visualization source. The specification above describes the richer application to design; where it differs from this small prototype, follow the specification and discuss meaningful design choices with the user.

**What it demonstrates:** independent A/B configurations, optional shared arm position, copying A to B, six presets, body/equipment adjustments, side and optional top views at a shared scale, resistance direction, and spatial backrest-contact checks.

**What remains simplified:** symmetric motion with fixed elbow bend, a schematic body, normalized cable tension used for direction, and a schematic machine with unknown resistance. It does not yet calculate personalized muscle forces, hypertrophy, comprehensive body collisions, or the final numerical analysis and chart suite. The complete profile workflow in section 4.4 still needs implementation.

**Using the source:** copy the following `html` block into `pullover-comparateur.html`. All prototype logic and scoped styles are included; there are no external JavaScript dependencies. It is an HTML fragment originally hosted in a chat renderer. For a standalone browser preview, place it in a normal HTML page with a UTF-8 charset and viewport meta tag, add standard form/typography styling, and define the host theme variables (`--foreground`, `--background`, `--border`, `--muted`, `--muted-foreground`, `--viz-series-1`, `--viz-series-2`). Hide `.sr-only` text visually while preserving screen-reader access. No original chat access is needed.

**Verification status of this reference:** syntax, analytical geometry cases, virtual-work checks, spatial contact cases, and selected event-handler scenarios were checked. SVG outputs were inspected as images. A complete browser interaction and rendering test was not performed in the creation environment; perform it when integrating the reference, alongside the acceptance tests in section 13.

```html
<div id="pullover-compare-v1">
  <style>
    #pullover-compare-v1 { color: var(--foreground); }
    #pullover-compare-v1 .pc-heading { padding-right: 95px; }
    #pullover-compare-v1 .pc-columns { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 28px; margin-top: 20px; }
    #pullover-compare-v1 .pc-column { min-width: 0; }
    #pullover-compare-v1 .pc-column h3 { margin-bottom: 10px; }
    #pullover-compare-v1 .pc-scene { display: block; width: 100%; overflow: visible; margin: 8px 0; }
    #pullover-compare-v1 .pc-top { display: block; width: 100%; margin: 8px 0; }
    #pullover-compare-v1 .pc-top[hidden] { display: none; }
    #pullover-compare-v1 .pc-metrics { display: grid; gap: 5px; min-height: 72px; margin: 8px 0 14px; }
    #pullover-compare-v1 .pc-field { margin: 10px 0 14px; }
    #pullover-compare-v1 .pc-label-line { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 4px; }
    #pullover-compare-v1 output { font-variant-numeric: tabular-nums; white-space: nowrap; }
    #pullover-compare-v1 details { margin: 14px 0 0; }
    #pullover-compare-v1 summary { font-weight: 500; }
    #pullover-compare-v1 .pc-caption { margin-top: 10px; }
    #pullover-compare-v1 .pc-legend { display: flex; gap: 10px 20px; flex-wrap: wrap; margin-top: 8px; }
    #pullover-compare-v1 .pc-legend span { display: inline-flex; gap: 7px; align-items: center; }
    #pullover-compare-v1 .pc-line-key { display: inline-block; width: 22px; height: 2px; background: var(--viz-series-1); }
    #pullover-compare-v1 .pc-line-key.pc-body-key { background: var(--foreground); }
    #pullover-compare-v1 svg text { fill: var(--foreground); }
    #pullover-compare-v1 .pc-result-word { font-weight: 500; }
    @media (max-width: 680px) {
      #pullover-compare-v1 .pc-columns { grid-template-columns: minmax(0,1fr); gap: 24px; }
      #pullover-compare-v1 .pc-metrics { min-height: 0; }
    }
  </style>
  <h2 class="pc-heading">Pullover · deux configurations</h2>
  <div class="viz-controls">
    <label class="form-check"><input id="pc-sync" class="form-check-input" type="checkbox" checked><span class="form-check-label">Synchroniser les bras</span></label>
    <label class="form-check"><input id="pc-top-toggle" class="form-check-input" type="checkbox"><span class="form-check-label">Vue de dessus</span></label>
    <button type="button" class="btn" id="pc-copy">Copier A vers B</button>
  </div>
  <div class="pc-legend text-small">
    <span><i class="pc-line-key pc-body-key" aria-hidden="true"></i>Corps</span>
    <span><i class="pc-line-key" aria-hidden="true"></i>Câble et traction</span>
    <span>Même échelle en A et B</span>
  </div>
  <div class="pc-columns">
    <section class="pc-column" id="pc-a" aria-labelledby="pc-a-title">
      <h3 id="pc-a-title">A</h3>
      <label class="form-label" for="pc-a-variant">Préréglage</label>
      <select class="form-select" id="pc-a-variant" data-key="variant" data-side="a">
        <option value="classic">Classique — face à une poulie</option>
        <option value="outside">Dos aux poulies — debout dehors</option>
        <option value="inside">Intérieur — penché à 60°</option>
        <option value="inside-upright">Intérieur — buste droit</option>
        <option value="bench">Dos aux poulies — sur banc</option>
        <option value="machine">Machine à pullover — schéma</option>
      </select>
      <svg class="pc-scene" role="img" aria-label="Configuration A, vue de profil"></svg>
      <svg class="pc-top" hidden role="img" aria-label="Configuration A, vue de dessus"></svg>
      <div class="pc-metrics">
        <div class="pc-result-word" data-result="sense"></div>
        <div class="text-small" data-result="angle"></div>
        <div class="text-small" data-result="contact"></div>
      </div>
      <div data-controls="main"></div>
      <details>
        <summary class="cursor-interaction">Corps, barre et banc</summary>
        <div data-controls="advanced"></div>
      </details>
    </section>
    <section class="pc-column" id="pc-b" aria-labelledby="pc-b-title">
      <h3 id="pc-b-title">B</h3>
      <label class="form-label" for="pc-b-variant">Préréglage</label>
      <select class="form-select" id="pc-b-variant" data-key="variant" data-side="b">
        <option value="classic">Classique — face à une poulie</option>
        <option value="outside">Dos aux poulies — debout dehors</option>
        <option value="inside">Intérieur — penché à 60°</option>
        <option value="inside-upright">Intérieur — buste droit</option>
        <option value="bench">Dos aux poulies — sur banc</option>
        <option value="machine">Machine à pullover — schéma</option>
      </select>
      <svg class="pc-scene" role="img" aria-label="Configuration B, vue de profil"></svg>
      <svg class="pc-top" hidden role="img" aria-label="Configuration B, vue de dessus"></svg>
      <div class="pc-metrics">
        <div class="pc-result-word" data-result="sense"></div>
        <div class="text-small" data-result="angle"></div>
        <div class="text-small" data-result="contact"></div>
      </div>
      <div data-controls="main"></div>
      <details>
        <summary class="cursor-interaction">Corps, barre et banc</summary>
        <div data-controls="advanced"></div>
      </details>
    </section>
  </div>
  <div class="pc-caption text-small">Bras : 0° le long du buste · 180° dans son prolongement · 200° au-delà</div>
  <div class="text-small">Sens étudié : ramener les bras vers le buste · Contact évalué avec le dossier représenté</div>
  <div class="text-small">Géométrie simplifiée · Amplitudes exploratoires · Aucune tension musculaire calculée</div>
  <div id="pc-live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
</div>
<script>
(function () {
  'use strict';
  var root = document.getElementById('pullover-compare-v1');
  if (!root) return;
  var RAD = Math.PI / 180, NS = 'http://www.w3.org/2000/svg';
  var fg = 'var(--foreground)', muted = 'var(--muted-foreground)', border = 'var(--border)';
  var cableColor = 'var(--viz-series-1)', eventColor = 'var(--viz-series-2)';
  var panels = {a:root.querySelector('#pc-a'),b:root.querySelector('#pc-b')};
  var presets = {
    classic: {type:'classic',tilt:90,x:0.76,ph:2.25,base:1.02},
    outside: {type:'standing',tilt:0,x:0.85,ph:2.2,base:1.0},
    inside: {type:'standing',tilt:60,x:-0.38,ph:2.15,base:0.8},
    'inside-upright': {type:'standing',tilt:0,x:-0.35,ph:2.25,base:1.0},
    bench: {type:'bench',tilt:60,x:0.85,ph:1.35,base:0.46},
    machine: {type:'machine',tilt:85,x:0.8,ph:1.5,base:0.46}
  };
  var common = {q:180,arm:0.76,torso:0.59,elbow:0,back:0.82,bw:0.34,bt:0.10,span:1.55,bar:0.95};
  function preset(name) { return Object.assign({},common,presets[name],{variant:name}); }
  var state = {a:preset('inside'),b:preset('bench')};
  var definitions = [
    {key:'q',label:'Bras par rapport au buste',min:0,max:200,step:1,unit:'°',group:'main'},
    {key:'ph',label:'Hauteur des poulies',min:0.05,max:2.8,step:0.01,unit:'cm',group:'main'},
    {key:'x',label:'Épaules / plan des poulies',min:-1.3,max:2.4,step:0.01,unit:'signed',group:'main'},
    {key:'tilt',label:'Inclinaison',min:-30,max:90,step:1,unit:'°',group:'main'},
    {key:'arm',label:'Longueur du bras déplié',min:0.40,max:1.05,step:0.01,unit:'cm',group:'advanced'},
    {key:'elbow',label:'Flexion fixe des coudes',min:0,max:100,step:1,unit:'°',group:'advanced'},
    {key:'torso',label:'Distance bassin–épaules',min:0.35,max:0.8,step:0.01,unit:'cm',group:'advanced'},
    {key:'base',label:'Hauteur du bassin',min:0.25,max:1.25,step:0.01,unit:'cm',group:'advanced'},
    {key:'span',label:'Écartement des sorties',min:0.15,max:2.5,step:0.01,unit:'cm',group:'advanced'},
    {key:'bar',label:'Écartement des attaches',min:0.1,max:1.5,step:0.01,unit:'cm',group:'advanced'},
    {key:'back',label:'Longueur du dossier',min:0.35,max:1.20,step:0.01,unit:'cm',group:'advanced'},
    {key:'bw',label:'Largeur du dossier',min:0.20,max:0.9,step:0.01,unit:'cm',group:'advanced'},
    {key:'bt',label:'Épaisseur du dossier',min:0.04,max:0.22,step:0.01,unit:'cm',group:'advanced'}
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  Object.keys(panels).forEach(function(side){
    definitions.forEach(function(f){
      var id='pc-'+side+'-'+f.key;
      var html='<div class="pc-field" data-field="'+f.key+'"><div class="pc-label-line"><label class="form-label" for="'+id+'">'+esc(f.label)+'</label><output for="'+id+'"></output></div><input class="form-range" id="'+id+'" type="range" data-side="'+side+'" data-key="'+f.key+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'"></div>';
      panels[side].querySelector('[data-controls="'+f.group+'"]').insertAdjacentHTML('beforeend',html);
    });
  });
  function add(a,b) { return a.map(function(v,i){return v+b[i];}); }
  function sub(a,b) { return a.map(function(v,i){return v-b[i];}); }
  function mul(a,k) { return a.map(function(v){return v*k;}); }
  function dot(a,b) { return a.reduce(function(s,v,i){return s+v*b[i];},0); }
  function norm(a) { return Math.sqrt(dot(a,a)); }
  function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }
  function geometry(c,qOverride) {
    var q=(qOverride===undefined?c.q:qOverride)*RAD;
    var bench=c.type==='bench'||c.type==='machine', d=c.type==='classic'?-1:1;
    var beta=(bench?c.tilt-90:c.tilt)*RAD;
    var t=[d*Math.sin(beta),0,Math.cos(beta)], n=[d*Math.cos(beta),0,-Math.sin(beta)];
    var hip=[c.x-c.torso*t[0],0,c.base], S=add(hip,mul(t,c.torso));
    function u(a){return [d*Math.sin(a-beta),0,-Math.cos(a-beta)];}
    function du(a){return [d*Math.cos(a-beta),0,Math.sin(a-beta)];}
    var E=add(S,mul(u(q),c.arm*0.52));
    var H=add(E,mul(u(q+c.elbow*RAD),c.arm*0.48));
    var Hq=add(mul(du(q),c.arm*0.52),mul(du(q+c.elbow*RAD),c.arm*0.48));
    var offset=c.bt/2+0.08;
    var backBase=sub(hip,mul(n,offset));
    var backTop=add(backBase,mul(t,c.back));
    var head=add(add(S,mul(t,0.18)),mul(n,0.13));
    var knee,foot;
    if (bench) {
      knee=add(hip,[d*0.40,0,-0.04]);
      foot=[knee[0]+d*0.05,0,0.04];
    } else {
      knee=[hip[0]+d*0.06,0,c.base*0.49];
      foot=[knee[0]+d*0.13,0,0.04];
    }
    var g={bench:bench,d:d,beta:beta,t:t,n:n,S:S,E:E,H:H,Hq:Hq,hip:hip,knee:knee,foot:foot,head:head,backBase:backBase,backTop:backTop,c:c};
    var ys=c.type==='classic'?[0]:[-c.bar/2,c.bar/2];
    g.cables=c.type==='machine'?[]:ys.map(function(y,i){
      var A=[H[0],y,H[2]], P=[0,c.type==='classic'?0:(i===0?-1:1)*c.span/2,c.ph];
      var v=sub(P,A),len=norm(v);
      return {H:A,P:P,v:v,len:len,F:len>1e-8?mul(v,1/len):null};
    });
    return g;
  }
  function hitBox(A,P,g,radius) {
    var c=g.c;
    function local(v) {var a=sub(v,g.backBase);return [dot(a,g.t),a[1],dot(a,g.n)];}
    var a=local(A),b=local(P),v=sub(b,a);
    var lows=[-radius,-c.bw/2-radius,-c.bt/2-radius];
    var highs=[c.back+radius,c.bw/2+radius,c.bt/2+radius],lo=0,hi=1;
    for(var i=0;i<3;i++){
      if(Math.abs(v[i])<1e-10){if(a[i]<lows[i]||a[i]>highs[i])return null;}
      else {var t1=(lows[i]-a[i])/v[i],t2=(highs[i]-a[i])/v[i];if(t1>t2){var tmp=t1;t1=t2;t2=tmp;}lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}
    }
    return add(A,mul(sub(P,A),lo));
  }
  function metrics(g) {
    if(g.c.type==='machine')return {sense:'Profil de résistance inconnu',angle:null,contact:null,unknown:true};
    var contact=null,what='',Q=0,valid=true;
    g.cables.forEach(function(c){
      if(!c.F)valid=false;else Q+=dot(c.F,g.Hq);
      if(g.bench){var h=hitBox(c.H,c.P,g,0.003);if(h){contact=h;what='câble';}}
    });
    if(g.bench){
      var barHit=hitBox([g.H[0],-g.c.bar/2,g.H[2]],[g.H[0],g.c.bar/2,g.H[2]],g,0.015);
      if(barHit){contact=barHit;what='barre';}
    }
    var r=sub(g.H,g.S),v=[-g.H[0],0,g.c.ph-g.H[2]],angle=null;
    if(norm(r)>1e-8&&norm(v)>1e-8)angle=Math.acos(clamp(Math.abs(dot(r,v)/(norm(r)*norm(v))),0,1))/RAD;
    var threshold=0.015*Math.max(0.1,norm(r))*g.cables.length;
    var sense=!valid?'Attache confondue avec la sortie':Q>threshold?'Résiste au rapprochement des bras':Q<-threshold?'Aide le rapprochement des bras':'Effet presque nul sur ce mouvement';
    if(contact)sense='Trajet interrompu par le dossier';
    if(g.H[2]<0)sense='Position irréalisable : barre sous le sol';
    return {sense:sense,Q:Q,angle:angle,contact:contact,what:what,valid:valid};
  }
  function bounds() {
    var points=[[0,0,0],[0,0,2.7]];
    Object.keys(state).forEach(function(s){
      var c=state[s];
      for(var q=0;q<=200;q+=10){
        var g=geometry(c,q);
        points.push(g.H,g.E,g.S,g.hip,g.head,g.knee,g.foot,[0,0,c.ph]);
        if(g.bench)points.push(g.backBase,g.backTop,add(g.hip,[0.45,0,0]));
      }
    });
    return {xmin:Math.min.apply(null,points.map(function(p){return p[0];}))-0.20,xmax:Math.max.apply(null,points.map(function(p){return p[0];}))+0.25,zmin:Math.min(0,Math.min.apply(null,points.map(function(p){return p[2];}))-0.08),zmax:Math.max.apply(null,points.map(function(p){return p[2];}))+0.24};
  }
  function el(tag,attrs,parent,text) {
    var e=document.createElementNS(NS,tag);Object.keys(attrs||{}).forEach(function(k){e.setAttribute(k,attrs[k]);});
    if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;
  }
  function line(svg,a,b,color,width,dash) {
    var attrs={x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,'stroke-width':width||2,'stroke-linecap':'round'};
    if(dash)attrs['stroke-dasharray']=dash;return el('line',attrs,svg);
  }
  function circle(svg,p,r,fill,stroke) {return el('circle',{cx:p[0],cy:p[1],r:r,fill:fill||'none',stroke:stroke||'none','stroke-width':1.5},svg);}
  function text(svg,p,str,anchor) {return el('text',{x:p[0],y:p[1],'text-anchor':anchor||'start',class:'text-small'},svg,str);}
  function polygon(svg,pts,fill,stroke,width) {return el('polygon',{points:pts.map(function(p){return p.join(',');}).join(' '),fill:fill,stroke:stroke||'none','stroke-width':width||1.5,'stroke-linejoin':'round'},svg);}
  function arrow(svg,a,b,color) {
    line(svg,a,b,color,2.5);var dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);
    if(l<2)return;dx/=l;dy/=l;polygon(svg,[b,[b[0]-8*dx+4*dy,b[1]-8*dy-4*dx],[b[0]-8*dx-4*dy,b[1]-8*dy+4*dx]],color);
  }
  function bodyLine(svg,pts,project) {
    el('polyline',{points:pts.map(project).map(function(p){return p.join(',');}).join(' '),fill:'none',stroke:fg,'stroke-width':5,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  }
  function backCorners(g) {
    return [add(g.backBase,mul(g.n,-g.c.bt/2)),add(g.backTop,mul(g.n,-g.c.bt/2)),add(g.backTop,mul(g.n,g.c.bt/2)),add(g.backBase,mul(g.n,g.c.bt/2))];
  }
  function drawSide(svg,g,m,b,sharedWidth) {
    var w=Math.max(280,Math.floor(svg.getBoundingClientRect().width||sharedWidth));
    var scale=Math.min((sharedWidth-40)/(b.xmax-b.xmin),110);
    var h=Math.round((b.zmax-b.zmin)*scale+74);
    svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('height',h);svg.replaceChildren();
    var xOffset=(w-(b.xmax-b.xmin)*scale)/2;
    var p=function(v){return [xOffset+(v[0]-b.xmin)*scale,22+(b.zmax-v[2])*scale];};
    el('title',{},svg,'Profil : '+m.sense);
    var floor=p([0,0,0])[1], railX=p([0,0,0])[0];
    line(svg,[12,floor],[w-12,floor],border,1);
    if(g.c.type!=='machine'){
      line(svg,[railX,22],[railX,floor],border,1,'4 5');
      line(svg,p([0,0,0.06]),p([0,0,2.7]),muted,2);
      text(svg,[railX<85?12:railX>w-85?w-12:railX,14],'Plan des poulies',railX<85?'start':railX>w-85?'end':'middle');
      text(svg,[14,h-6],'Intérieur ←');text(svg,[w-14,h-6],'→ Salle','end');
    }
    if(g.bench){
      polygon(svg,backCorners(g).map(p),'var(--muted)',muted,1.5);
      var seat0=add(g.hip,[-0.08,0,-0.07]),seat1=add(g.hip,[0.43,0,-0.07]);
      line(svg,p(seat0),p(seat1),muted,8);
      line(svg,p(add(g.hip,[0.2,0,-0.07])),p([g.hip[0]+0.2,0,0.03]),muted,3);
      line(svg,p([g.hip[0]-0.15,0,0.03]),p([g.hip[0]+0.5,0,0.03]),muted,3);
    }
    bodyLine(svg,[g.foot,g.knee,g.hip,g.S],p);
    var neck=add(g.S,mul(g.t,0.08));
    line(svg,p(g.S),p(neck),fg,4);
    circle(svg,p(g.head),0.11*scale,'var(--background)',fg);
    var nose=add(g.head,mul(g.n,0.12));circle(svg,p(nose),2,fg);
    var up=geometry(g.c,180);
    line(svg,p(g.S),p(up.H),border,1,'3 4');
    if(g.c.type==='machine'){
      var pivot=p(add(g.S,[-0.09,0,0]));
      circle(svg,pivot,6,'var(--muted)',muted);
      line(svg,pivot,p(g.E),muted,4);
      var stack=p([g.hip[0]-0.48,0,0.13]);
      el('rect',{x:stack[0]-12,y:stack[1]-45,width:24,height:45,fill:'var(--muted)',stroke:muted,'stroke-width':1},svg);
      for(var j=1;j<6;j++)line(svg,[stack[0]-12,stack[1]-j*7],[stack[0]+12,stack[1]-j*7],muted,1);
    }
    g.cables.forEach(function(c,i){
      if(i>0)return;
      var hp=p(c.H),pp=p(c.P);
      line(svg,hp,pp,cableColor,2);
      circle(svg,pp,5,'var(--background)',cableColor);
      var d=Math.hypot(pp[0]-hp[0],pp[1]-hp[1]);
      if(d>6)arrow(svg,hp,[hp[0]+(pp[0]-hp[0])*Math.min(0.5,42/d),hp[1]+(pp[1]-hp[1])*Math.min(0.5,42/d)],cableColor);
    });
    bodyLine(svg,[g.S,g.E,g.H],p);
    circle(svg,p(g.S),4,'var(--background)',fg);
    circle(svg,p(g.E),3,'var(--background)',fg);
    circle(svg,p(g.H),4,cableColor);
    if(g.c.type==='machine'){
      var ep=p(g.E);line(svg,[ep[0]-7,ep[1]-3],[ep[0]+7,ep[1]+3],eventColor,6);
    }
    if(m.contact){var cp=p(m.contact);circle(svg,cp,8,'none',eventColor);line(svg,[cp[0]-4,cp[1]-4],[cp[0]+4,cp[1]+4],eventColor,2);line(svg,[cp[0]-4,cp[1]+4],[cp[0]+4,cp[1]-4],eventColor,2);}
    var hp=p(g.H),sp=p(g.S);
    text(svg,[clamp(hp[0]+9,12,w-65),clamp(hp[1]-11,34,h-58)],'Barre');
    if(Math.hypot(hp[0]-sp[0],hp[1]-sp[1])>40){
      var labelLeft=sp[0]>80;
      text(svg,[labelLeft?sp[0]-10:sp[0]+10,clamp(sp[1]+18,38,h-58)],'Épaule',labelLeft?'end':'start');
    }
    text(svg,[14,h-28],g.d<0?'Regard ←':'Regard →');
    var scaleLen=0.5*scale;
    line(svg,[w-18-scaleLen,h-28],[w-18,h-28],muted,1.5);
    line(svg,[w-18-scaleLen,h-32],[w-18-scaleLen,h-24],muted,1);
    line(svg,[w-18,h-32],[w-18,h-24],muted,1);
    text(svg,[w-18-scaleLen/2,h-37],'50 cm','middle');
  }
  function drawTop(svg,g,m,b,sharedWidth) {
    var w=Math.max(280,Math.floor(svg.getBoundingClientRect().width||sharedWidth));
    var maxSpan=Math.max(state.a.span,state.b.span,state.a.bar,state.b.bar,0.9);
    var scale=Math.min((sharedWidth-40)/(b.xmax-b.xmin),110);
    var h=Math.max(155,Math.round((maxSpan+0.35)*scale+40));
    svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('height',h);svg.replaceChildren();
    var offset=(w-(b.xmax-b.xmin)*scale)/2;
    var p=function(v){return [offset+(v[0]-b.xmin)*scale,h/2+v[1]*scale];};
    el('title',{},svg,'Vue de dessus : câbles et dossier');
    text(svg,[12,17],'Vue de dessus');
    line(svg,p([0,-maxSpan/2-0.1,0]),p([0,maxSpan/2+0.1,0]),border,1,'4 5');
    if(g.bench){
      var corners=backCorners(g),x1=Math.min.apply(null,corners.map(function(v){return v[0];})),x2=Math.max.apply(null,corners.map(function(v){return v[0];}));
      polygon(svg,[[x1,-g.c.bw/2,0],[x1,g.c.bw/2,0],[x2,g.c.bw/2,0],[x2,-g.c.bw/2,0]].map(p),'var(--muted)',muted,1);
    }
    var shoulders=[add(g.S,[0,-0.21,0]),add(g.S,[0,0.21,0])];
    line(svg,p(shoulders[0]),p(shoulders[1]),fg,5);
    line(svg,p(g.hip),p(g.S),fg,5);
    var barHalf=g.c.type==='classic'?0.32:g.c.bar/2;
    line(svg,p([g.H[0],-barHalf,0]),p([g.H[0],barHalf,0]),fg,4);
    line(svg,p(shoulders[0]),p([g.H[0],-Math.min(barHalf,0.26),0]),fg,2);
    line(svg,p(shoulders[1]),p([g.H[0],Math.min(barHalf,0.26),0]),fg,2);
    g.cables.forEach(function(c){line(svg,p(c.H),p(c.P),cableColor,2);circle(svg,p(c.P),4,'var(--background)',cableColor);circle(svg,p(c.H),3,cableColor);});
    if(m.contact)circle(svg,p(m.contact),7,'none',eventColor);
  }
  function format(f,v) {
    if(f.unit==='°')return Math.round(v)+'°';
    if(f.unit==='signed'){var cm=Math.round(v*100);return Math.abs(cm)+' cm '+(cm<0?'derrière':cm>0?'devant':'dans le plan');}
    return Math.round(v*100)+' cm';
  }
  function updateControls(side) {
    var c=state[side],panel=panels[side],bench=c.type==='bench'||c.type==='machine',machine=c.type==='machine';
    panel.querySelector('select').value=c.variant;
    definitions.forEach(function(f){
      var field=panel.querySelector('[data-field="'+f.key+'"]'),input=field.querySelector('input'),label=field.querySelector('label');
      input.value=c[f.key];field.querySelector('output').textContent=format(f,c[f.key]);
      input.disabled=false;field.hidden=false;
      if(f.key==='tilt'){
        label.textContent=bench?'Dossier par rapport au sol':'Buste depuis la verticale';
        input.min=bench?0:-30;input.max=90;
      }
      if(f.key==='base'){label.textContent=bench?'Hauteur du siège':'Hauteur du bassin';input.max=bench?0.85:1.25;}
      if(['back','bw','bt'].includes(f.key))field.hidden=!bench;
      if(['span','bar'].includes(f.key))field.hidden=c.type==='classic'||machine;
      if(['ph','x'].includes(f.key)&&machine)input.disabled=true;
    });
  }
  var pending=false;
  function draw() {
    pending=false;var b=bounds();
    var widths=Object.keys(panels).map(function(s){return panels[s].querySelector('.pc-scene').getBoundingClientRect().width;});
    var visibleWidths=widths.filter(function(x){return x>0;});
    var width=Math.max(280,visibleWidths.length?Math.min.apply(null,visibleWidths):460);
    var summaries=[];
    Object.keys(panels).forEach(function(side){
      updateControls(side);
      var panel=panels[side],g=geometry(state[side]),m=metrics(g);
      drawSide(panel.querySelector('.pc-scene'),g,m,b,width);
      var top=panel.querySelector('.pc-top');top.hidden=!root.querySelector('#pc-top-toggle').checked;
      if(!top.hidden)drawTop(top,g,m,b,width);
      panel.querySelector('[data-result="sense"]').textContent=m.sense;
      panel.querySelector('[data-result="angle"]').textContent=m.unknown?'Machine illustrative · résistance non calculée':'Angle aigu câble–épaule/prise (profil) : '+(m.angle===null?'indéfini':Math.round(m.angle)+'°');
      panel.querySelector('[data-result="contact"]').textContent=m.unknown?'Appuis et mécanisme schématiques':m.contact?'Contact '+m.what+'–dossier · traction directe non interprétable':g.bench?'Dossier : pas de contact détecté':'Épaules '+Math.round(g.S[2]*100)+' cm · barre '+Math.round(g.H[2]*100)+' cm du sol';
      summaries.push(side.toUpperCase()+' : '+m.sense);
    });
    root.querySelector('#pc-live').textContent=summaries.join('. ');
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(draw);}}
  root.addEventListener('input',function(e){
    var key=e.target.dataset.key,side=e.target.dataset.side;
    if(!key||!side||key==='variant')return;
    state[side][key]=Number(e.target.value);
    if(key==='q'&&root.querySelector('#pc-sync').checked)state[side==='a'?'b':'a'].q=state[side].q;
    schedule();
  });
  root.addEventListener('change',function(e){
    var side=e.target.dataset.side;
    if(e.target.dataset.key==='variant'){
      var previous=state[side],next=preset(e.target.value);
      ['q','arm','torso','elbow','back','bw','bt','bar','span'].forEach(function(k){next[k]=previous[k];});
      state[side]=next;schedule();
    }
    if(e.target.id==='pc-sync'&&e.target.checked){state.b.q=state.a.q;schedule();}
    if(e.target.id==='pc-top-toggle')schedule();
  });
  root.querySelector('#pc-copy').addEventListener('click',function(){state.b=Object.assign({},state.a);schedule();});
  var observer=new ResizeObserver(schedule);Object.keys(panels).forEach(function(side){observer.observe(panels[side]);});
  draw();
})();
</script>
```
