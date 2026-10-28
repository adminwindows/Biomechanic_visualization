import { catalogEntries, type CatalogFilters } from './catalog';
import { compoundPresets, type CompoundPreset } from './compoundEngine';

export type ExerciseEntry = {
  id: string; name: string; source: 'isolated' | 'compound'; family: string;
  aliases: readonly string[]; muscleGroups: readonly string[]; equipment: readonly string[];
  mainJoint: string; postures: readonly string[]; laterality: string; status: string; explanation: string;
};
const compoundMuscles: Record<string, string[]> = {
  'Vertical pulls': ['Lats / upper back', 'Biceps / elbow flexors'],
  'Horizontal pulls': ['Lats / upper back', 'Biceps / elbow flexors'],
  'Rear delts': ['Deltoids', 'Lats / upper back'],
  Presses: ['Chest / pectorals', 'Deltoids', 'Triceps'],
  'Hip extension': ['Glutes / hip extensors'],
  'Squats and lunges': ['Quadriceps', 'Glutes / hip extensors'],
  Calves: ['Calves'], Trunk: ['Trunk'], 'Coupled pullover': ['Lats / upper back'],
};
/** Navigation tags describe each declared starting support, not inferred balance. */
function compoundPostures(preset: CompoundPreset): string[] {
  const special: Record<string, string[]> = {
    'pullover-coupled': ['Seated', 'Torso supported'],
    'pulldown-unilateral': ['Kneeling'],
    'row-supported': ['Lying', 'Prone', 'Bench supported'],
    'row-seated': ['Seated'], 'high-row': ['Seated'],
    'row-machine': ['Seated', 'Machine supported'],
    'row-barbell': ['Standing', 'Forward lean'], 'row-tbar': ['Standing', 'Forward lean'],
    'bench-barbell': ['Lying', 'Supine', 'Bench supported'],
    'bench-dumbbell': ['Lying', 'Supine', 'Bench supported'],
    'bench-incline': ['Lying', 'Supine', 'Bench supported'],
    'bench-decline': ['Lying', 'Supine', 'Bench supported'],
    'shoulder-press': ['Seated', 'Bench supported'], 'cable-press-seated': ['Seated'],
    'press-machine': ['Seated', 'Machine supported'],
    'hip-thrust': ['Supine', 'Bench supported', 'Foot and shoulder supported'],
    'glute-bridge': ['Lying', 'Supine', 'Floor supported'],
    'crunch-cable': ['Kneeling'], 'crunch-machine': ['Seated', 'Machine supported'],
  };
  if (special[preset.id]) return special[preset.id];
  switch (preset.movement) {
    case 'pulldown': return ['Seated'];
    case 'pullup': return ['Hanging', 'Hand supported'];
    case 'dip': return ['Suspended', 'Hand supported'];
    case 'pushup': return ['Prone', 'Hand and foot supported'];
    case 'nordic': return ['Kneeling', 'Ankle supported'];
    case 'back-extension': return ['Prone', 'Hip supported'];
    case 'leg-press': return ['Seated', 'Reclined', 'Machine supported'];
    case 'calf-seated': return ['Seated'];
    case 'lunge': return ['Standing', 'Split stance'];
    case 'step-up': return ['Standing', 'Elevated foot support'];
    case 'hinge': return ['Standing', 'Forward lean'];
    case 'squat': return ['Standing', 'Squatting'];
    case 'row': case 'press': case 'face-pull': case 'calf-standing':
    case 'woodchop': case 'pallof': case 'sidebend': return ['Standing'];
    default: return ['Prescribed movement'];
  }
}
export const allExerciseEntries: ExerciseEntry[] = [
  ...catalogEntries.map(entry => ({
    id: entry.setup.preset, name: entry.setup.name, source: 'isolated' as const,
    family: entry.family, aliases: entry.aliases, muscleGroups: entry.muscleGroups,
    equipment: entry.equipment, mainJoint: entry.mainJoint, postures: entry.postures,
    laterality: entry.laterality, status: entry.status,
    explanation: entry.status === 'Geometry only' ? 'Mechanism data required for resistance calculations.' : 'External mechanics about the declared joint or movement coordinate.',
  })),
  ...compoundPresets.map(preset => ({
    id: `compound:${preset.id}`, name: preset.name, source: 'compound' as const,
    family: preset.family, aliases: preset.aliases, muscleGroups: compoundMuscles[preset.family] ?? ['Movement chain'],
    equipment: [...new Set([preset.equipment, ...(/cable/i.test(preset.equipment) ? ['Cable'] : []), ...(/dumbbell/i.test(preset.equipment) ? ['Dumbbell'] : []), ...(/barbell/i.test(preset.equipment) ? ['Barbell'] : []), ...(preset.mechanics === 'unknown' ? ['Dedicated machine'] : [])])],
    mainJoint: 'Multiple joints', postures: compoundPostures(preset), laterality: preset.defaults.unilateral ? 'Unilateral' : 'Bilateral',
    status: preset.mechanics === 'unknown' ? 'Geometry only' : preset.mechanics === 'open-arm' ? 'External mechanics' : 'Prescribed path mechanics', explanation: preset.note,
  })),
];
export function normalizeExerciseText(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function matchesExercise(entry: ExerciseEntry, query: string, filters: CatalogFilters): boolean {
  if (filters.muscleGroup !== 'all' && !entry.muscleGroups.includes(filters.muscleGroup)) return false;
  if (filters.equipment !== 'all' && !entry.equipment.includes(filters.equipment)) return false;
  if (filters.mainJoint !== 'all' && entry.mainJoint !== filters.mainJoint) return false;
  if (filters.posture !== 'all' && !entry.postures.includes(filters.posture)) return false;
  if (filters.laterality !== 'all' && entry.laterality !== filters.laterality) return false;
  if (filters.status !== 'all' && entry.status !== filters.status) return false;
  const haystack = normalizeExerciseText([entry.name, entry.family, ...entry.aliases, ...entry.muscleGroups, ...entry.equipment, entry.mainJoint, ...entry.postures, entry.laterality, entry.status].join(' '));
  return normalizeExerciseText(query).split(' ').filter(Boolean).every(term => haystack.includes(term));
}
