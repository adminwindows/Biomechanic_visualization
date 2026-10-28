import { MODEL_VERSION } from './engine';
import { validateState, type LabState } from './state';
import { COMPOUND_KEY, parseCompound, type CompoundSnapshot } from './compoundState';
import { MACHINE_WORKSPACE_KEY, validateMachineWorkspace, type MachineWorkspace } from './machineLibrary';

export const RESEARCH_KEY = 'exercise-biomechanics-lab.research.v1';
export const MAX_RESEARCH_BYTES = 2_000_000;
export const MAX_RESEARCH_ENTRIES = 100;
export const RESEARCH_CLASSIFICATIONS = {
  hypothesis: 'Hypothesis to explore',
  calculation: 'Calculation within the model',
  estimate: 'Assumption-dependent estimate',
  study: 'Empirical study result',
  observation: 'Personal observation',
  source: 'Source note',
} as const;
export type ResearchClassification = keyof typeof RESEARCH_CLASSIFICATIONS;
export type ResearchCitation = { title: string; url: string; note: string };
export type ResearchDraft = {
  title: string;
  classification: ResearchClassification;
  hypothesis: string;
  observation: string;
  citations: ResearchCitation[];
};
export type ResearchSource = 'joint' | 'compound' | 'machine';
export type ResearchAttachment = { kind: 'compound'; snapshot: CompoundSnapshot } | { kind: 'machine'; snapshot: MachineWorkspace };
export type ResearchEntry = ResearchDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceModelVersion: string;
  snapshot: LabState;
  attachment?: ResearchAttachment;
};
export type ResearchNotebookData = {
  format: 'biomechanics-research-notebook';
  version: 1;
  entries: ResearchEntry[];
};

const clone = <T,>(value: T): T => structuredClone(value);
const empty = (): ResearchNotebookData => ({ format: 'biomechanics-research-notebook', version: 1, entries: [] });
const newId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `research-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, maximum: number, required = false): string {
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim()))
    throw new Error(`${label} must contain ${required ? '1' : '0'}–${maximum} characters.`);
  return value.trim();
}
function timestamp(value: unknown): string {
  const result = text(value, 'Research date', 40, true);
  if (!Number.isFinite(Date.parse(result))) throw new Error('A research entry has an invalid date.');
  return result;
}
function citation(input: unknown): ResearchCitation {
  const raw = object(input, 'Citation');
  const url = text(raw.url, 'Citation URL', 2000, true);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Citation URLs must be complete HTTP or HTTPS links.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error('Citation URLs must be HTTP or HTTPS links without embedded credentials.');
  return { title: text(raw.title, 'Citation title', 200, true), url, note: text(raw.note, 'Citation scope and limitations', 5000) };
}
export function validateResearchDraft(input: unknown): ResearchDraft {
  const raw = object(input, 'Research note');
  const classification = raw.classification;
  if (typeof classification !== 'string' || !Object.hasOwn(RESEARCH_CLASSIFICATIONS, classification))
    throw new Error('Choose a supported evidence category.');
  if (!Array.isArray(raw.citations) || raw.citations.length > 20) throw new Error('A note can contain no more than 20 citations.');
  const citations = raw.citations.map(citation);
  if (classification === 'study' && citations.length === 0) throw new Error('An empirical study result needs a citation; otherwise record it as a hypothesis or observation.');
  return {
    title: text(raw.title, 'Research title', 160, true),
    classification: classification as ResearchClassification,
    hypothesis: text(raw.hypothesis, 'Question and hypothesis', 10000),
    observation: text(raw.observation, 'Finding and limitations', 10000),
    citations,
  };
}
export function validateResearchAttachment(input: unknown): ResearchAttachment {
  const raw = object(input, 'Research source attachment');
  if (raw.kind === 'compound') return { kind: 'compound', snapshot: parseCompound(JSON.stringify(raw.snapshot)) };
  if (raw.kind === 'machine') return { kind: 'machine', snapshot: validateMachineWorkspace(raw.snapshot) };
  throw new Error('A research attachment must use a supported compound or machine source.');
}
/** Call after the mounted workbenches flush their current edits. */
export function captureResearchAttachment(kind: Exclude<ResearchSource, 'joint'>): ResearchAttachment {
  const key = kind === 'compound' ? COMPOUND_KEY : MACHINE_WORKSPACE_KEY;
  let raw: string | null;
  try { raw = localStorage.getItem(key); } catch { throw new Error('The selected research source cannot be read from browser storage.'); }
  if (!raw) throw new Error(`Open and configure the ${kind === 'compound' ? 'Compound movements' : 'Machines & measured profiles'} workspace before saving a note from it.`);
  let snapshot: unknown;
  try { snapshot = JSON.parse(raw); } catch { throw new Error('The selected workbench contains unreadable data; its original has been kept.'); }
  return clone(validateResearchAttachment({ kind, snapshot }));
}
/** Restore only the selected workbench, preserving its previous raw contents first. */
export function restoreResearchAttachment(input: ResearchAttachment): { kind: 'compound' | 'machine'; backupKey: string | null } {
  const attachment = validateResearchAttachment(input);
  if (attachment.kind === 'compound') attachment.snapshot.useMainProfiles = false;
  const key = attachment.kind === 'compound' ? COMPOUND_KEY : MACHINE_WORKSPACE_KEY;
  const raw = JSON.stringify(attachment.snapshot);
  let backupKey: string | null = null;
  try {
    const previous = localStorage.getItem(key);
    if (previous !== null) {
      const prefix = `${key}.research-restore-backup.${Date.now()}`;
      backupKey = prefix;
      let suffix = 0;
      while (localStorage.getItem(backupKey) !== null) backupKey = `${prefix}.${++suffix}`;
      localStorage.setItem(backupKey, previous);
    }
    localStorage.setItem(key, raw);
  } catch { throw new Error('The research source could not be restored. Export your current workspace before retrying; no successful restore is claimed.'); }
  return { kind: attachment.kind, backupKey };
}
function entry(input: unknown): ResearchEntry {
  const raw = object(input, 'Research entry');
  const id = text(raw.id, 'Research identifier', 100, true);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new Error('A research entry has an invalid identifier.');
  const snapshotInput = object(raw.snapshot, 'Comparison snapshot');
  const sourceModelVersion = snapshotInput.modelVersion !== MODEL_VERSION
    ? snapshotInput.modelVersion : raw.sourceModelVersion ?? snapshotInput.modelVersion;
  if (sourceModelVersion !== MODEL_VERSION && sourceModelVersion !== 'biomechanics-2' && sourceModelVersion !== 'pullover-1')
    throw new Error('A research entry has an unsupported source model version.');
  return {
    ...validateResearchDraft(raw), id, createdAt: timestamp(raw.createdAt), updatedAt: timestamp(raw.updatedAt),
    sourceModelVersion, snapshot: validateState(snapshotInput),
    ...(raw.attachment !== undefined ? { attachment: validateResearchAttachment(raw.attachment) } : {}),
  };
}
export function validateResearchNotebook(input: unknown): ResearchNotebookData {
  const raw = object(input, 'Research notebook');
  if (raw.format !== 'biomechanics-research-notebook' || raw.version !== 1) throw new Error('This research notebook format or version is not supported.');
  if (!Array.isArray(raw.entries) || raw.entries.length > MAX_RESEARCH_ENTRIES)
    throw new Error(`A notebook can contain no more than ${MAX_RESEARCH_ENTRIES} entries.`);
  const entries = raw.entries.map(entry);
  if (new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('Research entries contain duplicate identifiers.');
  return { ...empty(), entries };
}
function bounded(raw: string): void {
  if (new TextEncoder().encode(raw).byteLength > MAX_RESEARCH_BYTES) throw new Error('The notebook exceeds the 2 MB limit. Export individual entries or use a smaller notebook.');
}
export function parseResearchNotebook(raw: string): ResearchNotebookData {
  bounded(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('The notebook file must contain valid JSON.'); }
  return validateResearchNotebook(parsed);
}
export function rawResearchNotebook(): string | null {
  try { return localStorage.getItem(RESEARCH_KEY); }
  catch { throw new Error('Browser storage is unavailable; the research notebook could not be opened.'); }
}
function read(): ResearchNotebookData {
  const raw = rawResearchNotebook();
  if (raw === null) return empty();
  try { return parseResearchNotebook(raw); }
  catch (error) { throw new Error(`The saved notebook could not be restored. Its original data has been kept. ${error instanceof Error ? error.message : 'Invalid data.'}`); }
}
function write(notebook: ResearchNotebookData): void {
  const validated = validateResearchNotebook(notebook);
  const raw = JSON.stringify(validated);
  bounded(raw);
  try {
    const previous = rawResearchNotebook();
    if (previous) {
      const old = parseResearchNotebook(previous);
      const original = JSON.parse(previous) as ResearchNotebookData;
      if (old.entries.some((item, index) => item.snapshot.modelVersion !== original.entries[index].snapshot.modelVersion))
        localStorage.setItem(`${RESEARCH_KEY}.model-backup.${Date.now()}`, previous);
    }
    localStorage.setItem(RESEARCH_KEY, raw);
  } catch (error) {
    throw new Error(`The notebook could not be saved. ${error instanceof Error ? error.message : 'Browser storage is unavailable.'} Your existing data has not been intentionally replaced.`);
  }
}
export function listResearchEntries(): ResearchEntry[] { return clone(read().entries); }
export function createResearchEntry(state: LabState, draft: ResearchDraft, attachment?: ResearchAttachment): ResearchEntry {
  const notebook = read();
  const now = new Date().toISOString();
  const saved = entry({ ...draft, id: newId(), createdAt: now, updatedAt: now, sourceModelVersion: state.modelVersion, snapshot: clone(state), ...(attachment ? { attachment: clone(attachment) } : {}) });
  notebook.entries.unshift(saved);
  write(notebook);
  return clone(saved);
}
export function updateResearchEntry(id: string, draft: ResearchDraft): ResearchEntry {
  const notebook = read();
  const index = notebook.entries.findIndex(item => item.id === id);
  if (index < 0) throw new Error('This research entry no longer exists. Reload the notebook.');
  const saved = { ...notebook.entries[index], ...validateResearchDraft(draft), updatedAt: new Date().toISOString() };
  notebook.entries[index] = saved;
  write(notebook);
  return clone(saved);
}
export function removeResearchEntry(id: string): ResearchEntry {
  const notebook = read();
  const removed = notebook.entries.find(item => item.id === id);
  if (!removed) throw new Error('This research entry no longer exists.');
  notebook.entries = notebook.entries.filter(item => item.id !== id);
  write(notebook);
  return clone(removed);
}
export function restoreResearchEntry(removed: ResearchEntry): ResearchEntry {
  const notebook = read();
  const restored = entry({ ...removed, id: notebook.entries.some(item => item.id === removed.id) ? newId() : removed.id });
  notebook.entries.unshift(restored);
  write(notebook);
  return clone(restored);
}
export function researchSnapshot(saved: ResearchEntry): LabState { return clone(validateState(saved.snapshot)); }
export function exportResearchNotebook(ids?: string[]): string {
  const notebook = read();
  if (ids) notebook.entries = notebook.entries.filter(item => ids.includes(item.id));
  const result = JSON.stringify(notebook, null, 2);
  bounded(result);
  return result;
}
export function importResearchNotebook(raw: string): { added: number; recalculated: number } {
  const imported = parseResearchNotebook(raw);
  const notebook = read();
  const existing = new Set(notebook.entries.map(item => item.id));
  for (const item of imported.entries) {
    if (existing.has(item.id)) item.id = newId();
    existing.add(item.id);
  }
  notebook.entries = [...imported.entries, ...notebook.entries];
  write(notebook);
  return { added: imported.entries.length, recalculated: imported.entries.filter(item => item.sourceModelVersion !== item.snapshot.modelVersion).length };
}
/** Recovery is explicit; keep a raw backup before replacing an unreadable notebook. */
export function recoverResearchNotebook(): string | null {
  const previous = rawResearchNotebook();
  if (previous === null) return null;
  const key = `${RESEARCH_KEY}.recovery.${Date.now()}`;
  try {
    localStorage.setItem(key, previous);
    localStorage.setItem(RESEARCH_KEY, JSON.stringify(empty()));
  } catch { throw new Error('Recovery could not create the backup and new notebook. Download the original data first.'); }
  return key;
}
