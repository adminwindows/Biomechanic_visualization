import type { Profile, Vec3 } from './engine';

export type CompoundMovement = 'pullover' | 'pulldown' | 'row' | 'press' | 'pullup' | 'pushup' | 'dip' | 'hinge' | 'bridge' | 'back-extension' | 'squat' | 'lunge' | 'step-up' | 'calf-standing' | 'calf-seated' | 'crunch' | 'woodchop' | 'pallof' | 'sidebend' | 'nordic' | 'face-pull' | 'leg-press';
export type SegmentMasses = { trunk: number; head: number; upperArm: number; forearm: number; thigh: number; shank: number; foot: number };
export type CompoundConfig = {
  preset: string;
  resistance: 'cable' | 'gravity' | 'bodyweight' | 'unknown';
  loadMass: number; tension: number; assistance: number; outlet: Vec3;
  hipHeight: number; torsoAngle: number; gripWidth: number; stance: number;
  stepHeight: number; supportAngle: number; depth: number; unilateral: boolean;
  loadPosition: 'hands' | 'shoulders' | 'pelvis';
  bodyGravity: boolean; masses: SegmentMasses;
  shoulderStart: number; shoulderEnd: number; elbowStart: number; elbowEnd: number;
};
export type CompoundPreset = {
  id: string; name: string; family: string; movement: CompoundMovement;
  aliases: string[]; equipment: string; mechanics: 'open-arm' | 'path' | 'unknown';
  note: string; defaults: Partial<CompoundConfig>;
};
export type CompoundSegment = { id: string; from: Vec3; to: Vec3; massKey: keyof SegmentMasses; width: number };
export type CompoundLoad = { id: string; point: Vec3; force: Vec3; kind: 'cable' | 'gravity' | 'assistance' };
export type CompoundPose = {
  points: Record<string, Vec3>; segments: CompoundSegment[];
  supports: { point: Vec3; kind: string; end?: Vec3 }[]; loads: CompoundLoad[];
  valid: boolean; reasons: string[]; action: string;
};
export type CompoundResult = {
  pose: CompoundPose; pathResistance: number | null;
  /** External moment components about the declared sagittal axes; NOT muscle or contact forces. */
  jointMoments: { label: string; value: number; axis: Vec3 }[] | null;
  status: 'resists' | 'assists' | 'near-zero' | 'geometry' | 'invalid';
  explanation: string; supportStatus: string;
};
export const COMPOUND_VERSION = 'compound-kinematics-1';
export const G = 9.81;
const R = Math.PI / 180;
export const vadd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vmul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const vdot = (a: Vec3, b: Vec3) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const vnorm = (a: Vec3) => Math.hypot(...a);
export const vcross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a: Vec3, b: Vec3, p: number) => vadd(a, vmul(vsub(b, a), p));
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const demoMasses: SegmentMasses = { trunk: 32, head: 5, upperArm: 2, forearm: 1.5, thigh: 8, shank: 4, foot: 1 };
export function representedBodyMass(m: SegmentMasses) { return m.trunk + m.head + 2 * (m.upperArm + m.forearm + m.thigh + m.shank + m.foot); }

function preset(id: string, name: string, family: string, movement: CompoundMovement, equipment: string, mechanics: CompoundPreset['mechanics'], defaults: Partial<CompoundConfig>, aliases: string[] = [], note = ''): CompoundPreset { return { id, name, family, movement, equipment, mechanics, defaults, aliases, note }; }
export const compoundPresets: CompoundPreset[] = [
  preset('pullover-coupled', 'Cable pullover · changing elbow angle', 'Coupled pullover', 'pullover', 'Cable + fixed torso', 'open-arm', { resistance: 'cable', torsoAngle: 60, hipHeight: .55, outlet: [-.5, 0, 2.1], shoulderStart: 175, shoulderEnd: 65, elbowStart: 5, elbowEnd: 40 }, ['variable elbow pullover'], 'Shoulder and elbow angles vary together. The path contribution is J per progress; separate signed arm-joint moments use their declared axes.'),
  preset('pulldown-pronated', 'Pronated lat pulldown', 'Vertical pulls', 'pulldown', 'High cable', 'open-arm', { resistance: 'cable', gripWidth: .62, outlet: [0, 0, 2.45], hipHeight: .55 }, ['lat pull down', 'wide grip'], 'Grip orientation is a label; forearm rotation and muscle recruitment are not inferred.'),
  preset('pulldown-neutral', 'Neutral-grip lat pulldown', 'Vertical pulls', 'pulldown', 'High cable', 'open-arm', { resistance: 'cable', gripWidth: .38, outlet: [.12, 0, 2.4], hipHeight: .55 }, ['parallel grip pulldown'], 'The modeled difference is grip spacing and handle path; pronation is not an anatomical prediction.'),
  preset('pulldown-supinated', 'Supinated lat pulldown', 'Vertical pulls', 'pulldown', 'High cable', 'open-arm', { resistance: 'cable', gripWidth: .32, outlet: [.18, 0, 2.4], hipHeight: .55 }, ['underhand pulldown'], 'Supination itself is not resolved; this example uses a narrower, anterior handle path.'),
  preset('pulldown-unilateral', 'Unilateral kneeling pulldown', 'Vertical pulls', 'pulldown', 'High cable', 'open-arm', { resistance: 'cable', unilateral: true, hipHeight: .46, gripWidth: .42, outlet: [.25, .21, 2.4] }, ['one arm lat pulldown', 'kneeling pull']),
  preset('high-row', 'High cable row', 'Vertical pulls', 'row', 'High cable', 'open-arm', { resistance: 'cable', hipHeight: .55, torsoAngle: 75, outlet: [1.1, 0, 2.05], supportAngle: 45 }, ['diagonal row']),
  preset('pullup-pronated', 'Pronated pull-up', 'Vertical pulls', 'pullup', 'Fixed bar', 'path', { resistance: 'bodyweight', gripWidth: .62, hipHeight: 1.05 }, ['pull up'], 'Fixed hand supports. Hand reaction distribution and shoulder joint moments are unavailable.'),
  preset('pullup-neutral', 'Neutral-grip pull-up', 'Vertical pulls', 'pullup', 'Fixed handles', 'path', { resistance: 'bodyweight', gripWidth: .38, hipHeight: 1.05 }, ['neutral pull up']),
  preset('chinup', 'Supinated chin-up', 'Vertical pulls', 'pullup', 'Fixed bar', 'path', { resistance: 'bodyweight', gripWidth: .32, hipHeight: 1.05, torsoAngle: 80 }, ['chin up'], 'Underhand grip label; modeled differences are width and torso inclination.'),
  preset('pullup-assisted', 'Assisted pull-up', 'Vertical pulls', 'pullup', 'Fixed bar + constant assistance', 'path', { resistance: 'bodyweight', gripWidth: .42, assistance: 180, hipHeight: 1.05 }, ['assisted pull up'], 'Assistance is a declared upward force at the pelvis, not a reconstructed commercial mechanism.'),
  preset('row-seated', 'Seated cable row', 'Horizontal pulls', 'row', 'Low cable', 'open-arm', { resistance: 'cable', hipHeight: .52, torsoAngle: 90, outlet: [1.45, 0, .85] }, ['seated row']),
  preset('row-standing', 'Standing cable row', 'Horizontal pulls', 'row', 'Cable', 'open-arm', { resistance: 'cable', hipHeight: .9, torsoAngle: 80, outlet: [1.45, 0, 1.35] }, ['standing row'], 'Torso is prescribed fixed; arm results exclude the forces needed to stabilize the trunk.'),
  preset('row-unilateral', 'Single-arm cable row', 'Horizontal pulls', 'row', 'Cable', 'open-arm', { resistance: 'cable', unilateral: true, hipHeight: .9, outlet: [1.45, .21, 1.3] }, ['one arm row']),
  preset('row-supported', 'Chest-supported dumbbell row', 'Horizontal pulls', 'row', 'Dumbbells + bench', 'open-arm', { resistance: 'gravity', torsoAngle: 35, hipHeight: .55, loadMass: 24 }, ['incline dumbbell row']),
  preset('row-barbell', 'Bent-over barbell row', 'Horizontal pulls', 'row', 'Barbell', 'open-arm', { resistance: 'gravity', torsoAngle: 25, hipHeight: .9, loadMass: 40, gripWidth: .55 }, ['barbell row'], 'The trunk is held fixed. Arm moments are available; lumbar and hip moments are not inferred from the bar alone.'),
  preset('row-tbar', 'T-bar row · lever-path illustration', 'Horizontal pulls', 'row', 'Unknown lever transmission', 'unknown', { resistance: 'unknown', torsoAngle: 35, hipHeight: .9, tension: 140, outlet: [1.5, 0, .05], gripWidth: .3 }, ['landmine row'], 'Rigid pivot-to-handle distance is preserved. Load position, lever mass and transmission remain unspecified; resistance is unavailable.'),
  preset('row-machine', 'Converging row machine · illustration', 'Horizontal pulls', 'row', 'Unknown machine', 'unknown', { resistance: 'unknown', hipHeight: .55, gripWidth: .56 }, ['machine row'], 'No mechanism or calibrated resistance has been supplied.'),
  preset('face-pull', 'Face pull · elbow and shoulder path', 'Rear delts', 'face-pull', 'High cable', 'path', { resistance: 'cable', hipHeight: .9, gripWidth: .65, outlet: [1.35, 0, 1.8] }, ['rope face pull'], 'Bilateral transverse arm path; external rotation and individual joint sharing are not identified.'),
  preset('bench-barbell', 'Flat barbell bench press', 'Presses', 'press', 'Barbell + bench', 'open-arm', { resistance: 'gravity', torsoAngle: 0, hipHeight: .5, loadMass: 40, gripWidth: .6 }, ['bench press']),
  preset('bench-dumbbell', 'Flat dumbbell bench press', 'Presses', 'press', 'Dumbbells + bench', 'open-arm', { resistance: 'gravity', torsoAngle: 0, hipHeight: .5, loadMass: 30, gripWidth: .44 }, ['dumbbell press']),
  preset('bench-incline', 'Incline dumbbell press', 'Presses', 'press', 'Dumbbells + incline bench', 'open-arm', { resistance: 'gravity', torsoAngle: 35, hipHeight: .5, loadMass: 30, gripWidth: .48 }, ['incline bench press']),
  preset('bench-decline', 'Decline bench press', 'Presses', 'press', 'Barbell + decline bench', 'open-arm', { resistance: 'gravity', torsoAngle: -15, hipHeight: .6, loadMass: 40, gripWidth: .56 }, ['decline press']),
  preset('shoulder-press', 'Seated dumbbell shoulder press', 'Presses', 'press', 'Dumbbells + seat', 'open-arm', { resistance: 'gravity', torsoAngle: 90, supportAngle: 90, hipHeight: .55, loadMass: 20 }, ['overhead press']),
  preset('cable-press-standing', 'Standing cable press', 'Presses', 'press', 'Cable', 'open-arm', { resistance: 'cable', torsoAngle: 90, hipHeight: .9, outlet: [-.9, 0, 1.25], tension: 100 }, ['standing chest press']),
  preset('cable-press-seated', 'Seated cable press', 'Presses', 'press', 'Cable + seat', 'open-arm', { resistance: 'cable', torsoAngle: 90, hipHeight: .55, outlet: [-.9, 0, 1.1] }, ['seated chest press']),
  preset('landmine-press', 'Landmine press · lever-path illustration', 'Presses', 'press', 'Unknown lever transmission', 'unknown', { resistance: 'unknown', torsoAngle: 80, supportAngle: 45, unilateral: true, hipHeight: .9, outlet: [1.5, 0, 0], tension: 120 }, ['angled bar press'], 'A fixed-length bar rotates about the entered pivot. The load application point and bar mass are needed before calculating resistance.'),
  preset('press-machine', 'Converging press machine · illustration', 'Presses', 'press', 'Unknown machine', 'unknown', { resistance: 'unknown', torsoAngle: 90, hipHeight: .55 }, ['chest press machine']),
  preset('pushup', 'Push-up', 'Presses', 'pushup', 'Floor', 'path', { resistance: 'bodyweight', stance: 1.15, depth: .7 }, ['push up'], 'Hands and toes are stationary supports. Their reaction split and joint torques are not solved.'),
  preset('dip', 'Parallel-bar dip', 'Presses', 'dip', 'Parallel bars', 'path', { resistance: 'bodyweight', gripWidth: .55, hipHeight: .5, torsoAngle: 75 }, ['dips']),
  preset('rdl', 'Romanian deadlift', 'Hip extension', 'hinge', 'Barbell', 'path', { resistance: 'gravity', loadMass: 50, depth: .8, hipHeight: .9 }, ['RDL', 'romanian dead lift']),
  preset('deadlift', 'Deadlift · hip and knee chain', 'Hip extension', 'squat', 'Barbell', 'path', { resistance: 'gravity', loadMass: 60, depth: .85, torsoAngle: 55, loadPosition: 'hands' }, ['dead lift']),
  preset('good-morning', 'Good morning', 'Hip extension', 'hinge', 'Barbell', 'path', { resistance: 'gravity', loadMass: 25, loadPosition: 'shoulders', depth: .75 }, ['goodmorning']),
  preset('pull-through', 'Cable pull-through', 'Hip extension', 'hinge', 'Low cable', 'path', { resistance: 'cable', outlet: [-1.3, 0, .15], tension: 120, depth: .7 }, ['pullthrough']),
  preset('hip-thrust', 'Hip thrust', 'Hip extension', 'bridge', 'Bench + pelvis load', 'path', { resistance: 'gravity', loadPosition: 'pelvis', loadMass: 50, hipHeight: .45, supportAngle: 1, stance: .55 }, ['barbell hip thrust']),
  preset('glute-bridge', 'Floor glute bridge', 'Hip extension', 'bridge', 'Floor', 'path', { resistance: 'bodyweight', loadPosition: 'pelvis', hipHeight: .2, supportAngle: 0, stance: .55 }, ['bridge']),
  preset('back-extension', '45° back extension', 'Hip extension', 'back-extension', 'Hip pad', 'path', { resistance: 'gravity', loadMass: 10, loadPosition: 'shoulders', torsoAngle: 45, hipHeight: .8 }, ['hyperextension'], 'Pelvic support is stationary; pad reaction and lumbar segment moments are unavailable.'),
  preset('squat-back', 'Back squat', 'Squats and lunges', 'squat', 'Barbell', 'path', { resistance: 'gravity', loadMass: 40, loadPosition: 'shoulders', torsoAngle: 68, depth: .85 }, ['back squat']),
  preset('squat-front', 'Front squat', 'Squats and lunges', 'squat', 'Barbell', 'path', { resistance: 'gravity', loadMass: 30, loadPosition: 'shoulders', torsoAngle: 83, depth: .85 }, ['front squat']),
  preset('squat-goblet', 'Goblet squat', 'Squats and lunges', 'squat', 'Dumbbell', 'path', { resistance: 'gravity', loadMass: 20, loadPosition: 'hands', torsoAngle: 80, depth: .85, gripWidth: .18 }, ['goblet']),
  preset('squat-smith', 'Smith squat · vertical-load demonstration', 'Squats and lunges', 'squat', 'Declared vertical load', 'path', { resistance: 'gravity', loadMass: 30, loadPosition: 'shoulders', torsoAngle: 90, depth: .8 }, ['smith machine'], 'Fictional frictionless vertical load; counterbalance and actual machine forces require calibration.'),
  preset('squat-hack', 'Hack squat · mechanism illustration', 'Squats and lunges', 'squat', 'Unknown machine', 'unknown', { resistance: 'unknown', torsoAngle: 65, depth: .8, loadPosition: 'shoulders' }, ['hack squat machine']),
  preset('leg-press', 'Linear leg press · defined sled', 'Squats and lunges', 'leg-press', 'Frictionless 45° sled', 'path', { resistance: 'gravity', loadMass: 80, supportAngle: 45, hipHeight: .35, depth: .7 }, ['leg press'], 'A declared frictionless linear sled, not a calibrated commercial machine. Joint moment allocation is unavailable.'),
  preset('split-squat', 'Split squat', 'Squats and lunges', 'lunge', 'Dumbbells', 'path', { resistance: 'gravity', loadMass: 20, stance: .7, depth: .75, unilateral: true }, ['stationary lunge']),
  preset('bulgarian', 'Rear-foot-elevated split squat', 'Squats and lunges', 'lunge', 'Rear-foot support', 'path', { resistance: 'gravity', loadMass: 20, stance: .7, stepHeight: .3, depth: .65, unilateral: true }, ['Bulgarian split squat']),
  preset('lunge', 'Forward lunge · planted phase', 'Squats and lunges', 'lunge', 'Dumbbells', 'path', { resistance: 'gravity', loadMass: 16, stance: .9, depth: .7, unilateral: true }, ['walking lunge'], 'Models the planted lowering/rising phase; stepping impact and the support transition are not calculated.'),
  preset('step-up', 'Step-up', 'Squats and lunges', 'step-up', 'Step', 'path', { resistance: 'gravity', loadMass: 12, stepHeight: .25, unilateral: true, depth: .65 }, ['box step up'], 'The leading foot is the fixed support. The rear foot lifts freely; support transfer and impact are excluded.'),
  preset('calf-standing', 'Standing calf raise', 'Calves', 'calf-standing', 'Floor + shoulder load', 'path', { resistance: 'gravity', loadMass: 20, loadPosition: 'shoulders', depth: .7 }, ['heel raise']),
  preset('calf-unilateral', 'Single-leg calf raise', 'Calves', 'calf-standing', 'Floor + dumbbell', 'path', { resistance: 'gravity', loadMass: 10, unilateral: true, depth: .7 }, ['single leg heel raise']),
  preset('calf-seated', 'Seated calf raise', 'Calves', 'calf-seated', 'Seat + declared knee load', 'path', { resistance: 'gravity', loadMass: 30, loadPosition: 'pelvis', hipHeight: .5, depth: .7 }, ['bent knee calf raise'], 'Declared vertical knee load; commercial lever transmission is not inferred.'),
  preset('calf-legpress', 'Leg-press calf raise · illustration', 'Calves', 'leg-press', 'Unknown leg-press mechanism', 'unknown', { resistance: 'unknown', torsoAngle: 45, hipHeight: .35, supportAngle: 45, depth: .7 }, ['guided calf raise'], 'Requires a defined sled path and transmission before force results are available.'),
  preset('crunch-cable', 'Kneeling cable crunch', 'Trunk', 'crunch', 'High cable', 'path', { resistance: 'cable', hipHeight: .47, outlet: [.15, 0, 2.2], tension: 80, depth: .7 }, ['ab crunch'], 'One rigid trunk segment rotates about the pelvis. Individual spinal levels are not modeled.'),
  preset('crunch-machine', 'Crunch machine · illustration', 'Trunk', 'crunch', 'Unknown machine', 'unknown', { resistance: 'unknown', hipHeight: .55, depth: .7 }, ['ab machine']),
  preset('woodchop', 'Cable woodchop', 'Trunk', 'woodchop', 'Diagonal cable', 'path', { resistance: 'cable', outlet: [.65, -.9, 2.1], tension: 70, depth: .7, gripWidth: .15 }, ['wood chop', 'diagonal chop'], 'Prescribed pelvis/trunk rotation and hand path; no individual spinal torque allocation.'),
  preset('pallof', 'Pallof press', 'Trunk', 'pallof', 'Lateral cable', 'path', { resistance: 'cable', outlet: [0, -1.5, 1.2], tension: 70, gripWidth: .15 }, ['anti rotation press'], 'The torso is prescribed fixed. Zero path work does not imply zero anti-rotation demand; a cable moment about the pelvis is shown separately.'),
  preset('sidebend', 'Dumbbell side bend', 'Trunk', 'sidebend', 'Dumbbell', 'path', { resistance: 'gravity', loadMass: 12, unilateral: true, depth: .7 }, ['lateral trunk flexion'], 'Lumped trunk rotation, not a lumbar anatomy model.'),
  preset('nordic', 'Nordic curl · fixed ankles', 'Knee and trunk chain', 'nordic', 'Knee pad + ankle restraint', 'path', { resistance: 'bodyweight', depth: .65, assistance: 0 }, ['Nordic hamstring curl'], 'Ankle restraint and knee support are represented; individual knee moments require their reaction distribution.'),
  preset('nordic-assisted', 'Assisted Nordic curl', 'Knee and trunk chain', 'nordic', 'Knee pad + upward assistance', 'path', { resistance: 'bodyweight', depth: .65, assistance: 180 }, ['assisted Nordic'], 'Declared upward force at the shoulder, not an inferred elastic-band profile.'),
];

export function getCompoundPreset(config: CompoundConfig) { const found = compoundPresets.find(p => p.id === config.preset); if (!found) throw new Error('Unknown compound exercise.'); return found; }
export function createCompoundConfig(id = 'row-seated'): CompoundConfig {
  const preset = compoundPresets.find(item => item.id === id); if (!preset) throw new Error('Unknown compound exercise.');
  return { preset: id, resistance: 'gravity', loadMass: 20, tension: 100, assistance: 0, outlet: [1.3, 0, 1.2], hipHeight: .9, torsoAngle: 90, gripWidth: .42, stance: .7, stepHeight: 0, supportAngle: 0, depth: .75, unilateral: false, loadPosition: 'hands', bodyGravity: true, shoulderStart: 175, shoulderEnd: 65, elbowStart: 5, elbowEnd: 40, masses: { ...demoMasses }, ...preset.defaults, ...('outlet' in preset.defaults ? { outlet: [...preset.defaults.outlet!] as Vec3 } : {}) };
}

/** Exact two-segment closure; unreachable targets are flagged, never stretched. */
export function solveChain(root: Vec3, target: Vec3, first: number, second: number, planeNormal: Vec3 = [0, 1, 0], branch = 1): { joint: Vec3; valid: boolean } {
  const delta = vsub(target, root), distance = vnorm(delta);
  if (distance < 1e-8 || distance > first + second + 1e-8 || distance < Math.abs(first - second) - 1e-8) return { joint: vadd(root, [0, 0, -first]), valid: false };
  const u = vmul(delta, 1 / distance), along = (first * first - second * second + distance * distance) / (2 * distance);
  const side = vcross(planeNormal, u), sideLength = vnorm(side);
  if (sideLength < 1e-8) return { joint: vadd(root, vmul(u, first)), valid: false };
  return { joint: vadd(root, vadd(vmul(u, along), vmul(side, branch * Math.sqrt(Math.max(0, first * first - along * along)) / sideLength))), valid: true };
}

export function compoundGeometry(config: CompoundConfig, profile: Profile, progress: number): CompoundPose {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError('Movement progress must be finite and between0 and1.');
  const definition = getCompoundPreset(config), movement = definition.movement, p = clamp(progress, 0, 1);
  const upper = profile.upperArm, lower = profile.forearm + profile.hand, thigh = profile.thigh ?? .43, shank = profile.shank ?? .43, foot = profile.foot ?? .24;
  const leg = thigh + shank, arm = upper + lower, pelvis = (profile.pelvisWidth ?? .3) / 2;
  const points: Record<string, Vec3> = {}, segments: CompoundSegment[] = [], supports: CompoundPose['supports'] = [], loads: CompoundLoad[] = [], reasons: string[] = [];
  const fixedTrunk = ['pullover', 'pulldown', 'row', 'press', 'face-pull', 'pallof'].includes(movement);
  let hip: Vec3 = [0, 0, config.hipHeight], t: Vec3 = [-Math.cos(config.torsoAngle * R), 0, Math.sin(config.torsoAngle * R)];
  let shoulder: Vec3;
  let ankles: [Vec3, Vec3] = [[.12, -pelvis, .06], [.12, pelvis, .06]];
  let knees: [Vec3, Vec3] | undefined;
  if (movement === 'hinge' || movement === 'back-extension' || movement === 'crunch') {
    const bend = (movement === 'back-extension' ? 20 : 5) + p * config.depth * 75;
    t = [-Math.sin(bend * R), 0, Math.cos(bend * R)];
  } else if (movement === 'squat') {
    const a = p * config.depth * .8, b = p * config.depth * 1.55;
    const knee: Vec3 = [.08 + shank * Math.sin(a), 0, .06 + shank * Math.cos(a)];
    hip = [knee[0] - thigh * Math.sin(b), 0, knee[2] + thigh * Math.cos(b)];
    knees = [[knee[0], -pelvis, knee[2]], [knee[0], pelvis, knee[2]]];
    ankles = [[.08, -pelvis, .06], [.08, pelvis, .06]];
    const lean = (90 - config.torsoAngle) * p;
    t = [-Math.sin(lean * R), 0, Math.cos(lean * R)];
    if (config.preset === 'squat-smith') { hip = [0, 0, .06 + Math.sqrt(leg * leg - .08 * .08) - p * config.depth * .42]; knees = undefined; t = [0, 0, 1]; }
  } else if (movement === 'lunge') {
    ankles = [[-config.stance / 2, -pelvis, .06 + config.stepHeight], [config.stance / 2, pelvis, .06]];
    hip = [.03, 0, Math.min(config.hipHeight, leg * .88) - p * config.depth * .30 + config.stepHeight * .12];
    t = [-Math.sin(8 * R), 0, Math.cos(8 * R)];
  } else if (movement === 'step-up') {
    hip = [-.1 + .14 * p, 0, config.stepHeight + leg * (.62 + .32 * p)];
    ankles = [[-.5 + .4 * p, -pelvis, .06 + config.stepHeight * p], [0, pelvis, .06 + config.stepHeight]];
    t = [-Math.sin((15 - 10 * p) * R), 0, Math.cos((15 - 10 * p) * R)];
  } else if (movement === 'calf-standing' || movement === 'calf-seated') {
    const lever = foot * .65, theta = Math.asin(Math.min(.9, .045 / lever)) + p * config.depth * .6;
    const fixedToeX = (movement === 'calf-seated' ? thigh : 0) + lever;
    const ankleX = fixedToeX - lever * Math.cos(theta), ankleZ = .015 + lever * Math.sin(theta);
    ankles = [[ankleX, -pelvis, ankleZ], [ankleX, pelvis, ankleZ]];
    if (movement === 'calf-standing') {
      hip = [ankleX, 0, leg + ankleZ];
      knees = [[ankleX, -pelvis, ankleZ + shank], [ankleX, pelvis, ankleZ + shank]];
    } else {
      hip = [0, 0, config.hipHeight];
      supports.push({ point: hip, kind: 'fixed seat' });
    }
  } else if (movement === 'bridge') {
    const shoulderSupport: Vec3 = [-.45, 0, config.supportAngle ? .48 : .16];
    const startingAngle = config.supportAngle ? -25 : -10;
    const theta = (startingAngle * (1 - p)) * R;
    hip = [shoulderSupport[0] + profile.torso * Math.cos(theta), 0, shoulderSupport[2] + profile.torso * Math.sin(theta)];
    t = vmul(vsub(shoulderSupport, hip), 1 / profile.torso);
    ankles = [[config.stance, -pelvis, .06], [config.stance, pelvis, .06]];
    supports.push({ point: shoulderSupport, kind: config.supportAngle ? 'fixed shoulder bench' : 'fixed shoulder floor pad' });
  } else if (movement === 'pullup') {
    hip = [0, 0, config.hipHeight + .32 * p];
    ankles = [[.15, -pelvis, hip[2] - leg * .75], [.15, pelvis, hip[2] - leg * .75]];
  } else if (movement === 'dip') {
    hip = [0, 0, config.hipHeight + .25 * p];
    ankles = [[.3, -pelvis, Math.max(.1, hip[2] - leg * .55)], [.3, pelvis, Math.max(.1, hip[2] - leg * .55)]];
  } else if (movement === 'pushup') {
    const ankle: Vec3 = [-config.stance, 0, .07];
    const tilt = (.10 + .25 * p) * config.depth;
    hip = [ankle[0] + leg * Math.cos(tilt), 0, ankle[2] + leg * Math.sin(tilt)];
    t = [Math.cos(tilt), 0, Math.sin(tilt)];
    ankles = [[ankle[0], -pelvis, ankle[2]], [ankle[0], pelvis, ankle[2]]];
  } else if (movement === 'nordic') {
    const theta = p * config.depth * 75 * R;
    const knee: Vec3 = [0, 0, .09];
    hip = [thigh * Math.sin(theta), 0, knee[2] + thigh * Math.cos(theta)];
    t = [Math.sin(theta), 0, Math.cos(theta)];
    knees = [[0, -pelvis, .09], [0, pelvis, .09]];
    ankles = [[-shank, -pelvis, .09], [-shank, pelvis, .09]];
    supports.push({ point: knees[0], kind: 'fixed knee pad' }, { point: knees[1], kind: 'fixed knee pad' });
  } else if (movement === 'sidebend') {
    const tilt = (-15 + 30 * p) * config.depth * R;
    t = [0, Math.sin(tilt), Math.cos(tilt)];
  } else if (movement === 'woodchop') {
    const angle = (-35 + 70 * p) * config.depth * R;
    t = [.12 * Math.sin(angle), .12 * Math.cos(angle), Math.sqrt(1 - .12 ** 2)];
  } else if (movement === 'leg-press') {
    hip = [0, 0, config.hipHeight]; t = [-Math.cos(45 * R), 0, Math.sin(45 * R)];
    const reach = leg * (config.preset === 'calf-legpress' ? .90 : .50 + .42 * p), a = config.supportAngle * R;
    ankles = [[reach * Math.cos(a), -pelvis, hip[2] + reach * Math.sin(a)], [reach * Math.cos(a), pelvis, hip[2] + reach * Math.sin(a)]];
    supports.push({ point: hip, kind: 'fixed seat' });
  }
  if (movement === 'calf-standing' && config.unilateral) { ankles[0] = vadd(ankles[0], [-.12, 0, .2]); if (knees) knees[0] = solveChain(vadd(hip, [0, -pelvis, 0]), ankles[0], thigh, shank, [0, 1, 0], -1).joint; }
  shoulder = vadd(hip, vmul(t, profile.torso)); points.hip = hip; points.shoulder = shoulder;
  points.head = vadd(shoulder, vmul(t, (profile.headNeck ?? .24) * .65));
  const lateral: Vec3 = movement === 'sidebend' ? [0, t[2], -t[1]] : [0, 1, 0];
  segments.push({ id: 'trunk', from: hip, to: shoulder, massKey: 'trunk', width: .17 });
  segments.push({ id: 'head', from: shoulder, to: points.head, massKey: 'head', width: .15 });
  const normal: Vec3 = [t[2], 0, -t[0]];
  const activeSides = config.unilateral ? [1] : [-1, 1];
  for (const side of [-1, 1]) {
    const index = side === -1 ? 0 : 1, suffix = side === -1 ? 'L' : 'R';
    const S = vadd(shoulder, vmul(lateral, side * profile.shoulderWidth / 2));
    let H: Vec3;
    const gripOffset = side * config.gripWidth / 2;
    if (movement === 'pullover') { const q = (config.shoulderStart + (config.shoulderEnd - config.shoulderStart) * p) * R, e = (config.elbowStart + (config.elbowEnd - config.elbowStart) * p) * R; const dir = (a: number) => vadd(vmul(t, -Math.cos(a)), vmul(normal, Math.sin(a))); H = vadd(S, vadd(vmul(dir(q), upper), vmul(dir(q + e), lower))); }
    else if (movement === 'pulldown') H = vadd(shoulder, [arm * (.12 + .20 * p), gripOffset, arm * (.90 - 1.08 * p)]);
    else if (movement === 'row') {
      const high = Math.sin(config.supportAngle * R) * .35;
      const rowNormal = config.torsoAngle < 60 ? vmul(normal, -1) : normal;
      H = vadd(shoulder, vadd(vmul(rowNormal, arm * (.88 - .60 * p)), vadd(vmul(t, -.14 + high * (1 - p)), [0, gripOffset, 0])));
    } else if (movement === 'press') {
      const direction = vadd(vmul(normal, Math.cos(config.supportAngle * R)), vmul(t, Math.sin(config.supportAngle * R)));
      H = vadd(shoulder, vadd(vmul(direction, arm * (.32 + .57 * p)), [0, gripOffset, 0]));
    } else if (movement === 'pullup') H = [0.15, gripOffset, config.hipHeight + profile.torso + arm * .91];
    else if (movement === 'dip') H = [.10, gripOffset, config.hipHeight + .53];
    else if (movement === 'pushup') H = [.18, gripOffset, .075];
    else if (movement === 'face-pull') H = vadd(shoulder, [arm * (.88 - .62 * p), side * (.15 + .25 * p), .10 + .08 * p]);
    else if (movement === 'pallof') H = vadd(shoulder, [arm * (.3 + .58 * p), gripOffset, -.18]);
    else if (movement === 'woodchop') { const a = (-60 + 120 * p) * config.depth * R; H = vadd(shoulder, [arm * .7 * Math.cos(a), arm * .7 * Math.sin(a) + gripOffset, .20 - .48 * p]); }
    else if (movement === 'crunch' || movement === 'nordic' || movement === 'bridge') H = vadd(shoulder, vadd(vmul(normal, arm * .3), vadd(vmul(t, -.25), [0, gripOffset, 0])));
    else if (config.loadPosition === 'shoulders') H = vadd(shoulder, vadd(vmul(normal, .18), [0, gripOffset, -.04]));
    else if (movement === 'squat' && config.preset === 'squat-goblet') H = vadd(shoulder, [.25, gripOffset, -.25]);
    else H = vadd(S, [0, 0, -arm * .96]);
    if (config.preset === 'row-tbar' || config.preset === 'landmine-press') {
      const rowNormal = config.torsoAngle < 60 ? vmul(normal, -1) : normal;
      const pressDirection = vadd(vmul(normal, Math.cos(config.supportAngle * R)), vmul(t, Math.sin(config.supportAngle * R)));
      const start = config.preset === 'row-tbar'
        ? vadd(shoulder, vadd(vmul(rowNormal, arm * .88), vadd(vmul(t, -.14), [0, gripOffset, 0])))
        : vadd(shoulder, vadd(vmul(pressDirection, arm * .32), [0, gripOffset, 0]));
      const delta = vsub(start, config.outlet), angle = p * (config.preset === 'row-tbar' ? 10 : 10) * R;
      H = vadd(config.outlet, [Math.cos(angle) * delta[0] + Math.sin(angle) * delta[2], delta[1], -Math.sin(angle) * delta[0] + Math.cos(angle) * delta[2]]);
    }
    if (!activeSides.includes(side) && !['pushup', 'dip', 'pullup'].includes(movement)) H = vadd(S, vmul(t, -arm * .96));
    const armPlane = vnorm(vcross(vsub(H, S), normal)) > 1e-8 ? vcross(vsub(H, S), normal) : [0, 1, 0] as Vec3;
    const solved = solveChain(S, H, upper, lower, movement === 'woodchop' || movement === 'face-pull' ? armPlane : [0, 1, 0], movement === 'pushup' ? 1 : -1);
    if (movement === 'pullover') { const q = (config.shoulderStart + (config.shoulderEnd - config.shoulderStart) * p) * R; solved.joint = vadd(S, vmul(vadd(vmul(t, -Math.cos(q)), vmul(normal, Math.sin(q))), upper)); solved.valid = true; }
    if (!solved.valid) reasons.push(`${suffix} hand target is outside the arm's reachable workspace.`);
    points[`shoulder${suffix}`] = S; points[`elbow${suffix}`] = solved.joint; points[`hand${suffix}`] = H;
    segments.push({ id: `upperArm${suffix}`, from: S, to: solved.joint, massKey: 'upperArm', width: .065 }, { id: `forearm${suffix}`, from: solved.joint, to: H, massKey: 'forearm', width: .05 });
    const hipSide = vadd(hip, [0, side * pelvis, 0]), ankle = ankles[index];
    const knee = knees?.[index] ?? solveChain(hipSide, ankle, thigh, shank, [0, 1, 0], -1).joint;
    if (!knees && !solveChain(hipSide, ankle, thigh, shank, [0, 1, 0], -1).valid) reasons.push(`${suffix} leg cannot connect pelvis and foot with the entered lengths.`);
    points[`hip${suffix}`] = hipSide; points[`knee${suffix}`] = knee; points[`ankle${suffix}`] = ankle;
    const toe: Vec3 = config.preset === 'calf-legpress' ? vadd(ankle, [foot * .65 * Math.cos((-25 + 35 * p) * R), 0, foot * .65 * Math.sin((-25 + 35 * p) * R)]) : (movement === 'calf-standing' || movement === 'calf-seated') && !(movement === 'calf-standing' && config.unilateral && side === -1) ? [(movement === 'calf-seated' ? thigh : 0) + foot * .65, ankle[1], .015] : [ankle[0] + foot * .65, ankle[1], ankle[2] - .04];
    points[`toe${suffix}`] = toe;
    segments.push({ id: `thigh${suffix}`, from: hipSide, to: knee, massKey: 'thigh', width: .095 }, { id: `shank${suffix}`, from: knee, to: ankle, massKey: 'shank', width: .065 }, { id: `foot${suffix}`, from: ankle, to: toe, massKey: 'foot', width: .05 });
    if (['pullup', 'dip', 'pushup'].includes(movement)) supports.push({ point: H, kind: 'fixed hand support' });
    if (!['pullup', 'dip', 'leg-press'].includes(movement) && !(movement === 'step-up' && side === -1) && !(movement === 'calf-standing' && config.unilateral && side === -1)) supports.push({ point: movement.startsWith('calf') ? toe : ankle, kind: movement === 'nordic' ? 'fixed ankle restraint' : movement === 'step-up' || config.stepHeight > 0 && side === -1 ? 'elevated foot support' : 'ground foot support' });
  }
  if (fixedTrunk || movement === 'back-extension') {
    if (definition.equipment.toLowerCase().includes('bench')) supports.push({ point: vadd(hip, vmul(normal, -.09)), end: vadd(shoulder, vmul(normal, -.09)), kind: 'fixed torso bench' });
    else supports.push({ point: hip, kind: config.hipHeight < .7 ? 'fixed seat / prescribed torso' : 'prescribed fixed trunk/pelvis' });
  }
  if (Object.values(points).some(point => point[2] < -.015)) reasons.push('A represented body landmark crosses the floor.');
  const loadHands = activeSides.map(side => points[side === -1 ? 'handL' : 'handR']);
  const averageHands = loadHands.length === 2 ? vmul(vadd(loadHands[0], loadHands[1]), .5) : loadHands[0];
  const loadPoint = config.loadPosition === 'shoulders' ? vadd(shoulder, [.08, 0, .04]) : config.loadPosition === 'pelvis' ? hip : averageHands;
  if (config.preset === 'row-tbar' || config.preset === 'landmine-press') { points.leverPivot = [...config.outlet]; points.leverHandle = averageHands; supports.push({ point: points.leverPivot, kind: 'fixed lever pivot' }); }
  points.load = movement === 'leg-press' ? vmul(vadd(ankles[0], ankles[1]), .5) : movement === 'calf-seated' ? vmul(vadd(points.kneeL, points.kneeR), .5) : loadPoint;
  if (config.resistance === 'cable') loadHands.forEach((point, i) => { const outlet: Vec3 = [config.outlet[0], config.outlet[1] + (config.unilateral ? 0 : (i === 0 ? -1 : 1) * config.gripWidth / 2), config.outlet[2]]; const delta = vsub(outlet, point), length = vnorm(delta); points[`outlet${i}`] = outlet; if (length < 1e-8) reasons.push('Cable attachment coincides with the outlet.'); loads.push({ id: `cable${i}`, point, force: length > 1e-8 ? vmul(delta, config.tension / length) : [0, 0, 0], kind: 'cable' }); });
  if (config.resistance === 'gravity') {
    if (definition.mechanics === 'open-arm') loadHands.forEach((point, i) => loads.push({ id: `external${i}`, point, force: [0, 0, -config.loadMass * G / loadHands.length], kind: 'gravity' }));
    else loads.push({ id: 'external', point: points.load, force: [0, 0, -config.loadMass * G], kind: 'gravity' });
  }
  if (config.bodyGravity) segments.forEach(segment => loads.push({ id: `body-${segment.id}`, point: vmul(vadd(segment.from, segment.to), .5), force: [0, 0, -config.masses[segment.massKey] * G], kind: 'gravity' }));
  if (config.assistance > 0) loads.push({ id: 'assistance', point: movement === 'nordic' ? shoulder : hip, force: [0, 0, config.assistance], kind: 'assistance' });
  return { points, segments, supports, loads, valid: reasons.length === 0, reasons: [...new Set(reasons)], action: `${definition.name}: move from the 0% pose to the 100% pose` };
}

export function evaluateCompound(config: CompoundConfig, profile: Profile, progress: number): CompoundResult {
  const definition = getCompoundPreset(config), pose = compoundGeometry(config, profile, progress);
  const unavailable = definition.mechanics === 'unknown' || config.resistance === 'unknown';
  const supportStatus = 'Stationary support locations checked along the path; reactions, balance and collision clearance are not solved.';
  if (!pose.valid) return { pose, pathResistance: null, jointMoments: null, status: 'invalid', explanation: pose.reasons.join(' '), supportStatus };
  if (unavailable) return { pose, pathResistance: null, jointMoments: null, status: 'geometry', explanation: 'Mechanism or force profile unknown. Geometry is shown without invented resistance.', supportStatus };
  const eps = 1e-4, lo = Math.max(0, progress - eps), hi = Math.min(1, progress + eps);
  const before = compoundGeometry(config, profile, lo), after = compoundGeometry(config, profile, hi);
  if (!before.valid || !after.valid) return { pose, pathResistance: null, jointMoments: null, status: 'geometry', explanation: 'The movement reaches a kinematic boundary: a neighboring pose cannot preserve the entered segment lengths. A path derivative is unavailable here.', supportStatus };
  const movingSupport = pose.supports.some((support, index) => before.supports[index] && after.supports[index] && vnorm(vsub(after.supports[index].point, before.supports[index].point)) / (hi - lo) > 1e-5);
  if (movingSupport) return { pose, pathResistance: null, jointMoments: null, status: 'geometry', explanation: 'A prescribed support moves along this path. Its unknown reaction can do work; the total external path contribution is unavailable.', supportStatus: 'Moving support requires a reaction/actuation model.' };
  let work = 0;
  pose.loads.forEach(load => { const a = before.loads.find(item => item.id === load.id), b = after.loads.find(item => item.id === load.id); if (a && b) work += vdot(load.force, vmul(vsub(b.point, a.point), 1 / (hi - lo))); });
  const pathResistance = -work;
  let jointMoments: CompoundResult['jointMoments'] = null;
  if (definition.mechanics === 'open-arm') {
    jointMoments = [];
    for (const side of config.unilateral ? ['R'] : ['L', 'R']) {
      const shoulder = pose.points[`shoulder${side}`], elbow = pose.points[`elbow${side}`], hand = pose.points[`hand${side}`];
      const loadIndex = config.unilateral || side === 'L' ? 0 : 1;
      const external = pose.loads.find(load => load.id === `cable${loadIndex}` || load.id === `external${loadIndex}`);
      const distal = pose.loads.find(load => load.id === `body-forearm${side}`), proximal = pose.loads.find(load => load.id === `body-upperArm${side}`);
      const axis: Vec3 = [0, 1, 0];
      const moment = (origin: Vec3, list: (CompoundLoad | undefined)[]) => list.reduce((sum, load) => sum + (load ? vdot(axis, vcross(vsub(load.point, origin), load.force)) : 0), 0);
      void hand;
      jointMoments.push({ label: `${side} shoulder · +Y external`, value: moment(shoulder, [external, distal, proximal]), axis }, { label: `${side} elbow · +Y external`, value: moment(elbow, [external, distal]), axis });
    }
  }
  if (definition.movement === 'pallof') jointMoments = [{ label: 'Cable moment about pelvis · +Z (not spinal joint torque)', value: pose.loads.filter(load => load.kind === 'cable').reduce((sum, load) => sum + vcross(vsub(load.point, pose.points.hip), load.force)[2], 0), axis: [0, 0, 1] }];
  return { pose, pathResistance, jointMoments, status: Math.abs(pathResistance) < .1 ? 'near-zero' : pathResistance > 0 ? 'resists' : 'assists', explanation: definition.mechanics === 'open-arm' ? 'Arm moments include declared hand forces and arm-segment weights about fixed shoulder/elbow axes. Trunk support reactions and muscle forces are not calculated.' : 'The external contribution along the prescribed path is calculated. Individual joint moments are unavailable because support reactions and load sharing are not solved.', supportStatus };
}
export function compoundCurve(config: CompoundConfig, profile: Profile) { return Array.from({ length: 41 }, (_, i) => { const progress = i / 40, result = evaluateCompound(config, profile, progress); return { progress, value: result.pathResistance, status: result.status }; }); }
