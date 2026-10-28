import { createMachineProfile, validateMachineProfile, type MachineProfile, type MachineBranch } from './machine';
export const MACHINE_LIBRARY_KEY = 'biomechanics.machine-library.v1';
export const MACHINE_WORKSPACE_KEY = 'biomechanics.machine-workspace.v1';
export const MACHINE_MAX_BYTES = 1_000_000;
export type SavedMachineProfile = { id: string; savedAt: string; profile: MachineProfile };
export type MachineLibrary = { format: 'biomechanics-machine-library'; version: 1; profiles: SavedMachineProfile[] };
export type MachineWorkspace = { version: 1; profiles: [MachineProfile, MachineProfile]; angles: [number, number]; branches: [MachineBranch, MachineBranch]; sameAngle: boolean; coordinateMatch: boolean };
const object = (value: unknown, label: string): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; };
const size = (text: string) => { if (new TextEncoder().encode(text).byteLength > MACHINE_MAX_BYTES) throw new Error('Machine import exceeds the 1 MB size limit.'); };
export function createMachineWorkspace(): MachineWorkspace {
  const a = createMachineProfile('lever'), b = structuredClone(a);
  a.name = 'A · 20 kg lever, 40 cm radius'; b.id += '-b'; b.name = 'B · 20 kg lever, 55 cm radius'; b.lever.radius = 0.55;
  return { version: 1, profiles: [a, b], angles: [40, 40], branches: ['lifting', 'lifting'], sameAngle: true, coordinateMatch: true };
}
export function validateMachineWorkspace(value: unknown): MachineWorkspace {
  const input = object(value, 'Machine comparison');
  if (input.version !== 1) throw new Error('Unsupported machine comparison version.');
  for (const key of ['profiles', 'angles', 'branches'] as const) if (!Array.isArray(input[key]) || input[key].length !== 2) throw new Error(`Machine ${key} requires exactly A and B.`);
  const profiles = (input.profiles as unknown[]).map(validateMachineProfile) as [MachineProfile, MachineProfile];
  const angles = (input.angles as unknown[]).map((q, i) => { if (typeof q !== 'number' || !Number.isFinite(q) || q < profiles[i].domain[0] || q > profiles[i].domain[1]) throw new Error('Machine position is outside its specified domain.'); return q; }) as [number, number];
  const branches = (input.branches as unknown[]).map(branch => { if (branch !== 'lifting' && branch !== 'lowering') throw new Error('Choose a lifting or lowering data branch.'); return branch; }) as [MachineBranch, MachineBranch];
  if (typeof input.sameAngle !== 'boolean' || typeof input.coordinateMatch !== 'boolean') throw new Error('Machine comparison locks must be true or false.');
  if (input.sameAngle && Math.abs(angles[0] - angles[1]) > 1e-8) throw new Error('Synchronized machine positions must use the same input angle.');
  return { version: 1, profiles, angles, branches, sameAngle: input.sameAngle, coordinateMatch: input.coordinateMatch };
}
export function validateMachineLibrary(value: unknown): MachineLibrary {
  const input = object(value, 'Machine library');
  if (input.format !== 'biomechanics-machine-library' || input.version !== 1 || !Array.isArray(input.profiles) || input.profiles.length > 200) throw new Error('Unsupported machine library format or too many profiles (maximum 200).');
  const profiles = input.profiles.map(value => {
    const entry = object(value, 'Saved machine profile');
    if (typeof entry.id !== 'string' || !/^[\w-]{1,120}$/.test(entry.id) || typeof entry.savedAt !== 'string' || !Number.isFinite(Date.parse(entry.savedAt))) throw new Error('Invalid saved machine profile identity or date.');
    const profile = validateMachineProfile(entry.profile);
    if (entry.id !== profile.id) throw new Error('Saved machine identity must match its profile identity.');
    return { id: entry.id, savedAt: entry.savedAt, profile };
  });
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('Machine library has duplicate identifiers.');
  return { format: 'biomechanics-machine-library', version: 1, profiles };
}
export function loadMachineWorkspace(): { workspace: MachineWorkspace; error: string | null } {
  try { const raw = localStorage.getItem(MACHINE_WORKSPACE_KEY); if (!raw) return { workspace: createMachineWorkspace(), error: null }; size(raw); return { workspace: validateMachineWorkspace(JSON.parse(raw)), error: null }; }
  catch (error) { return { workspace: createMachineWorkspace(), error: `The saved machine comparison could not be restored. Original data is retained. ${error instanceof Error ? error.message : ''}` }; }
}
export function saveMachineWorkspace(workspace: MachineWorkspace): void {
  const text = JSON.stringify(validateMachineWorkspace(workspace)); size(text);
  try {
    const previous = localStorage.getItem(MACHINE_WORKSPACE_KEY);
    if (previous) {
      let valid = true; try { validateMachineWorkspace(JSON.parse(previous)); } catch { valid = false; }
      if (!valid) {
        const base = `${MACHINE_WORKSPACE_KEY}.backup.${Date.now()}`; let key = base, suffix = 0;
        while (localStorage.getItem(key) !== null && localStorage.getItem(key) !== previous) key = `${base}.${++suffix}`;
        localStorage.setItem(key, previous);
      }
    }
    localStorage.setItem(MACHINE_WORKSPACE_KEY, text);
  } catch { throw new Error('Machine comparison could not be saved; export it to retain your work.'); }
}
export function loadMachineLibrary(): MachineLibrary {
  const raw = localStorage.getItem(MACHINE_LIBRARY_KEY);
  if (!raw) return { format: 'biomechanics-machine-library', version: 1, profiles: [] };
  size(raw); return validateMachineLibrary(JSON.parse(raw));
}
export function saveMachineProfile(profile: MachineProfile): SavedMachineProfile {
  const valid = validateMachineProfile(profile), library = loadMachineLibrary();
  const entry = { id: valid.id, savedAt: new Date().toISOString(), profile: valid };
  library.profiles = [entry, ...library.profiles.filter(p => p.id !== entry.id)];
  const text = JSON.stringify(validateMachineLibrary(library)); size(text);
  try { localStorage.setItem(MACHINE_LIBRARY_KEY, text); } catch { throw new Error('Machine library could not be saved. Export the profile instead.'); }
  return entry;
}
export function deleteMachineProfile(id: string): void {
  const library = loadMachineLibrary(); library.profiles = library.profiles.filter(entry => entry.id !== id);
  localStorage.setItem(MACHINE_LIBRARY_KEY, JSON.stringify(library));
}
export function exportMachineLibrary(): string { return JSON.stringify(loadMachineLibrary(), null, 2); }
export function importMachineData(text: string): { kind: 'profile'; profile: MachineProfile } | { kind: 'workspace'; workspace: MachineWorkspace } | { kind: 'library'; count: number } {
  size(text); let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error('The machine file is not valid JSON.'); }
  const record = object(input, 'Machine import');
  if (record.format === 'biomechanics-machine-library') {
    const imported = validateMachineLibrary(record), current = loadMachineLibrary();
    const existing = new Set(current.profiles.map(p => p.id));
    for (const entry of imported.profiles) {
      if (existing.has(entry.id)) {
        const base = `${entry.id.slice(0,90)}-import`; let suffix = 1;
        while (existing.has(`${base}-${suffix}`)) suffix++;
        entry.id = `${base}-${suffix}`; entry.profile.id = entry.id;
      }
      existing.add(entry.id); current.profiles.push(entry);
    }
    const merged = JSON.stringify(validateMachineLibrary(current)); size(merged);
    try { localStorage.setItem(MACHINE_LIBRARY_KEY, merged); } catch { throw new Error('Imported profiles could not be saved in this browser.'); }
    return { kind: 'library', count: imported.profiles.length };
  }
  if (Array.isArray(record.profiles)) return { kind: 'workspace', workspace: validateMachineWorkspace(record) };
  return { kind: 'profile', profile: validateMachineProfile(record) };
}
