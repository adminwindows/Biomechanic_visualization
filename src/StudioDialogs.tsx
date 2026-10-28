import { useEffect, useRef, useState, type ReactNode } from 'react';
import { allExerciseEntries } from './allExercises';

export function StudioDialog({ open, title, children, onClose, className = '' }: { open: boolean; title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const first = dialog.querySelector<HTMLDetailsElement>('details.workspace-drawer');
      if (first) first.open = true;
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={`studio-dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box=event.currentTarget.getBoundingClientRect(); if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose(); } }}>
    <header className="dialog-heading"><div><span className="overline">BIOMECHANICS LAB</span><h2>{title}</h2></div><button className="dialog-close" aria-label={`Close ${title}`} onClick={onClose}>×</button></header>
    <div className="dialog-content">{children}</div>
  </dialog>;
}

type Command = { id: string; label: string; detail: string; run: () => void };
export function CommandPalette({ open, onClose, commands, onExercise }: { open: boolean; onClose: () => void; commands: Command[]; onExercise: (side: 0 | 1, id: string) => void }) {
  const [query, setQuery] = useState('');
  const [side, setSide] = useState<0 | 1>(0);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQuery(''); setIndex(0); requestAnimationFrame(() => input.current?.focus()); } }, [open]);
  const needle = query.toLowerCase().trim();
  const actions = commands.filter(command => `${command.label} ${command.detail}`.toLowerCase().includes(needle));
  const exercises: Command[] = needle ? allExerciseEntries.filter(entry => `${entry.name} ${entry.family} ${entry.aliases.join(' ')}`.toLowerCase().includes(needle)).slice(0, 12).map(entry => ({ id: entry.id, label: entry.name, detail: `${entry.family} · ${entry.status} · open in ${side ? 'B' : 'A'}`, run: () => onExercise(side, entry.id) })) : [];
  const options = [...actions, ...exercises];
  const pick = (command: Command) => { onClose(); command.run(); };
  return <StudioDialog open={open} title="Find a tool or exercise" onClose={onClose} className="command-dialog">
    <div className="command-input-row"><input ref={input} type="search" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-label="Search tools and exercises" placeholder="Try ‘pullover’, ‘calibrate’, or ‘backup’" value={query} onChange={event => { setQuery(event.target.value); setIndex(0); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(previous => Math.min(options.length - 1, previous + 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(previous => Math.max(0, previous - 1)); } if (event.key === 'Enter' && options[index]) { event.preventDefault(); pick(options[index]); } }} aria-controls="command-results" aria-activedescendant={options[index] ? `command-${index}` : undefined}/><label>Open in<select aria-label="Command exercise target" value={side} onChange={event => setSide(Number(event.target.value) as 0 | 1)}><option value={0}>A</option><option value={1}>B</option></select></label></div>
    <div id="command-results" className="command-results" role="listbox" aria-label="Matching tools and exercises">{options.map((command, i) => <button id={`command-${i}`} key={command.id} role="option" aria-selected={index === i} onMouseEnter={() => setIndex(i)} onClick={() => pick(command)}><span>{command.label}<small>{command.detail}</small></span><span aria-hidden="true">↗</span></button>)}{!options.length && <p>No match. Try the movement family or equipment name.</p>}</div>
    <p className="command-hint"><kbd>↑</kbd><kbd>↓</kbd> to navigate <kbd>Enter</kbd> to open <kbd>Esc</kbd> to close</p>
  </StudioDialog>;
}
