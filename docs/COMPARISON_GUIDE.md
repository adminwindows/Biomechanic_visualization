# Six reproducible biomechanics comparisons

These six worked examples answer concrete setup questions within the broader catalog. See [COVERAGE.md](COVERAGE.md) for every target family and the compound, machine-data and research workflows. Their outputs are calculations within declared models, not training-study findings. The mechanics, profile and contact assumptions are documented in [MECHANICS.md](MECHANICS.md); the initial questions and collaboration approach come from the [handoff](../EXERCISE_BIOMECHANICS_HANDOFF.md), especially sections 5, 7 and 17.

## Common procedure

Start from **Reset to example** when reproducing the demonstration measurements, or save/export your current comparison first. Use the same 1.75 m example body in both panels, keep segment weight off unless an experiment explicitly enables it, and select **the same angle** synchronization. Example dimensions are fictional, not a validated prediction of your anatomy.

Load the named preset through **Exercise catalog** or a panel's preset selector. **Copy A → B** is the simplest way to hold everything constant. Enable **Same body** and **Same force per attachment**; leave **Same equipment** off when the experiment changes equipment. Set **Comparison purpose**, enter the stated criterion, and set **Analysis minimum angle / maximum angle**. The differences table should contain only the intended changes for a controlled comparison. Selecting “Controlled” does not equalize inputs automatically.

Record the signed contribution, selected-region summaries, and separate contact/reversal events. A region containing unavailable mechanics cannot produce a complete comparison; do not treat a gap as zero resistance. Save a named comparison and export the report with your observations and next measurement. Report comfort/support as your observation, not a simulation output.

## 1. Pullover: outlet height and overhead resistance

**Question / criterion:** Does raising the pulley by 20 cm preserve a resisting cable contribution through 140–180° without contact with the represented backrest?

**Reproduce:** Load **Bench · 60°** into A, copy it to B, and retain two 100 N cables in each. Set B's **Pulley height** to 155 cm; A remains at 135 cm. Keep the body, bench, placement, grip, fixed elbow bend and movement limits unchanged. Select a controlled comparison and the 140–180° analysis region. Inspect side and top views.

**Metrics and assumption:** Compare the minimum signed contribution, resisting portion and first backrest-contact/reversal events. Both values are total symmetric cable contributions; per-attachment force, cable count and body geometry are matched. The modeled contact volume is the backrest, not the entire real installation.

**Conditional conclusion:** If one setup maintains a positive contribution throughout the region and the other has assistance or represented contact, it better meets this stated mechanical criterion. That does not establish greater latissimus tension or growth. If both are valid, a higher mean is only a different external profile, not an automatic preference.

**Next useful check / sources:** Use the pulley-height sweep and ±2 cm sensitivity check, then measure actual outlet/backrest dimensions. [Torque mechanics](#sources) supports the calculation; the need for an additional muscle model is covered by source 3 below.

## 2. Curl: upper arm beside or behind the torso

**Question / criterion:** How does moving the upper arm behind the torso redistribute elbow resistance while the body, outlet, actual force and elbow-angle interval stay fixed?

**Reproduce:** Load **Low-cable curl · arm at side** into A, copy it to B, and retain one 100 N handle in each. Under B's **Movement model & load**, change **Upper-arm elevation** from 0° to −35°. Keep the original low outlet and all body/placement values. Select a controlled comparison over 30–120° of elbow flexion. This deliberately isolates arm posture; selecting the separate Bayesian preset would also change placement.

**Metrics and assumption:** Compare the curves and early/late portions of the chosen interval. The forearm and grip rotate about the elbow; upper-arm placement changes the elbow and cable geometry. Equal elbow flexion does not imply equal whole-arm posture or equal muscle length.

**Conditional conclusion:** A shifted peak or different contribution at 30° or 120° is explained by the modeled external loading. It cannot by itself decide whether a biceps head is more lengthened, receives more force, or grows more.

**Next useful check / sources:** Measure upper-arm and forearm lengths separately, then rerun without moving the outlet. Sources 1 and 2 support torque and segment-specific scaling; source 3 explains why external moments do not determine muscle-force sharing. No curl hypertrophy trial is attached to this brief.

## 3. Triceps extension: pushdown and overhead installations

**Question / criterion:** How do two complete triceps setups differ in resisting elbow extension over the same elbow-angle interval?

**Reproduce:** Load **High-cable triceps pushdown** into A and **Overhead cable triceps extension** into B. Use one 100 N handle and the same body in both; retain each preset's upper-arm position, facing direction, outlet height and placement. Select **Practical · compare two installations** and analyze 30–110° of elbow flexion. The reference action is extension: decreasing flexion angle.

**Metrics and assumption:** Compare signed elbow-extension contribution and its distribution over the selected region. Inspect the differences table: several settings changed, so the result describes these two installations and cannot isolate upper-arm position as the only cause.

**Conditional conclusion:** A setup that remains resistive over more of this chosen interval better meets that narrow criterion. A numerical difference does not quantify long-head triceps length, relative effort or hypertrophy, nor demonstrate that the same displayed stack load produces the same actual force.

**Next useful check / sources:** Copy one installation and change only its upper-arm angle for a controlled follow-up; measure/calibrate actual attachment force if comparing real machines. Sources 1 and 3 cover the mechanics and additional assumptions needed for muscle-force interpretation. No triceps training-study result is asserted here.

## 4. Lateral raise: cable versus gravity at equal force magnitude

**Question / criterion:** How does force direction change the unilateral shoulder-elevation profile when actual force magnitude and body geometry are matched?

**Reproduce:** Load **Unilateral cable lateral raise** into A and **Dumbbell lateral raise · supported lean** into B. Set B's torso inclination to 0° so both are upright. Temporarily disable the force lock, set A to 49.05 N and B to 5 kg, then enable **Same force per attachment** and verify the values remain matched. Keep the default straight 0.70 m shoulder-to-grip reach, fixed elbow bend of 0°, and segment weight off. Analyze 10–100° as a controlled loading comparison.

**Metrics and assumption:** The dumbbell's force stays vertical; the cable points toward its fixed outlet. Each loads one arm. For the upright dumbbell example alone, `5 × 9.81 × 0.70 × sin(angle)` gives about 17.2 N·m at 30° and 34.3 N·m at 90°. Those are illustrative model values, not a personal strength target.

**Conditional conclusion:** A cable can redistribute resistance relative to gravity over the same arm-angle interval. The curves establish where the specified external profiles differ, not which exercise creates more lateral-deltoid tension or growth. Matching force magnitude does not match effort or proximity to failure.

**Next useful check / sources:** Copy the cable setup and vary its fore–aft outlet position; separately compare an upright and supported-lean dumbbell setup. Source 1 supports the gravity lever calculation; sources 2 and 3 bound anatomical personalization and muscle-force interpretation. No comparative hypertrophy study is attached.

## 5. Cable fly: outlet width and bilateral loading

**Question / criterion:** How does narrowing the outlets change the summed horizontal-adduction contribution when force per independent handle remains constant?

**Reproduce:** Load **Cable fly · two independent handles** into A and copy it to B. Retain 100 N at each of the two handles. Change B's **Outlet separation** from 200 to 140 cm; leave outlet height, fore–aft offset, elbow bend, body and placement unchanged. Select a controlled comparison over 15–75° of horizontal adduction and inspect the top view.

**Metrics and assumption:** Compare the summed bilateral adduction curves and regional mean/minimum. The engine calculates each mirrored handle's force and derivative separately. Opposing lateral force components may cancel in the overall resultant without eliminating the individual handle loads; the sum of two tensions is not the resultant magnitude.

**Conditional conclusion:** A changed curve identifies a change in modeled external adduction demand from outlet geometry. It does not determine pectoral muscle-force sharing, shoulder comfort or growth. A lower curve is not evidence that an exercise is useless.

**Next useful check / sources:** Measure the real outlet spacing and hand positions, then record comfort separately from the calculation. Sources 1 and 3 support force/moment summation and the limits of internal-force inference. No fly training-study result is claimed.

## 6. Hip extension: low versus raised ankle-cable outlet

**Question / criterion:** Does raising the outlet change resistance near neutral and across 0–40° of hip extension while the support and leg geometry stay fixed?

**Reproduce:** Load **Cable hip extension · ankle attachment** into A and copy it to B. Retain one 100 N ankle cable and the same default leg lengths/92 cm pelvis height. Change B's **Pulley height** from 10 to 50 cm, keeping facing direction and pelvis placement fixed. Select a controlled comparison over 0–40°. Keep segment weight off for this first comparison.

**Metrics and assumption:** Compare the hip-extension curve and near-neutral value. The force acts at the ankle, with the opposite leg satisfying the modeled ground support. At neutral, a more upward cable direction reduces its horizontal component; at the same tension this can reduce the resisting contribution about the hip. Inspect the full curve rather than extending that single-position statement to every angle.

**Conditional conclusion:** The result establishes a change in external hip-extension demand for a straight prescribed moving leg. It does not identify how that demand is shared among gluteal/hamstring muscles, establish balance, or predict growth. If edited leg measurements make support impossible, adjust the real placement deliberately rather than treating the invalid value as zero.

**Next useful check / sources:** Measure pelvis height and thigh/shank lengths. As a separate experiment, add explicitly estimated moving-segment masses and inspect the cable and gravity components; do not infer those masses from height. Sources 1–3 support the mechanics, scaling principle and limits of muscle-force inference.

## Sources

These are the sources already identified in the handoff. They support general mechanics/modeling principles, not independent validation of every scenario or a physiological ranking.

1. [OpenStax, University Physics: Torque](https://openstax.org/books/university-physics-volume-1/pages/10-6-torque) — moments, lever arms, directions and summation.
2. [OpenSim: How Scaling Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089158) — segment-specific scaling from measurements; this does not validate the application's fictional height ratios.
3. [OpenSim: How Static Optimization Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619/How%2BStatic%2BOptimization%2BWorks) — additional anatomical, force-sharing and optimization assumptions required to estimate muscle forces. The application does not implement that muscle model.

For a later hypertrophy claim, attach an actual relevant training study and record its muscle, participants, intervention duration, range of motion, loading/effort, growth measurement and uncertainty. Keep that evidence separate from the calculation, the illustrative dimension estimates, and the hypothesis it motivates.
