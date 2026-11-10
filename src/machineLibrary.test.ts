import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMachineProfile } from './machine';
import { createMachineWorkspace, deleteMachineProfile, exportMachineLibrary, importMachineData, loadMachineLibrary, loadMachineWorkspace, MACHINE_LIBRARY_KEY, MACHINE_WORKSPACE_KEY, saveMachineProfile, saveMachineWorkspace, validateMachineWorkspace } from './machineLibrary';
let memory: Map<string, string>;
beforeEach(() => { memory = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) }); });
afterEach(() => vi.unstubAllGlobals());
describe('portable machine workspaces and calibrated profiles', () => {
  it('round-trips both independent profiles, branches, mappings and positions', () => {
    const workspace = createMachineWorkspace(); workspace.sameAngle = false; workspace.angles = [20, 70]; workspace.branches[1] = 'lowering';
    saveMachineWorkspace(workspace);
    expect(loadMachineWorkspace()).toEqual({ workspace, error: null });
    expect(importMachineData(JSON.stringify(workspace))).toEqual({ kind: 'workspace', workspace });
    expect(() => validateMachineWorkspace({ ...workspace, angles: [500, 50] })).toThrow('domain');
  });
  it('saves and imports named profiles without silently overwriting duplicate identities', () => {
    const profile = createMachineProfile('cam'); const entry = saveMachineProfile(profile);
    expect(loadMachineLibrary().profiles[0].profile).toEqual(profile);
    const exported = exportMachineLibrary();
    expect(importMachineData(exported)).toEqual({ kind: 'library', count: 1 });
    expect(loadMachineLibrary().profiles).toHaveLength(2);
    expect(new Set(loadMachineLibrary().profiles.map(p => p.id)).size).toBe(2);
    expect(importMachineData(JSON.stringify(profile))).toEqual({ kind: 'profile', profile });
    deleteMachineProfile(entry.id);
    expect(loadMachineLibrary().profiles).toHaveLength(1);
  });
  it('retains old workspace data when unreadable and backs it up before explicit replacement', () => {
    memory.set(MACHINE_WORKSPACE_KEY, '{bad');
    expect(loadMachineWorkspace().error).toContain('Original data is retained');
    expect(memory.get(MACHINE_WORKSPACE_KEY)).toBe('{bad');
    saveMachineWorkspace(createMachineWorkspace());
    expect([...memory.entries()].find(([key]) => key.startsWith(MACHINE_WORKSPACE_KEY + '.backup.'))?.[1]).toBe('{bad');
  });
  it('rejects oversized, malformed and unsupported imports without changing the library', () => {
    saveMachineProfile(createMachineProfile('lever')); const previous = memory.get(MACHINE_LIBRARY_KEY);
    expect(() => importMachineData(' '.repeat(1000001))).toThrow('1 MB');
    expect(() => importMachineData('{bad')).toThrow('valid JSON');
    expect(() => importMachineData('{"version":99}')).toThrow('version');
    expect(memory.get(MACHINE_LIBRARY_KEY)).toBe(previous);
  });
  it('reports storage failure rather than claiming a saved machine comparison', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Quota'); } });
    expect(() => saveMachineWorkspace(createMachineWorkspace())).toThrow('could not be saved');
    expect(() => saveMachineProfile(createMachineProfile('lever'))).toThrow('could not be saved');
  });
  it('never replaces a distinct recovery snapshot created in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    memory.set(MACHINE_WORKSPACE_KEY, '{first'); saveMachineWorkspace(createMachineWorkspace());
    memory.set(MACHINE_WORKSPACE_KEY, '{second'); saveMachineWorkspace(createMachineWorkspace());
    expect(memory.get(`${MACHINE_WORKSPACE_KEY}.backup.100`)).toBe('{first');
    expect(memory.get(`${MACHINE_WORKSPACE_KEY}.backup.100.1`)).toBe('{second');
    vi.restoreAllMocks();
  });
  it('refuses to replace unreadable originals when creating their backup fails', () => {
    const raw = '{unreadable'; let wroteWorkspace = false;
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === MACHINE_WORKSPACE_KEY ? raw : null, setItem: (key: string) => { if (key === MACHINE_WORKSPACE_KEY) wroteWorkspace = true; throw new Error('Quota'); } });
    expect(() => saveMachineWorkspace(createMachineWorkspace())).toThrow('could not be saved');
    expect(wroteWorkspace).toBe(false);
  });

});

it('round-trips user formulas and named parameter units without precomputed source models',()=>{
  const profile=createMachineProfile('formula');profile.formula!.expression='stiffness * q + preload';profile.formula!.parameters=[{name:'stiffness',value:20,unit:'N·m/rad',description:'User-declared input shaft torsional stiffness.'},{name:'preload',value:5,unit:'N·m',description:'User-declared preload resisting increasing input angle.'}];
  saveMachineProfile(profile);expect(loadMachineLibrary().profiles[0].profile.formula).toEqual(profile.formula);expect(importMachineData(JSON.stringify(profile))).toEqual({kind:'profile',profile});
});
