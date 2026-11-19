/** Independent machine-shaft models. SI quantities; input coordinate in degrees. */
import { validateMachineFormula, evaluateMachineFormula, formulaIntervalSafe, type MachineFormula } from './machineFormula';
import { validateMachineCalibration, type MachineCalibration } from './machineCalibration';
export type { MachineFormula, FormulaParameter } from './machineFormula';
export type { MachineCalibration } from './machineCalibration';
export type MachineMechanism = 'lever' | 'cable' | 'cam' | 'linkage' | 'curve' | 'formula';
export type MachineBranch = 'lifting' | 'lowering';
export type MachinePoint = { angle: number; value: number; uncertainty: number };
export type MachineProfile = {
  version: 1; id: string; name: string; mechanism: MachineMechanism;
  domain: [number, number]; referenceAction: 1 | -1; coordinate: string;
  provenance: { kind: 'theoretical' | 'measured' | 'supplied'; brand: string; model: string; source: string; notes: string };
  lever: { mass: number; radius: number; phase: number };
  cable: { tension: number; radius: number; ratio: number; sign: 1 | -1 };
  cam: { tension: number; sign: 1 | -1; points: MachinePoint[] };
  linkage: { ground: number; input: number; coupler: number; output: number; mass: number; loadRadius: number; phase: number; assembly: 1 | -1 };
  curve: { quantity: 'moment' | 'force'; lifting: MachinePoint[]; lowering: MachinePoint[]; forceMomentArm: number | null };
  formula?: MachineFormula;
  calibration?: MachineCalibration;
  joint: { mode: 'none' | 'aligned' | 'ratio'; ratio: number; offset: number; assumption: string };
};
export type Point2 = [number, number];
export type MachineResult = {
  status: 'valid' | 'outside-domain' | 'invalid' | 'singular' | 'unknown';
  moment: number | null; force: number | null; uncertainty: number | null;
  jointMoment: number | null; jointAngle: number | null;
  points: { pivot: Point2; input?: Point2; coupler?: Point2; outputPivot?: Point2; load?: Point2 };
  reason: string | null;
};
export const MACHINE_G = 9.81;
const RAD = Math.PI / 180;
const MAX_POINTS = 500;
const finite = (v: unknown, label: string, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`${label} must be a finite number from ${min} to ${max}.`);
  return v;
};
function obj(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 2000, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
  return value;
}
function member<T extends string | number>(value: unknown, label: string, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error(`${label} is unsupported.`);
  return value as T;
}
function points(value: unknown, label: string, minValue: number, maxValue: number): MachinePoint[] {
  if (!Array.isArray(value) || value.length > MAX_POINTS || value.length === 1) throw new Error(`${label} needs zero or 2–${MAX_POINTS} points.`);
  const result = value.map(item => {
    const point = obj(item, label);
    return { angle: finite(point.angle, `${label} angle`, -180, 360), value: finite(point.value, `${label} value`, minValue, maxValue), uncertainty: finite(point.uncertainty, `${label} uncertainty`, 0, maxValue) };
  });
  if (result.some((point, i) => i > 0 && point.angle <= result[i - 1].angle)) throw new Error(`${label} angles must be unique and strictly increasing.`);
  return result;
}
export function createMachineProfile(mechanism: MachineMechanism = 'lever'): MachineProfile {
  return {
    version: 1, id: `machine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: mechanism === 'curve' ? 'Untitled supplied profile' : `Theoretical ${mechanism} example`, mechanism,
    domain: [10, 100], referenceAction: 1, coordinate: 'Input shaft angle from horizontal',
    provenance: { kind: mechanism === 'curve' ? 'supplied' : 'theoretical', brand: '', model: '', source: '', notes: 'Editable example parameters; not a calibrated commercial machine.' },
    lever: { mass: 20, radius: 0.4, phase: 0 }, cable: { tension: 150, radius: 0.12, ratio: 1, sign: 1 },
    cam: { tension: 150, sign: 1, points: [{ angle: 10, value: 0.08, uncertainty: 0 }, { angle: 55, value: 0.16, uncertainty: 0 }, { angle: 100, value: 0.10, uncertainty: 0 }] },
    linkage: { ground: 0.6, input: 0.25, coupler: 0.6, output: 0.4, mass: 15, loadRadius: 0.3, phase: 0, assembly: 1 },
    curve: { quantity: 'moment', lifting: [], lowering: [], forceMomentArm: null },
    ...(mechanism==='formula'?{formula:{expression:'mass * gravity * radius * cos(q)',angleUnit:'radians' as const,quantity:'moment' as const,forceMomentArm:null,parameters:[{name:'mass',value:20,unit:'kg',description:'Illustrative plate mass; not a measured machine load.'},{name:'gravity',value:9.81,unit:'m/s²',description:'Rounded gravitational acceleration for the theoretical reference.'},{name:'radius',value:.4,unit:'m',description:'Illustrative pivot to plate-center distance.'}]}}:{}),
    joint: { mode: 'none', ratio: 1, offset: 0, assumption: '' },
  };
}
export function validateMachineProfile(input: unknown): MachineProfile {
  const s = obj(input, 'Machine profile');
  if (s.version !== 1) throw new Error('Unsupported machine profile version.');
  const mechanism = member(s.mechanism, 'Machine mechanism', ['lever', 'cable', 'cam', 'linkage', 'curve', 'formula'] as const);
  if (!Array.isArray(s.domain) || s.domain.length !== 2) throw new Error('Machine domain needs two angles.');
  const domain: [number, number] = [finite(s.domain[0], 'Domain start', -180, 360), finite(s.domain[1], 'Domain end', -180, 360)];
  if (domain[0] >= domain[1]) throw new Error('Domain start must be below its end.');
  const p = obj(s.provenance, 'Provenance'), l = obj(s.lever, 'Lever'), c = obj(s.cable, 'Cable'), m = obj(s.cam, 'Cam'), k = obj(s.linkage, 'Linkage'), v = obj(s.curve, 'Curve'), j = obj(s.joint, 'Joint mapping');
  const quantity = member(v.quantity, 'Curve quantity', ['moment', 'force'] as const);
  const result: MachineProfile = {
    version: 1, id: text(s.id, 'Profile ID', 120, 1), name: text(s.name, 'Profile name', 120), mechanism, domain,
    referenceAction: member(s.referenceAction, 'Reference action', [-1, 1]), coordinate: text(s.coordinate, 'Coordinate definition', 300, 1),
    provenance: { kind: member(p.kind, 'Provenance kind', ['theoretical', 'measured', 'supplied']), brand: text(p.brand, 'Brand', 120), model: text(p.model, 'Machine model', 120), source: text(p.source, 'Source', 2000), notes: text(p.notes, 'Notes', 5000) },
    lever: { mass: finite(l.mass, 'Plate mass', 0, 1000), radius: finite(l.radius, 'Plate radius', 0.001, 5), phase: finite(l.phase, 'Plate phase', -180, 180) },
    cable: { tension: finite(c.tension, 'Cable tension', 0, 10000), radius: finite(c.radius, 'Input drum radius', 0.001, 2), ratio: finite(c.ratio, 'Cable travel ratio', 0.001, 20), sign: member(c.sign, 'Winding sign', [-1, 1]) },
    cam: { tension: finite(m.tension, 'Cam tension', 0, 10000), sign: member(m.sign, 'Cam winding sign', [-1, 1]), points: points(m.points, 'Effective cam moment-arm points', 0.001, 2) },
    linkage: { ground: finite(k.ground, 'Fixed pivot separation', 0.01, 5), input: finite(k.input, 'Input link', 0.01, 5), coupler: finite(k.coupler, 'Coupler link', 0.01, 5), output: finite(k.output, 'Output link', 0.01, 5), mass: finite(k.mass, 'Linkage plate mass', 0, 1000), loadRadius: finite(k.loadRadius, 'Output load radius', 0.001, 5), phase: finite(k.phase, 'Output load phase', -180, 180), assembly: member(k.assembly, 'Assembly branch', [-1, 1]) },
    curve: { quantity, lifting: points(v.lifting, 'Lifting curve', quantity === 'force' ? 0 : -10000, 10000), lowering: points(v.lowering, 'Lowering curve', quantity === 'force' ? 0 : -10000, 10000), forceMomentArm: v.forceMomentArm === null ? null : finite(v.forceMomentArm, 'Signed force moment arm', -5, 5) },
    joint: { mode: member(j.mode, 'Joint conversion', ['none', 'aligned', 'ratio']), ratio: finite(j.ratio, 'Machine-to-joint angular ratio', 0.01, 20), offset: finite(j.offset, 'Machine angle offset', -360, 360), assumption: text(j.assumption, 'Joint conversion assumption', 2000) },
  };
  if(s.formula!==undefined)result.formula=validateMachineFormula(s.formula);
  if(mechanism==='formula'&&!result.formula)throw new Error('A formula mechanism requires an explicit expression and parameter definition.');
  if(s.calibration!==undefined){
    result.calibration=validateMachineCalibration(s.calibration);
    if(!result.calibration.curveModified&&mechanism==='curve') {
      const groups=result.calibration.groups;
      for(const branch of ['lifting','lowering'] as const) {
        const expected=groups[branch].map(g=>({angle:g.angle,value:g.mean,uncertainty:g.displaySpread}));
        if(JSON.stringify(expected)!==JSON.stringify(result.curve[branch]))throw new Error('Curve values differ from retained raw calibration. Mark the curve as independently modified or reapply the raw import.');
      }
      if(result.curve.quantity!==result.calibration.options.quantity)throw new Error('Curve quantity differs from the retained raw calibration.');
    }
  }
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(result.id)) throw new Error('Profile ID must use letters, digits, underscores or hyphens.');
  if (result.cam.points.some(point => point.uncertainty > point.value)) throw new Error('Cam moment-arm uncertainty must not extend below zero.');
  if (mechanism !== 'curve' && !(mechanism==='formula'&&result.provenance.kind==='supplied') && result.provenance.kind !== 'theoretical') throw new Error('Mechanism calculations are theoretical estimates; measured/supplied status requires an actual data curve.');
  if(mechanism==='formula'&&result.provenance.kind==='supplied'&&!result.provenance.source.trim())throw new Error('A supplied formula requires its documented source.');
  if (mechanism === 'curve' && (result.curve.lifting.length || result.curve.lowering.length)) {
    if (result.provenance.kind !== 'theoretical' && !result.provenance.source.trim()) throw new Error('Measured or supplied data requires a source or measurement protocol.');
    if (result.provenance.kind === 'measured' && (!result.provenance.brand.trim() || !result.provenance.model.trim())) throw new Error('Measured data requires the machine brand and model.');
  }
  if (result.joint.mode !== 'none' && !result.joint.assumption.trim()) throw new Error('A joint conversion requires an explicit alignment or transmission assumption.');
  return result;
}
export function parseMachinePoints(source: string): MachinePoint[] {
  if (new TextEncoder().encode(source).byteLength > 100000) throw new Error('Curve data must be under 100 kB.');
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const result = lines.filter((line, i) => !(i === 0 && /^angle\b/i.test(line))).map((line, i) => {
    const columns = line.split(/[,;\t ]+/);
    if (columns.length < 2 || columns.length > 3 || columns.some(cell => cell === '' || !Number.isFinite(Number(cell)))) throw new Error(`Curve row ${i + 1}: enter angle, value, and optional absolute uncertainty.`);
    return { angle: Number(columns[0]), value: Number(columns[1]), uncertainty: Number(columns[2] ?? 0) };
  });
  return points(result, 'Curve', -10000, 10000);
}
export function interpolateMachine(points: MachinePoint[], angle: number): { value: number; uncertainty: number } | null {
  if (!Number.isFinite(angle) || points.length < 2 || angle < points[0].angle || angle > points[points.length - 1].angle) return null;
  const rightIndex = Math.max(1, points.findIndex(point => point.angle >= angle));
  const a = points[rightIndex - 1], b = points[rightIndex];
  const t = (angle - a.angle) / (b.angle - a.angle);
  return { value: a.value + t * (b.value - a.value), uncertainty: a.uncertainty + t * (b.uncertainty - a.uncertainty) };
}
const blank = (status: MachineResult['status'], reason: string): MachineResult => ({ status, reason, moment: null, force: null, uncertainty: null, jointMoment: null, jointAngle: null, points: { pivot: [0, 0] } });
/** Circle closure and implicit differentiation; no force inferred through a singular transmission. */
export function linkagePose(profile: MachineProfile, angle: number): { points: MachineResult['points']; outputAngle: number; derivative: number } | { status: 'invalid' | 'singular'; reason: string } {
  const k = profile.linkage, q = angle * RAD;
  const input: Point2 = [k.input * Math.cos(q), k.input * Math.sin(q)], fixed: Point2 = [k.ground, 0];
  const dx = input[0] - fixed[0], dy = input[1], distance = Math.hypot(dx, dy);
  if (distance < 1e-9 || distance > k.output + k.coupler + 1e-9 || distance < Math.abs(k.output - k.coupler) - 1e-9) return { status: 'invalid', reason: 'The specified four-bar links cannot close at this angle.' };
  const along = (k.output ** 2 - k.coupler ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, k.output ** 2 - along ** 2));
  const ux = dx / distance, uy = dy / distance;
  const C: Point2 = [fixed[0] + along * ux - k.assembly * height * uy, along * uy + k.assembly * height * ux];
  const phi = Math.atan2(C[1], C[0] - k.ground), ex = C[0] - input[0], ey = C[1] - input[1];
  const denominator = ex * (-k.output * Math.sin(phi)) + ey * k.output * Math.cos(phi);
  if (Math.abs(denominator) < 1e-9 * Math.max(1, k.output * k.coupler)) return { status: 'singular', reason: 'This linkage is at a dead-center transmission; a finite input moment is not inferred.' };
  const derivative = (ex * (-k.input * Math.sin(q)) + ey * k.input * Math.cos(q)) / denominator;
  const load: Point2 = [fixed[0] + k.loadRadius * Math.cos(phi + k.phase * RAD), k.loadRadius * Math.sin(phi + k.phase * RAD)];
  return { points: { pivot: [0, 0], input, coupler: C, outputPivot: fixed, load }, outputAngle: phi, derivative };
}
function compute(profile: MachineProfile, angle: number, branch: MachineBranch): MachineResult {
  if (!Number.isFinite(angle)) return blank('invalid', 'Enter a finite machine angle.');
  if (angle < profile.domain[0] || angle > profile.domain[1]) return blank('outside-domain', 'Outside the specified machine-angle domain; no extrapolation.');
  let moment: number | null = null, force: number | null = null, uncertainty: number | null = null;
  let geometry: MachineResult['points'] = { pivot: [0, 0] };
  const q = angle * RAD, direction = profile.referenceAction;
  switch (profile.mechanism) {
    case 'lever': {
      const a = q + profile.lever.phase * RAD;
      force = profile.lever.mass * MACHINE_G;
      moment = direction * force * profile.lever.radius * Math.cos(a);
      geometry = { pivot: [0, 0], load: [profile.lever.radius * Math.cos(a), profile.lever.radius * Math.sin(a)] };
      break;
    }
    case 'cable':
      force = profile.cable.tension;
      moment = direction * profile.cable.sign * force * profile.cable.radius * profile.cable.ratio;
      geometry = { pivot: [0, 0], load: [profile.cable.radius, 0], input: [profile.cable.radius * Math.cos(q), profile.cable.radius * Math.sin(q)] };
      break;
    case 'cam': {
      if (!profile.cam.points.length) return blank('unknown', 'Supply an effective cable moment-arm curve to calculate this cam.');
      const radius = interpolateMachine(profile.cam.points, angle);
      if (!radius) return blank('outside-domain', 'No effective cam moment-arm data at this angle; no extrapolation.');
      force = profile.cam.tension; moment = direction * profile.cam.sign * force * radius.value;
      uncertainty = force * radius.uncertainty;
      geometry = { pivot: [0, 0], load: [radius.value, 0], input: [radius.value * Math.cos(q), radius.value * Math.sin(q)] };
      break;
    }
    case 'linkage': {
      const pose = linkagePose(profile, angle);
      if ('status' in pose) return blank(pose.status, pose.reason);
      force = profile.linkage.mass * MACHINE_G;
      moment = direction * force * profile.linkage.loadRadius * Math.cos(pose.outputAngle + profile.linkage.phase * RAD) * pose.derivative;
      geometry = pose.points;
      break;
    }
    case 'formula': {
      const formula=profile.formula!;
      const value=evaluateMachineFormula(formula,angle);
      if(value===null)return blank('invalid','The formula is undefined, nonfinite, negative for a force magnitude, or outside the bounded numerical range at this angle.');
      if(formula.quantity==='moment')moment=direction*value;
      else {force=value;if(formula.forceMomentArm!==null)moment=direction*force*formula.forceMomentArm;}
      break;
    }
    case 'curve': {
      const rows = profile.curve[branch];
      if (!rows.length) return blank('unknown', `No ${branch} data supplied. A missing branch is not assumed to equal the other direction.`);
      const data = interpolateMachine(rows, angle);
      if (!data) return blank('outside-domain', `Outside the supplied ${branch} data interval; no extrapolation.`);
      if (profile.curve.quantity === 'moment') { moment = data.value; uncertainty = data.uncertainty; }
      else { force = data.value; uncertainty = data.uncertainty; if (profile.curve.forceMomentArm !== null) { moment = force * profile.curve.forceMomentArm; uncertainty *= Math.abs(profile.curve.forceMomentArm); } }
      break;
    }
  }
  const ratio = profile.joint.mode === 'aligned' ? 1 : profile.joint.ratio;
  const convert = profile.joint.mode !== 'none' && moment !== null;
  return { status: 'valid', reason: null, moment, force, uncertainty, jointMoment: convert ? moment! * ratio : null, jointAngle: convert ? (angle - profile.joint.offset) / ratio : null, points: geometry };
}
export function evaluateMachine(profile: MachineProfile, angle: number, branch: MachineBranch = 'lifting'): MachineResult {
  try { return compute(validateMachineProfile(profile), angle, branch); }
  catch (error) { return blank('invalid', error instanceof Error ? error.message : 'Invalid machine data.'); }
}
/** Formula samples only connect when the entire intervening interval is certified defined. */
export function sampleMachine(profile: MachineProfile, branch: MachineBranch = 'lifting', count = 121): Array<MachineResult & { angle: number; connectFromPrevious?:boolean }> {
  if (!Number.isInteger(count) || count < 2 || count > 2001) throw new Error('Sample count must be 2–2001.');
  try {
    const valid = validateMachineProfile(profile);
    return Array.from({ length: count }, (_, i) => {
      const step=(valid.domain[1]-valid.domain[0])/(count-1),angle=valid.domain[0]+i*step;
      return {angle,...compute(valid,angle,branch),...(valid.mechanism==='formula'?{connectFromPrevious:i===0||formulaIntervalSafe(valid.formula!,angle-step,angle)}:{})};
    });
  } catch { return []; }
}
export function machineOutputUnit(profile: MachineProfile): 'N' | 'N·m' {
  return (profile.mechanism === 'curve' && profile.curve.quantity === 'force' && profile.curve.forceMomentArm === null)||(profile.mechanism==='formula'&&profile.formula?.quantity==='force'&&profile.formula.forceMomentArm===null) ? 'N' : 'N·m';
}
