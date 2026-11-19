import { useId, useRef, useState } from 'react';
import { getDefinition, type Setup } from './engine';
import { catalogEntries } from './catalog';
import { type CompoundConfig } from './compoundEngine';
import { compoundExercises, compoundPairFits, jointExercises, jointPairFits } from './exercisePairs';
import './exercisePairPicker.css';

type Props = {
  onPick: (side: 0 | 1, id: string) => void;
} & ({ jointSetups: [Setup, Setup]; compoundConfigs?: never } |
     { compoundConfigs: [CompoundConfig, CompoundConfig]; jointSetups?: never });

type Choice = { id: string; name: string; group: string; aliases?: readonly string[] };
const byGroupAndName = (a: Choice, b: Choice) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name);
const jointChoice = (entry: typeof jointExercises[number]): Choice => ({ id: entry.setup.preset, name: entry.setup.name, group: entry.family, aliases: [...entry.aliases, ...entry.equipment] });
const compoundChoice = (entry: typeof compoundExercises[number]): Choice => ({ id: 'compound:' + entry.id, name: entry.name, group: entry.family, aliases: [...entry.aliases, entry.equipment] });
const allChoices = [...jointExercises.map(jointChoice), ...compoundExercises.map(compoundChoice)].sort(byGroupAndName);

function groups(options: Choice[]) {
  const result = new Map<string, Choice[]>();
  for (const option of options) {
    const group = result.get(option.group);
    if (group) group.push(option);
    else result.set(option.group, [option]);
  }
  return [...result.entries()].map(([label, group]) => <optgroup key={label} label={label}>
    {group.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
  </optgroup>);
}
const allGroups = groups(allChoices);

function searchable(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function ExerciseSelect({ side, choices, value, placeholder, hintId, extraA, onPick }: {
  side: 0 | 1; choices: Choice[]; value: string; placeholder?: string; hintId?: string;
  extraA?: Choice; onPick: Props['onPick'];
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const letter = side === 0 ? 'A' : 'B';
  const terms = searchable(query).split(' ').filter(Boolean);
  const matches = searching && terms.length ? choices.filter(choice => {
    const words = searchable([choice.name, choice.group, ...(choice.aliases ?? [])].join(' '));
    return terms.every(term => words.includes(term));
  }) : [];
  function closeSearch() {
    setSearching(false);
    setQuery('');
    button.current?.focus();
  }
  function pick(id: string) {
    if (searching) closeSearch();
    onPick(side, id);
  }
  return <div className="exercise-choice">
    <span className="pair-letter" aria-hidden="true">{letter}</span>
    <div className="pair-control">
      <div className="pair-label"><label htmlFor={id}>Exercise {letter}</label>
        <button type="button" ref={button} aria-label={`Search exercise ${letter}`} aria-expanded={searching}
          disabled={!choices.length} onClick={() => searching ? closeSearch() : setSearching(true)}>{searching ? 'Close' : 'Search'}</button>
      </div>
      <select id={id} aria-label={`Exercise ${letter}`} aria-describedby={hintId} disabled={!choices.length}
        value={value} onChange={event => pick(event.target.value)}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {extraA && <option value={extraA.id}>{extraA.name}</option>}
        {choices === allChoices ? allGroups : groups(choices)}
      </select>
    </div>
    {searching && <div className="pair-search" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }}>
      <input type="search" aria-label={`Find exercise ${letter}`} autoFocus value={query} placeholder="Exercise name or equipment"
        onChange={event => setQuery(event.target.value)}/>
      {terms.length > 0 && <div className="pair-search-results">
        {matches.slice(0, 20).map(choice => <button type="button" key={choice.id}
          onClick={() => pick(choice.id)}>{choice.name}</button>)}
        {matches.length === 0 && <span role="status">No matching exercise.</span>}
        {matches.length > 20 && <span role="status">Showing 20 of {matches.length}. Type more to narrow the list.</span>}
      </div>}
    </div>}
  </div>;
}

export function ExercisePairPicker(props: Props) {
  const hintId = useId();
  let aId: string, bId: string, bFits: boolean, options: Choice[];
  if (props.jointSetups) {
    const [a, b] = props.jointSetups;
    aId = a.preset;
    bId = b.preset;
    bFits = jointPairFits(a, b);
    options = jointExercises.filter(entry => jointPairFits(a, entry.setup)).map(jointChoice);
  } else {
    const [a, b] = props.compoundConfigs;
    aId = 'compound:' + a.preset;
    bId = 'compound:' + b.preset;
    bFits = compoundPairFits(a, b);
    options = compoundExercises.filter(entry => compoundPairFits(a, entry)).map(compoundChoice);
  }
  const listedA = allChoices.find(entry => entry.id === aId);
  const geometryOnly = props.jointSetups && catalogEntries.some(entry => entry.setup.preset === aId && entry.status === 'Geometry only');
  if (geometryOnly) options = [];
  const currentA = listedA ?? (props.jointSetups && !geometryOnly && jointPairFits(props.jointSetups[0], props.jointSetups[0])
    ? { id: aId, name: props.jointSetups[0].name, group: getDefinition(props.jointSetups[0]).family } : undefined);
  // A customized plane or range may no longer match its preset defaults.
  // The current variant can still be duplicated and adjusted independently.
  if (currentA && !options.some(entry => entry.id === aId)) options.push(currentA);
  const currentB = allChoices.find(entry => entry.id === bId) ?? (props.jointSetups && bFits
    ? { id: bId, name: props.jointSetups[1].name, group: getDefinition(props.jointSetups[1]).family } : undefined);
  if (!geometryOnly && bFits && currentB && !options.some(entry => entry.id === bId)) options.push(currentB);
  const activeB = bFits && options.some(entry => entry.id === bId) ? bId : '';
  return <section className="exercise-pair-picker" aria-label="Choose exercises">
    <ExerciseSelect side={0} choices={allChoices} value={aId} onPick={props.onPick}
      extraA={listedA ? undefined : { id: aId, name: props.jointSetups?.[0].name ?? 'Current exercise', group: '' }}/>
    <ExerciseSelect side={1} choices={options.sort(byGroupAndName)} value={activeB} onPick={props.onPick} hintId={hintId}
      placeholder={activeB ? undefined : options.length ? 'Choose a compatible exercise' : 'Choose a modeled exercise in A'}/>
    <small className="pair-hint" id={hintId}>{activeB ? 'B lists compatible exercises. Pick the same exercise twice to compare setups.' :
      options.length ? 'The current pair uses different movement coordinates or ranges. Choose B to compare.' :
      'This exercise needs a defined resistance model for a comparison.'}</small>
  </section>;
}
