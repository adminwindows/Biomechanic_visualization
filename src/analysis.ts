import { compatible, contactAngles, constraintAngles, evaluate, getDefinition, getTension, MODEL_VERSION, RAD, type Evaluation, type Profile, type Setup, type Status } from './engine';
import type { LabState } from './state';
import { outletHeight, withOutletHeight } from './equipmentGeometry';

export type AnalysisSample = {
  angle: number;
  moment: number | null;
  status: Status;
  cableMoment?: number | null;
  gravityMoment?: number | null;
};
export type RegionSummary = {
  requested: [number, number];
  region: [number, number] | null;
  coverage: number;
  complete: boolean;
  minimum: number | null;
  maximum: number | null;
  mean: number | null;
  resistingFraction: number | null;
  externalWork: number | null;
  cableWork: number | null;
  gravityWork: number | null;
  samples: AnalysisSample[];
};
export type MovementEvent = {
  kind: 'contact' | 'reversal';
  angle: number;
  transition: 'starts-in-contact' | 'enter' | 'leave' | 'resists-to-assists' | 'assists-to-resists';
  detail?: string;
};
export type EventScan = {
  events: MovementEvent[];
  firstContact: MovementEvent | null;
  firstReversal: MovementEvent | null;
  sampleSpacing: number;
  boundaryTolerance: number;
};
export type Difference = { category: 'Model' | 'Position' | 'Equipment' | 'Load' | 'Body'; label: string; a: string; b: string; different: boolean };
export type SweepParameter = 'pulleyHeight' | 'hipX';
export type SweepPoint = { value: number; offset: number; summary: RegionSummary };

const EPS = 1e-9;
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const resultSample = (angle: number, result: Evaluation): AnalysisSample => ({ angle, moment: result.moment, status: result.status, cableMoment: result.cableMoment, gravityMoment: result.gravityMoment });

/** Integrate ordered angular samples without bridging unknown/contact gaps. */
export function summarizeSamples(samples: AnalysisSample[], requested: [number, number], region: [number, number] | null = requested, coordinateScale = RAD): RegionSummary {
  if (!Number.isFinite(coordinateScale) || coordinateScale <= 0) throw new RangeError("Coordinate conversion must be positive and finite.");
  const blank: RegionSummary = { requested, region, coverage: 0, complete: false, minimum: null, maximum: null, mean: null, resistingFraction: null, externalWork: null, cableWork: null, gravityWork: null, samples };
  if (!region || region[1] <= region[0] || samples.length < 2) return blank;
  const span = region[1] - region[0];
  let validSpan = 0, integral = 0, positiveSpan = 0, cableIntegral = 0, gravityIntegral = 0;
  let cableComplete = true, gravityComplete = true;
  for (let i = 1; i < samples.length; i++) {
    const left = samples[i - 1], right = samples[i];
    const width = right.angle - left.angle;
    if (width <= 0 || !finite(left.moment) || !finite(right.moment)) continue;
    validSpan += width;
    integral += (left.moment + right.moment) / 2 * width * coordinateScale;
    if (left.moment > 0 && right.moment > 0) positiveSpan += width;
    else if (left.moment > 0 || right.moment > 0) positiveSpan += width * Math.max(left.moment, right.moment) / Math.abs(left.moment - right.moment);
    if (finite(left.cableMoment) && finite(right.cableMoment)) cableIntegral += (left.cableMoment + right.cableMoment) / 2 * width * coordinateScale;
    else cableComplete = false;
    if (finite(left.gravityMoment) && finite(right.gravityMoment)) gravityIntegral += (left.gravityMoment + right.gravityMoment) / 2 * width * coordinateScale;
    else gravityComplete = false;
  }
  const coverage = Math.min(1, validSpan / span);
  const complete = Math.abs(validSpan - span) < EPS && samples.every(sample => finite(sample.moment));
  if (!complete) return { ...blank, coverage };
  const moments = samples.map(sample => sample.moment!);
  return { ...blank, coverage, complete, minimum: Math.min(...moments), maximum: Math.max(...moments), mean: integral / (span * coordinateScale), resistingFraction: positiveSpan / span,
    // Displayed moment is positive when opposing the reference action, irrespective of q direction.
    externalWork: integral === 0 ? 0 : -integral, cableWork: cableComplete ? cableIntegral === 0 ? 0 : -cableIntegral : null, gravityWork: gravityComplete ? gravityIntegral === 0 ? 0 : -gravityIntegral : null };
}

/** Selected joint-angle region, intersected with this setup's selected ROM. */
export function regionSummary(setup: Setup, profile: Profile, requested: [number, number], step = .5): RegionSummary {
  if (!requested.every(Number.isFinite) || requested[0] >= requested[1] || !Number.isFinite(step) || step <= 0) throw new RangeError('Select a finite region with its minimum below its maximum.');
  const low = Math.max(setup.range[0], requested[0]), high = Math.min(setup.range[1], requested[1]);
  if (high <= low) return summarizeSamples([], requested, null);
  const region: [number, number] = [low, high];
  const count = Math.ceil((high - low) / step);
  const candidates = [...contactAngles(setup, profile), ...constraintAngles(setup, profile)].filter(angle => angle >= low && angle <= high);
  const boundaries = [...new Set([low, ...candidates, high])].sort((a,b)=>a-b);
  const midpoints = boundaries.slice(1).map((angle,index)=>(angle+boundaries[index])/2);
  const angles = [...new Set([...Array.from({ length: count + 1 }, (_, i) => low + (high - low) * i / count), ...candidates, ...midpoints])].sort((a,b)=>a-b);
  const samples = angles.map(angle => resultSample(angle, evaluate(setup, profile, angle)));
  return summarizeSamples(samples, requested, region, getDefinition(setup).coordinateScale);
}

/** Sample in reference-action order, then bisect observed contact and sign boundaries. */
export function scanEvents(setup: Setup, profile: Profile, spacing = .25): EventScan {
  if (!(spacing > 0) || !Number.isFinite(spacing)) throw new RangeError('Event spacing must be positive.');
  const direction = getDefinition(setup).actionDirection;
  const start = direction === 1 ? setup.range[0] : setup.range[1];
  const finish = direction === 1 ? setup.range[1] : setup.range[0];
  const count = Math.max(1, Math.ceil(Math.abs(finish - start) / spacing));
  const tolerance = .005;
  const events: MovementEvent[] = [];
  const at = (angle: number) => ({ angle, result: evaluate(setup, profile, angle) });
  const bisect = (a: ReturnType<typeof at>, b: ReturnType<typeof at>, test: (result: Evaluation) => boolean) => {
    let left = a, right = b;
    const initial = test(left.result);
    while (Math.abs(right.angle - left.angle) > tolerance) {
      const middle = at((left.angle + right.angle) / 2);
      if (test(middle.result) === initial) left = middle; else right = middle;
    }
    return at((left.angle + right.angle) / 2);
  };
  const candidates = [...contactAngles(setup, profile), ...constraintAngles(setup, profile)].filter(angle => angle >= setup.range[0] && angle <= setup.range[1]);
  const sortedCandidates = [...new Set([setup.range[0], ...candidates, setup.range[1]])].sort((a,b)=>a-b);
  const intervals = sortedCandidates.slice(1).map((angle,index)=>(angle+sortedCandidates[index])/2);
  const positions = [...new Set([...Array.from({length:count+1},(_,i)=>start+(finish-start)*i/count), ...candidates, ...intervals])].sort((a,b)=>(a-b)*direction);
  let previous = at(start);
  if (previous.result.status === 'contact') events.push({ kind: 'contact', angle: start, transition: 'starts-in-contact', detail: previous.result.contactKind ?? undefined });
  let signed: ReturnType<typeof at> | null = finite(previous.result.moment) && Math.abs(previous.result.moment) > EPS ? previous : null;
  for (let i = 1; i < positions.length; i++) {
    const current = at(positions[i]);
    const wasContact = previous.result.status === 'contact', isContact = current.result.status === 'contact';
    if (wasContact !== isContact) {
      const boundary = bisect(previous, current, result => result.status === 'contact');
      events.push({ kind: 'contact', angle: boundary.angle, transition: isContact ? 'enter' : 'leave', detail: (isContact ? current.result.contactKind : previous.result.contactKind) ?? undefined });
    }
    if (!finite(current.result.moment)) signed = null;
    else if (Math.abs(current.result.moment) > EPS) {
      if (signed && signed.result.moment! * current.result.moment < 0) {
        const boundary = bisect(signed, current, result => finite(result.moment) && result.moment > 0);
        if (finite(boundary.result.moment)) events.push({ kind: 'reversal', angle: boundary.angle, transition: signed.result.moment! > 0 ? 'resists-to-assists' : 'assists-to-resists' });
      }
      signed = current;
    }
    previous = current;
  }
  events.sort((a, b) => (a.angle - b.angle) * direction);
  return { events, firstContact: events.find(event => event.kind === 'contact' && event.transition !== 'leave') ?? null, firstReversal: events.find(event => event.kind === 'reversal') ?? null, sampleSpacing: Math.abs(finish - start) / count, boundaryTolerance: tolerance };
}

export function canCompareRegions(a: Setup, b: Setup, summaries: [RegionSummary, RegionSummary]): boolean {
  return compatible(a, b) && summaries.every(summary => summary.complete && summary.region !== null)
    && Math.abs(summaries[0].region![0] - summaries[1].region![0]) < EPS
    && Math.abs(summaries[0].region![1] - summaries[1].region![1]) < EPS;
}

function labelValue(value: unknown, factor = 1, unit = ''): string {
  if (value === undefined || value === null) return 'Not specified';
  if (typeof value === 'number') return `${Number((value * factor).toFixed(3))}${unit ? ` ${unit}` : ''}`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(item => labelValue(item, factor, unit)).join(' – ');
  return String(value);
}

function obstacleDescription(obstacles: Setup['obstacles']): string {
  if (!obstacles?.length) return 'None represented';
  const point = (coordinates: number[]) => `(${coordinates.map(value => Number((value * 100).toFixed(3))).join(', ')}) cm`;
  return obstacles.map(obstacle => {
    const geometry = obstacle.type === 'box'
      ? `box; center XYZ ${point(obstacle.center)}; size XYZ ${point(obstacle.size)}`
      : `capsule; endpoint A XYZ ${point(obstacle.a)}; endpoint B XYZ ${point(obstacle.b)}; radius ${labelValue(obstacle.radius, 100, 'cm')}`;
    return `${obstacle.name || obstacle.id}: ${geometry}; intended body support ${obstacle.allowBodyContact ? 'allowed' : 'not allowed'}`;
  }).join('; ');
}

function equipmentLimitsDescription(limits: Setup['equipmentLimits']): string {
  if (!limits) return 'No apparatus adjustment limits declared';
  return `Outlet height ${labelValue([limits.pulleyMin, limits.pulleyMax], 100, 'cm')}; pelvis X ${labelValue([limits.distanceMin, limits.distanceMax], 100, 'cm')}`;
}

export function comparisonDifferences(state: LabState): Difference[] {
  const [a, b] = state.setups;
  const rows: Difference[] = [];
  const add = (category: Difference['category'], label: string, left: unknown, right: unknown, factor = 1, unit = '') => rows.push({ category, label, a: labelValue(left, factor, unit), b: labelValue(right, factor, unit), different: JSON.stringify(left) !== JSON.stringify(right) });
  add('Model', 'Movement', getDefinition(a).label, getDefinition(b).label);
  add('Model', 'Joint coordinate and action', `${getDefinition(a).angleLabel}; ${getDefinition(a).action}`, `${getDefinition(b).angleLabel}; ${getDefinition(b).action}`);
  add('Model', 'Force convention', getDefinition(a).forceConvention, getDefinition(b).forceConvention);
  add('Model', 'Resistance source', a.resistance ?? 'cable', b.resistance ?? 'cable');
  add('Position', 'Selected range', labelValue(a.range, 1, getDefinition(a).angleUnit), labelValue(b.range, 1, getDefinition(b).angleUnit));
  add('Position', 'Current coordinate', labelValue(state.angles[0], 1, getDefinition(a).angleUnit), labelValue(state.angles[1], 1, getDefinition(b).angleUnit));
  add('Position', 'Support', a.kind, b.kind);
  add('Position', 'Facing direction', a.facing === 1 ? 'Away from outlets' : 'Toward outlets', b.facing === 1 ? 'Away from outlets' : 'Toward outlets');
  add('Position', 'Torso / backrest inclination¹', a.tilt, b.tilt, 1, '°');
  add('Position', 'Pelvis to outlet plane', a.hipX, b.hipX, 100, 'cm');
  add('Position', 'Pelvis height', a.hipHeight, b.hipHeight, 100, 'cm');
  add('Position', 'Fixed elbow bend', a.elbow, b.elbow, 1, '°');
  add('Position', 'Upper-arm position', a.upperArmAngle, b.upperArmAngle, 1, '°');
  for (const [key, label] of [['pulleyHeight','Pulley height'], ['outletSpacing','Outlet separation'], ['attachmentSpacing','Attachment separation'], ['gripWidth','Grip separation'], ['backLength','Backrest length'], ['backWidth','Backrest width'], ['backThickness','Backrest thickness']] as const) add('Equipment', label, a[key], b[key], 100, 'cm');
  add('Load', 'Number of cable attachments', a.cables, b.cables);
  add('Load', 'Actual tension per attachment', a.resistance === 'dumbbell' ? 'Not a cable' : getTension(a), b.resistance === 'dumbbell' ? 'Not a cable' : getTension(b), 1, 'N');
  add('Load', 'Selected mass / dumbbell mass', a.loadMass, b.loadMass, 1, 'kg');
  add('Load', 'Transmission factor', a.transmissionFactor, b.transmissionFactor);
  add('Load', 'Segment gravity included', a.segmentGravity ?? false, b.segmentGravity ?? false);
  add('Load', 'Upper-arm mass', a.upperArmMass, b.upperArmMass, 1, 'kg');
  add('Load', 'Forearm mass', a.forearmMass, b.forearmMass, 1, 'kg');
  add('Load', 'Cable explicitly slack', a.slack ?? false, b.slack ?? false);
  const extraFields: [string, string, Difference['category'], number, string][] = [
    ['posture', 'Body posture', 'Position', 1, ''], ['hipY', 'Pelvis lateral position', 'Position', 100, 'cm'],
    ['movementPlane', 'Movement plane rotation', 'Position', 1, '°'], ['jointPlacement', 'Proximal joint placement', 'Position', 1, '°'],
    ['bodyRoll', 'Body roll', 'Position', 1, '°'], ['planeOffset', 'Plane offset', 'Position', 100, 'cm'],
    ['barLength', 'Bar length', 'Equipment', 100, 'cm'], ['rotationLever', 'Forearm rotation lever', 'Equipment', 100, 'cm'],
    ['cableRadius', 'Represented cable radius', 'Equipment', 1000, 'mm'], ['barRadius', 'Represented bar radius', 'Equipment', 1000, 'mm'],
    ['outletPositions', 'Explicit outlet XYZ coordinates', 'Equipment', 100, 'cm'],
    ['cableTravelMin', 'Minimum available cable length', 'Equipment', 100, 'cm'], ['cableTravelMax', 'Maximum available cable length', 'Equipment', 100, 'cm'],
    ['loadedSides', 'Loaded sides', 'Load', 1, ''], ['freeWeightKind', 'Free-weight convention', 'Load', 1, ''],
    ['stackArrangement', 'Stack arrangement', 'Load', 1, ''], ['gripStyle', 'Grip annotation', 'Position', 1, ''],
    ['rotationDirection', 'Forearm rotation action', 'Model', 1, ''],
    ['forearmRotation', 'Forearm orientation', 'Position', 1, '°'],
    ['bodyCollision', 'Represented body contact checks enabled', 'Equipment', 1, ''],
    ['bodyRadius', 'Represented body capsule radius', 'Equipment', 100, 'cm'],
    ['collisionAttachmentClearance', 'Attachment contact allowance', 'Equipment', 100, 'cm'],
    ['exploration', 'Explore outside apparatus adjustment limits', 'Equipment', 1, ''],
    ['loadMode', 'Cable load entry convention', 'Load', 1, ''],
    ['forceKnown', 'Cable force declared known', 'Load', 1, ''],
    ['thighMass', 'Thigh mass', 'Load', 1, 'kg'], ['shankMass', 'Shank mass', 'Load', 1, 'kg'], ['handMass', 'Hand mass', 'Load', 1, 'kg'],
  ];
  for (const [key, label, category, factor, unit] of extraFields) {
    const left = (a as unknown as Record<string, unknown>)[key], right = (b as unknown as Record<string, unknown>)[key];
    if (left !== undefined || right !== undefined) add(category, label, left, right, factor, unit);
  }
  add('Equipment', 'Represented seat and frame obstacles', obstacleDescription(a.obstacles), obstacleDescription(b.obstacles));
  add('Equipment', 'Apparatus adjustment limits', equipmentLimitsDescription(a.equipmentLimits), equipmentLimitsDescription(b.equipmentLimits));

  for (const key of Object.keys(state.profiles[0].values) as (keyof Profile)[]) {
    add('Body', key.replace(/[A-Z]/g, char => ` ${char.toLowerCase()}`), state.profiles[0].values[key], state.profiles[1].values[key], 100, 'cm');
    add('Body', `${key} provenance`, state.profiles[0].provenance[key], state.profiles[1].provenance[key]);
  }
  return rows;
}

export function parameterSweep(setup: Setup, profile: Profile, region: [number, number], parameter: SweepParameter, offsets: number[] = [-.2,-.15,-.1,-.05,0,.05,.1,.15,.2]): SweepPoint[] {
  if (setup.resistance === 'dumbbell' || setup.resistance === 'unknown' || setup.model === 'machine') return [];
  return offsets.flatMap(offset => {
    const value = (parameter === 'pulleyHeight' ? outletHeight(setup) : setup.hipX) + offset;
    if (!Number.isFinite(offset) || !Number.isFinite(value)) return [];
    const next = parameter === 'pulleyHeight' ? withOutletHeight(setup, value) : { ...setup, hipX: value };
    if (next.pulleyHeight < .01 || next.pulleyHeight > 5 || next.hipX < -10 || next.hipX > 10
      || next.outletPositions?.some(point => !Number.isFinite(point[2]) || point[2] < 0 || point[2] > 10)) return [];
    return [{ value, offset, summary: regionSummary(next, profile, region) }];
  });
}

export function comparisonReport(state: LabState): string {
  const requested: [number, number] = state.region ?? [Math.max(state.setups[0].range[0], state.setups[1].range[0]), Math.min(state.setups[0].range[1], state.setups[1].range[1])];
  const region = requested[0] < requested[1] ? requested : state.setups[0].range;
  const summaries = state.setups.map((setup, index) => regionSummary(setup, state.profiles[index].values, compatible(state.setups[0], state.setups[1]) ? region : setup.range)) as [RegionSummary, RegionSummary];
  const fmt = (value: number | null, unit: string) => value === null ? 'Not calculated over this complete region' : `${value.toFixed(2)} ${unit}`;
  const lines = ['EXERCISE BIOMECHANICS LAB — COMPARISON REPORT', state.name || 'Untitled comparison', `Model: ${MODEL_VERSION}`, `Exported: ${new Date().toISOString()}`, '', `Criterion: ${state.criterion || 'Not specified'}`, `Comparison type: ${state.comparisonMode ?? 'practical'}`, `Selected coordinate region: ${compatible(state.setups[0], state.setups[1]) ? `${region[0]}–${region[1]}${getDefinition(state.setups[0]).angleUnit}` : "Individual original ranges; coordinates differ"}`, `Compatible complete-region comparison: ${canCompareRegions(state.setups[0], state.setups[1], summaries) ? 'yes' : 'no'}`, ''];
  state.setups.forEach((setup, index) => {
    const summary = summaries[index], definition = getDefinition(setup), events = scanEvents(setup, state.profiles[index].values);
    lines.push(`${index === 0 ? 'A' : 'B'}: ${setup.name}`, `Coordinate: ${definition.angleLabel} (${definition.angleUnit}); action: ${definition.action}`, `Force convention: ${definition.forceConvention}`, `Region after ROM intersection: ${summary.region?.join('–') ?? 'no overlap'}${definition.angleUnit}; sampled coverage: ${(summary.coverage * 100).toFixed(1)}%`, `External resistance minimum / mean / maximum: ${fmt(summary.minimum, definition.unit)} / ${fmt(summary.mean, definition.unit)} / ${fmt(summary.maximum, definition.unit)}`, `External-load work in reference action: ${fmt(summary.externalWork, 'J')}`, `First sampled contact: ${events.firstContact ? events.firstContact.angle.toFixed(2) + definition.angleUnit : 'none detected'}`, `First sampled reversal: ${events.firstReversal ? events.firstReversal.angle.toFixed(2) + definition.angleUnit : 'none detected'}`, `Assumptions: ${(evaluate(setup, state.profiles[index].values, state.angles[index]).assumptions ?? []).join('; ')}`, `Body proportions: ${state.profiles[index].referenceModel}; per-value provenance retained in JSON export`, '');
  });
  lines.push('SETTINGS THAT DIFFER', ...comparisonDifferences(state).filter(row => row.different).map(row => `${row.category} / ${row.label}: A ${row.a}; B ${row.b}`), '', 'USER OBSERVATIONS (not computed)', state.observation || 'None recorded', '', 'HYPOTHESIS / NEXT STEP', state.notes || 'None recorded', '', 'INTERPRETATION LIMIT', 'Positive displayed resistance resists the declared reference action. External work is negative for a consistently resisting load. Region integrals use radians for rotations or metres for translation with trapezoidal integration; unavailable samples are never treated as zero. These are external mechanical calculations, not estimates of muscle tension, activation, energy expenditure or hypertrophy. Event scans combine 0.25 coordinate-unit sampling with available analytical contact candidates and refine observed transitions. Numerical tolerances and the represented obstacles limit detection.', '', 'PRIMARY SOURCES', 'OpenStax torque: https://openstax.org/books/university-physics-volume-1/pages/10-6-torque', 'OpenSim scaling: https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089158', 'OpenSim static optimization: https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619');
  return lines.join('\n');
}
