import type { Profile } from './engine';
import { COMPOUND_VERSION, createCompoundConfig, getCompoundPreset, type CompoundConfig } from './compoundEngine';

export type CompoundSnapshot = {
  version: 1; modelVersion: string; name: string;
  configs: [CompoundConfig, CompoundConfig]; profiles: [Profile, Profile];
  positions: [number, number]; sync: boolean; useMainProfiles: boolean;
  camera: [number, number]; notes: string;
  drafts?: [Record<string, CompoundDraft>, Record<string, CompoundDraft>];
};
export type CompoundDraft = { config: CompoundConfig; position: number };
export const COMPOUND_KEY = 'biomechanics.compound-workbench.v1';
export function initialCompound(profiles: [Profile, Profile]): CompoundSnapshot {
  return { version: 1, modelVersion: COMPOUND_VERSION, name: 'Compound comparison', configs: [createCompoundConfig('row-seated'), createCompoundConfig('row-supported')], profiles: structuredClone(profiles), positions: [.5, .5], sync: true, useMainProfiles: true, camera: [25, 12], notes: '' };
}
/** Each side retains its own edited setup and selected position for every exercise. */
export function switchCompoundExercise(state: CompoundSnapshot, side: 0 | 1, preset: string): void {
  if (state.configs[side].preset === preset) return;
  const drafts = state.drafts ?? (state.drafts = [{}, {}]);
  drafts[side][state.configs[side].preset] = { config: structuredClone(state.configs[side]), position: state.positions[side] };
  const saved = drafts[side][preset];
  state.configs[side] = saved ? structuredClone(saved.config) : createCompoundConfig(preset);
  state.positions[side] = saved?.position ?? .5;
  if (state.sync) state.positions[1 - side] = state.positions[side];
}
const ranges: Record<Exclude<keyof CompoundConfig, 'preset' | 'resistance' | 'outlet' | 'masses' | 'loadPosition' | 'bodyGravity' | 'unilateral'>, [number, number]> = {
  loadMass: [0, 400], tension: [0, 2000], assistance: [0, 2000], hipHeight: [.1, 1.6], torsoAngle: [-30, 120], gripWidth: [.1, 1.2], stance: [.2, 1.6], stepHeight: [0, .7], supportAngle: [0, 90], depth: [.05, 1], shoulderStart: [0, 200], shoulderEnd: [0, 200], elbowStart: [0, 140], elbowEnd: [0, 140],
};
export const compoundBounds = ranges;
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a compound-workbench object.'); return value as Record<string, unknown>; }
function number(value: unknown, low: number, high: number): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw new Error(`A value is outside ${low}–${high}.`); return value; }
export function validateCompoundConfig(value: unknown): CompoundConfig {
  const input = object(value); if (typeof input.preset !== 'string') throw new Error('Missing exercise identifier.');
  const result = createCompoundConfig(input.preset); getCompoundPreset(result);
  for (const [key, bounds] of Object.entries(ranges)) (result as unknown as Record<string, unknown>)[key] = number(input[key], ...bounds);
  if (!['cable', 'gravity', 'bodyweight', 'unknown'].includes(String(input.resistance))) throw new Error('Unknown resistance type.');
  result.resistance = input.resistance as CompoundConfig['resistance'];
  if (getCompoundPreset(result).mechanics === 'unknown' && result.resistance !== 'unknown') throw new Error('An unknown mechanism cannot be imported as a calibrated force model. Choose a separately defined theoretical model.');
  if (!['hands', 'shoulders', 'pelvis'].includes(String(input.loadPosition))) throw new Error('Unknown load location.'); result.loadPosition = input.loadPosition as CompoundConfig['loadPosition'];
  for (const key of ['bodyGravity', 'unilateral'] as const) { if (typeof input[key] !== 'boolean') throw new Error('Invalid boolean setting.'); result[key] = input[key]; }
  if (!Array.isArray(input.outlet) || input.outlet.length !== 3) throw new Error('Outlet requires three coordinates.');
  result.outlet = [number(input.outlet[0], -4, 4), number(input.outlet[1], -4, 4), number(input.outlet[2], 0, 4)];
  const masses = object(input.masses); for (const key of Object.keys(result.masses) as (keyof CompoundConfig['masses'])[]) result.masses[key] = number(masses[key], 0, 100);
  return result;
}
function profile(value: unknown): Profile {
  const input = object(value), output = {} as Profile;
  for (const key of ['height', 'upperArm', 'forearm', 'hand', 'torso', 'shoulderWidth'] as const) output[key] = number(input[key], .01, 3);
  for (const key of ['thigh', 'shank', 'foot', 'pelvisWidth', 'headNeck'] as const) if (input[key] !== undefined) output[key] = number(input[key], .01, 2);
  return output;
}
export function parseCompound(text: string): CompoundSnapshot {
  if (text.length > 1_000_000) throw new Error('Comparison file exceeds 1 MB.');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('This is not valid JSON.'); }
  const input = object(value);
  if (input.version !== 1 || input.modelVersion !== COMPOUND_VERSION) throw new Error('Unsupported compound model version. Keep the original file for migration.');
  if (!Array.isArray(input.configs) || input.configs.length !== 2 || !Array.isArray(input.profiles) || input.profiles.length !== 2 || !Array.isArray(input.positions) || input.positions.length !== 2 || !Array.isArray(input.camera) || input.camera.length !== 2) throw new Error('A comparison needs two setups, profiles and positions.');
  if (typeof input.sync !== 'boolean' || typeof input.useMainProfiles !== 'boolean') throw new Error('Invalid comparison synchronization.');
  if (typeof input.name !== 'string' || input.name.length > 100 || typeof input.notes !== 'string' || input.notes.length > 10000) throw new Error('Invalid comparison name or notes.');
  if (input.sync && Math.abs(Number(input.positions[0]) - Number(input.positions[1])) > 1e-9) throw new Error('Synchronized compound positions must agree.');
  let drafts: CompoundSnapshot['drafts'];
  if (input.drafts !== undefined) {
    if (!Array.isArray(input.drafts) || input.drafts.length !== 2) throw new Error('Exercise drafts need one collection per side.');
    drafts = input.drafts.map(collection => {
      const entries = Object.entries(object(collection));
      if (entries.length > 100) throw new Error('Too many compound exercise drafts.');
      return Object.fromEntries(entries.map(([preset, value]) => {
        const saved = object(value), config = validateCompoundConfig(saved.config);
        if (config.preset !== preset) throw new Error('Compound exercise draft identifier does not match its setup.');
        return [preset, { config, position: number(saved.position, 0, 1) }];
      }));
    }) as CompoundSnapshot['drafts'];
  }
  return { version: 1, modelVersion: COMPOUND_VERSION, name: input.name, configs: [validateCompoundConfig(input.configs[0]), validateCompoundConfig(input.configs[1])], profiles: [profile(input.profiles[0]), profile(input.profiles[1])], positions: [number(input.positions[0], 0, 1), number(input.positions[1], 0, 1)], sync: input.sync, useMainProfiles: input.useMainProfiles, camera: [number(input.camera[0], -180, 180), number(input.camera[1], -70, 70)], notes: input.notes, ...(drafts ? { drafts } : {}) };
}

export const COMPOUND_LIBRARY_KEY = 'biomechanics.compound-library.v1';
export type CompoundLibraryEntry = { id: string; name: string; updatedAt: string; snapshot: CompoundSnapshot };
export function parseCompoundLibrary(text: string): CompoundLibraryEntry[] {
  if (text.length > 5_000_000) throw new Error('Compound library exceeds 5 MB.');
  const raw: unknown = JSON.parse(text);
  if (!Array.isArray(raw) || raw.length > 100) throw new Error('Compound library must contain at most 100 comparisons.');
  const seen = new Set<string>();
  return raw.map(value => {
    const item = object(value);
    if (typeof item.id !== 'string' || !item.id || item.id.length > 100 || seen.has(item.id)) throw new Error('Invalid or duplicate saved comparison ID.');
    if (typeof item.name !== 'string' || item.name.length > 100 || typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error('Invalid saved comparison metadata.');
    seen.add(item.id);
    return { id: item.id, name: item.name, updatedAt: item.updatedAt, snapshot: parseCompound(JSON.stringify(item.snapshot)) };
  });
}
