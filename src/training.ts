import { allExerciseEntries } from './allExercises';

export type TrainingCandidate = { preset: string; name: string };
export type TrainingMatch = {
  id: string;
  /** The original exercise cell or text line, retained without rewriting. */
  original: string;
  label: string;
  status: 'matched' | 'ambiguous' | 'unrecognized';
  candidates: TrainingCandidate[];
  selectedPreset?: string;
};

export const MAX_TRAINING_BYTES = 1_000_000;
export const MAX_TRAINING_ROWS = 1_000;

// Aliases identify supported example scenarios, not a measured equipment setup.
// Broad exercise labels deliberately remain unresolved when several models fit.
const ALIASES: Record<string, string[]> = {
  classic: ['lat prayer', 'prayer pulldown', 'straight arm pulldown', 'straight arm cable pulldown', 'conventional pullover'],
  outside: ['facing away pullover', 'standing facing away pullover', 'outside pullover'],
  inside: ['inside pullover', 'inside machine pullover', 'leaning inside pullover'],
  bench: ['bench pullover', 'bench supported pullover', 'supported cable pullover', 'incline cable pullover', '60 degree bench pullover'],
  'curl-low': ['low cable curl', 'low pulley curl', 'standing cable curl', 'front cable curl'],
  'curl-bayesian': ['bayesian curl', 'bayesian cable curl', 'behind body cable curl', 'behind the body cable curl'],
  'extension-pushdown': ['triceps pushdown', 'tricep pushdown', 'cable pushdown', 'pushdown', 'triceps pressdown', 'pressdown'],
  'extension-overhead': ['overhead triceps extension', 'overhead tricep extension', 'overhead cable extension', 'overhead cable triceps extension'],
  'raise-cable': ['cable lateral raise', 'lateral cable raise', 'cable side raise'],
  'raise-dumbbell': ['dumbbell lateral raise', 'db lateral raise', 'lateral dumbbell raise', 'dumbbell side raise'],
  'fly-cable': ['cable fly', 'cable flye', 'cable crossover', 'standing cable fly', 'cable chest fly'],
  'hip-extension': ['cable hip extension', 'cable kickback', 'glute cable kickback', 'cable glute kickback'],
  'machine-unknown': ['pullover machine', 'machine pullover'],
};
const PULLOVERS = ['classic', 'outside', 'inside', 'bench'];
const BROAD_LABELS: Record<string, string[]> = {
  pullover: PULLOVERS,
  'cable pullover': PULLOVERS,
  pull: PULLOVERS,
  curl: ['curl-low', 'curl-bayesian'],
  'biceps curl': ['curl-low', 'curl-bayesian'],
  'bicep curl': ['curl-low', 'curl-bayesian'],
  'cable curl': ['curl-low', 'curl-bayesian'],
  'lateral raise': ['raise-cable', 'raise-dumbbell'],
  'side raise': ['raise-cable', 'raise-dumbbell'],
  'triceps extension': ['extension-pushdown', 'extension-overhead'],
  'tricep extension': ['extension-pushdown', 'extension-overhead'],
  'cable triceps extension': ['extension-pushdown', 'extension-overhead'],
  press: ['extension-pushdown', 'extension-overhead'],
};

function normalize(label: string): string {
  const singulars: Record<string, string> = { curls: 'curl', raises: 'raise', extensions: 'extension', pushdowns: 'pushdown', pullovers: 'pullover', flyes: 'fly', flies: 'fly', flye: 'fly', kickbacks: 'kickback', dumbbells: 'dumbbell', cables: 'cable' };
  return label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(word => singulars[word] ?? word).join(' ');
}
const signature = (label: string) => normalize(label).split(' ').sort().join(' ');
function identifier(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `exercise-${(hash >>> 0).toString(36)}`;
}

export function matchExercise(original: string): TrainingMatch {
  if (typeof original !== 'string') throw new Error('An exercise name must be text.');
  const label = original.trim();
  const normalized = normalize(label);
  const key = signature(label);
  const broad = BROAD_LABELS[normalized] ?? Object.entries(BROAD_LABELS).find(([alias]) => signature(alias) === key)?.[1];
  let candidates: TrainingCandidate[];
  if (broad) {
    candidates = allExerciseEntries.filter(entry => {
      if (broad.includes(entry.id)) return true;
      if (['pull', 'pullover', 'cable pullover'].includes(normalized))
        return normalized === 'pull' ? /pull|row/i.test(entry.family) : /pullover/i.test(entry.family);
      if (/curl/.test(normalized)) return /elbow flexion/i.test(entry.family) && (!normalized.includes('cable') || entry.equipment.includes('Cable'));
      if (/tricep/.test(normalized)) return /elbow extension/i.test(entry.family) && (!normalized.includes('cable') || entry.equipment.includes('Cable'));
      if (normalized === 'press') return entry.family === 'Presses';
      if (/raise/.test(normalized)) return /lateral raise/i.test(entry.name);
      return false;
    }).map(({ id, name }) => ({ preset: id, name }));
  } else {
    candidates = allExerciseEntries.filter(entry => [entry.name, entry.id, ...entry.aliases, ...(ALIASES[entry.id] ?? [])]
      .some(alias => normalize(alias) === normalized || signature(alias) === key))
      .map(({ id, name }) => ({ preset: id, name }));
  }
  const status = broad ? 'ambiguous' : candidates.length === 1 ? 'matched' : candidates.length > 1 ? 'ambiguous' : 'unrecognized';
  return {
    id: identifier(original), original, label, status, candidates,
    ...(status === 'matched' ? { selectedPreset: candidates[0].preset } : {}),
  };
}

/** An explicit user selection may resolve an ambiguous or unsupported label. */
export function resolveTrainingMatch(item: TrainingMatch, presetId: string): TrainingMatch {
  const preset = allExerciseEntries.find(preset => preset.id === presetId);
  if (!preset) throw new Error('Choose an exercise from the supported catalog.');
  const candidates = item.candidates.some(candidate => candidate.preset === presetId)
    ? item.candidates.map(candidate => ({ ...candidate }))
    : [...item.candidates, { preset: preset.id, name: preset.name }];
  return { ...item, status: 'matched', selectedPreset: presetId, candidates };
}

function csvRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, afterQuote = false;
  const finishCell = () => { row.push(cell); cell = ''; afterQuote = false; };
  const finishRow = () => {
    finishCell();
    if (row.some(value => value.trim() !== '')) records.push(row);
    row = [];
    if (records.length > MAX_TRAINING_ROWS + 1) throw new Error(`Limit training imports to ${MAX_TRAINING_ROWS} exercises.`);
  };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else cell += character;
    } else if (character === delimiter) finishCell();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else if (character === '"' && cell === '' && !afterQuote) quoted = true;
    else if (afterQuote && !/\s/.test(character)) throw new Error('The CSV contains unexpected text after a quoted field.');
    else if (!afterQuote) cell += character;
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  if (cell !== '' || row.length || afterQuote) finishRow();
  return records;
}

function exerciseColumn(header: string[]): number {
  return header.findIndex(value => ['exercise', 'name', 'exercise name'].includes(normalize(value.replace(/^\uFEFF/, ''))));
}

/** Import only exercise labels: load/repetition columns do not become model assumptions. */
export function parseTraining(text: string): TrainingMatch[] {
  if (typeof text !== 'string') throw new Error('Paste a text exercise list or CSV.');
  if (new TextEncoder().encode(text).byteLength > MAX_TRAINING_BYTES)
    throw new Error('Training imports must be smaller than 1 MB.');
  if (!text.trim()) return [];

  let labels: string[] | null = null;
  // Header detection avoids interpreting a comma inside a plain exercise name as a new column.
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
  for (const delimiter of [',', ';', '\t']) {
    let header: string[];
    try { header = csvRecords(firstLine, delimiter)[0] ?? []; }
    catch { continue; } // Without a recognized header this may simply be a text label.
    const column = exerciseColumn(header);
    if (column < 0) continue;
    const records = csvRecords(text.replace(/^\uFEFF/, ''), delimiter);
    labels = records.slice(1).map((record, index) => {
      if (column >= record.length) throw new Error(`CSV row ${index + 2} is missing its exercise column.`);
      return record[column];
    }).filter(label => label.trim() !== '');
    break;
  }
  if (!labels) labels = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
  if (labels.length > MAX_TRAINING_ROWS) throw new Error(`Limit training imports to ${MAX_TRAINING_ROWS} exercises.`);
  return labels.map((label, index) => ({ ...matchExercise(label), id: `${identifier(label)}-${index + 1}` }));
}
