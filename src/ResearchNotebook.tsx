import { useEffect, useRef, useState } from 'react';
import { type LabState } from './state';
import { WORKSPACE_FLUSH_EVENT, flushWorkspaceEdits } from './workspaceBackup';
import {
  MAX_RESEARCH_BYTES, RESEARCH_CLASSIFICATIONS,
  createResearchEntry, exportResearchNotebook, importResearchNotebook, listResearchEntries,
  rawResearchNotebook, recoverResearchNotebook, removeResearchEntry, researchSnapshot,
  restoreResearchEntry, updateResearchEntry, captureResearchAttachment, restoreResearchAttachment,
  type ResearchDraft, type ResearchEntry, type ResearchSource,
} from './researchNotebook';
import './research-notebook.css';

const blank = (state: LabState): ResearchDraft => ({
  title: state.name || 'Untitled comparison', classification: 'hypothesis',
  hypothesis: state.criterion ?? '', observation: '', citations: [],
});
const message = (error: unknown) => error instanceof Error ? error.message : 'The notebook action could not be completed.';
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ResearchNotebook({ state, onApply, onResearchRestore }: { state: LabState; onApply: (next: LabState) => void; onResearchRestore?: (source: 'compound' | 'machine') => void }) {
  const [initial] = useState(() => {
    try { return { entries: listResearchEntries(), error: '' }; }
    catch (error) { return { entries: [] as ResearchEntry[], error: message(error) }; }
  });
  const [entries, setEntries] = useState(initial.entries);
  const [storageError, setStorageError] = useState(initial.error);
  const [notice, setNotice] = useState(initial.error);
  const [draft, setDraft] = useState<ResearchDraft>(() => blank(state));
  const [editing, setEditing] = useState<string | null>(null);
  const [cleanDraft, setCleanDraft] = useState<ResearchDraft>(() => blank(state));
  const [source, setSource] = useState<ResearchSource>('joint');
  const [cleanSource, setCleanSource] = useState<ResearchSource>('joint');
  const capturing = useRef(false);
  const dirty = source !== cleanSource || JSON.stringify(draft) !== JSON.stringify(cleanDraft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const flush = (event: Event) => {
      if (!dirtyRef.current || capturing.current) return;
      const detail = (event as CustomEvent<{ errors: string[] }>).detail;
      const warning = 'Research notebook has an unsaved note. Open Find a setup & research, then save it or discard the draft before exporting or reloading the workspace.';
      if (Array.isArray(detail?.errors)) detail.errors.push(warning);
      setNotice(warning);
    };
    window.addEventListener(WORKSPACE_FLUSH_EVENT, flush);
    return () => window.removeEventListener(WORKSPACE_FLUSH_EVENT, flush);
  }, []);
  const replaceDraft = (next: ResearchDraft, nextSource: ResearchSource = source) => { setDraft(next); setCleanDraft(structuredClone(next)); setSource(nextSource); setCleanSource(nextSource); };
  const [removed, setRemoved] = useState<ResearchEntry | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => setEntries(listResearchEntries());
  const action = (run: () => void) => { try { run(); } catch (error) { setNotice(message(error)); } };
  const patch = (change: Partial<ResearchDraft>) => setDraft(previous => ({ ...previous, ...change }));
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_RESEARCH_BYTES) throw new Error('Choose a research notebook smaller than 2 MB.');
      const result = importResearchNotebook(await file.text());
      refresh();
      setNotice(`Imported ${result.added} ${result.added === 1 ? 'entry' : 'entries'} without replacing saved notes.${result.recalculated ? ` ${result.recalculated} snapshots were recalculated with the current model; source model versions are retained.` : ''}`);
    } catch (error) { setNotice(`Import failed: ${message(error)}`); }
    if (input.current) input.current.value = '';
  }
  return <details className="research-notebook" id="research-notebook">
    <summary>Hypotheses, observations & evidence <span>{entries.length} saved {entries.length === 1 ? 'note' : 'notes'}</span></summary>
    <div className="research-content">
      <p>Save a question or conclusion with the exact comparison that produced it. Choose the joint, compound or machine workspace to capture its exact settings, coordinates and model provenance. Joint and compound snapshots retain body measurements; machine snapshots retain measured data and conversion assumptions. Editing a note leaves that snapshot unchanged.</p>
      <p className="research-muted">A citation or a mechanical difference is not evidence of greater muscle growth. For training studies, record the population, duration, protocol, growth measurement and uncertainty relevant to your claim.</p>
      <div className="research-actions">
        <button type="button" disabled={!entries.length} onClick={() => action(() => download(exportResearchNotebook(), 'biomechanics-research-notebook.json'))}>Export notebook</button>
        <button type="button" onClick={() => input.current?.click()}>Import notebook</button>
        <input hidden ref={input} type="file" accept=".json,application/json" aria-label="Import research notebook file" onChange={event => void importFile(event.target.files?.[0])}/>
        {removed && <button type="button" onClick={() => action(() => {
          restoreResearchEntry(removed); setRemoved(null); refresh(); setNotice('Deleted research note restored.');
        })}>Undo last note deletion</button>}
      </div>
      {notice && <p role="status" className="research-notice">{notice}</p>}
      {storageError && <div className="research-recovery">
        <p>The existing notebook is protected. Download the original before attempting recovery.</p>
        <div className="research-actions">
          <button type="button" onClick={() => action(() => {
            const raw = rawResearchNotebook();
            if (raw !== null) download(raw, 'biomechanics-research-original.json');
          })}>Download original notebook data</button>
          <button type="button" onClick={() => action(() => {
            const key = recoverResearchNotebook(); refresh(); setStorageError('');
            setNotice(key ? 'An untouched browser backup was saved and a new notebook started. Keep your downloaded copy too.' : 'A new notebook is ready.');
          })}>Back up original & start new notebook</button>
        </div>
      </div>}
      <form className="research-form" onSubmit={event => {
        event.preventDefault(); action(() => {
          if (editing) updateResearchEntry(editing, draft);
          else {
            capturing.current = true;
            try {
              flushWorkspaceEdits();
              createResearchEntry(state, draft, source === 'joint' ? undefined : captureResearchAttachment(source));
            } finally { capturing.current = false; }
          }
          refresh(); setEditing(null); replaceDraft(blank(state));
          setNotice(editing ? 'Research note updated; its original comparison snapshot was retained.' : `Research note saved with a ${source} comparison snapshot.`);
        });
      }}>
        <h4>{editing ? 'Edit saved note' : 'Record the current comparison'}</h4>
        {dirty && <p className="research-muted">Unsaved draft: save or discard it before whole-workspace export, restore or an app update. Navigating between workspaces keeps this draft open.</p>}
        <label>Snapshot source<select aria-label="Research snapshot source" value={source} disabled={!!editing} onChange={event => setSource(event.target.value as ResearchSource)}>
          <option value="joint">Joint & exercise comparison</option><option value="compound">Compound movements comparison</option><option value="machine">Machines & measured profiles comparison</option>
        </select></label>
        {!editing && <p className="research-muted">{source === 'joint' ? `Snapshot to save: ${state.name || 'Untitled comparison'} · ${state.modelVersion} · A ${state.setups[0].name} / B ${state.setups[1].name}` : `The latest ${source} comparison will be captured when you save. Open and configure that workspace first; apply any measured-curve edits before saving a note. The current joint comparison is also retained as context.`}</p>}
        {editing && <p className="research-muted">The original {source} source snapshot is retained when you edit this note.</p>}
        <label>Note title<input aria-label="Research note title" value={draft.title} maxLength={160} required onChange={event => patch({ title: event.target.value })}/></label>
        <label>Type of conclusion<select aria-label="Research evidence category" value={draft.classification} onChange={event => patch({ classification: event.target.value as ResearchDraft['classification'] })}>
          {Object.entries(RESEARCH_CLASSIFICATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Question and hypothesis<textarea aria-label="Research question and hypothesis" placeholder="Objective, proposed explanation, changed variables, assumptions and data still needed." rows={3} maxLength={10000} value={draft.hypothesis} onChange={event => patch({ hypothesis: event.target.value })}/></label>
        <label>Finding, observation and limitations<textarea aria-label="Research finding and limitations" placeholder="What did the comparison establish? Record limitations, conclusion and the next measurement or test." rows={3} maxLength={10000} value={draft.observation} onChange={event => patch({ observation: event.target.value })}/></label>
        <p className="research-muted">{draft.classification === 'study' ? 'Study results require a citation. Record what was actually measured; a link does not verify the claim automatically.' : draft.classification === 'observation' ? 'Comfort and stability observations describe your experience; they are not measurements of muscle recruitment or injury risk.' : 'Keep model calculations, estimates, observations and hypotheses distinct. No study findings are supplied automatically.'}</p>
        <div className="research-citations">
          <h4>Citations and their scope</h4>
          {draft.citations.map((citation, index) => <fieldset key={index}>
            <legend>Citation {index + 1}</legend>
            <label>Source title<input aria-label={`Research citation ${index + 1} title`} value={citation.title} maxLength={200} required onChange={event => patch({ citations: draft.citations.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })}/></label>
            <label>Source URL<input aria-label={`Research citation ${index + 1} URL`} value={citation.url} type="url" maxLength={2000} required placeholder="https://…" onChange={event => patch({ citations: draft.citations.map((item, i) => i === index ? { ...item, url: event.target.value } : item) })}/></label>
            <label>What this source supports and does not establish<textarea aria-label={`Research citation ${index + 1} scope`} placeholder="For a study: population, duration, movement and range, volume/effort, outcome measurement, uncertainty and limits on applying the result." rows={2} maxLength={5000} value={citation.note} onChange={event => patch({ citations: draft.citations.map((item, i) => i === index ? { ...item, note: event.target.value } : item) })}/></label>
            <button type="button" onClick={() => patch({ citations: draft.citations.filter((_, i) => i !== index) })}>Remove citation {index + 1}</button>
          </fieldset>)}
          <button type="button" disabled={draft.citations.length >= 20} onClick={() => patch({ citations: [...draft.citations, { title: '', url: '', note: '' }] })}>Add citation</button>
        </div>
        <div className="research-actions">
          <button type="submit" disabled={!!storageError}>{editing ? 'Save note edits' : 'Save note & comparison snapshot'}</button>
          {(editing || dirty) && <button type="button" onClick={() => { setEditing(null); replaceDraft(blank(state)); setNotice('Draft discarded; saved notes are unchanged.'); }}>{dirty ? 'Discard research draft' : 'Cancel note editing'}</button>}
        </div>
      </form>
      <div className="research-entries">
        {!entries.length && <p className="research-muted">No notes saved yet. Start with a question, make a controlled comparison, then record the calculation separately from your training hypothesis.</p>}
        {entries.map(saved => <article key={saved.id} className="research-entry">
          <h4>{saved.title}</h4>
          <p className="research-category">{RESEARCH_CLASSIFICATIONS[saved.classification]}</p>
          <p className="research-muted">Saved {new Date(saved.createdAt).toLocaleDateString()} · {saved.attachment ? 'Joint context model' : 'Source model'} {saved.sourceModelVersion}{saved.sourceModelVersion !== saved.snapshot.modelVersion ? ` · snapshot recalculated as ${saved.snapshot.modelVersion}` : ''}</p>
          {saved.attachment && <p className="research-snapshot">{saved.attachment.kind === 'compound' ? `Compound comparison: ${saved.attachment.snapshot.name} · ${saved.attachment.snapshot.modelVersion}` : `Machine comparison: A ${saved.attachment.snapshot.profiles[0].name} / B ${saved.attachment.snapshot.profiles[1].name} · schema ${saved.attachment.snapshot.version}`}</p>}
          <p className="research-snapshot">{saved.attachment && 'Joint context: '}{saved.snapshot.name || 'Untitled comparison'}: A {saved.snapshot.setups[0].name} / B {saved.snapshot.setups[1].name}</p>
          {saved.snapshot.criterion && <p><strong>Comparison criterion:</strong> {saved.snapshot.criterion}</p>}
          {saved.hypothesis && <p className="research-preserve"><strong>Question/hypothesis:</strong> {saved.hypothesis}</p>}
          {saved.observation && <p className="research-preserve"><strong>Finding/limitations:</strong> {saved.observation}</p>}
          {!!saved.citations.length && <ul>{saved.citations.map((citation, index) => <li key={index}><a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a>{citation.note && <p className="research-preserve">{citation.note}</p>}</li>)}</ul>}
          <div className="research-actions">
            <button type="button" onClick={() => action(() => {
              flushWorkspaceEdits();
              if (saved.attachment) {
                const result = restoreResearchAttachment(saved.attachment);
                setNotice(`Restored the ${result.kind} comparison.${result.backupKey ? ' Its previous contents were backed up in this browser.' : ''}`);
                if (onResearchRestore) onResearchRestore(result.kind); else window.location.reload();
              } else { onApply(researchSnapshot(saved)); setNotice(`Restored “${saved.snapshot.name || saved.title}” from this note's snapshot.`); }
            })}>{saved.attachment ? `Restore ${saved.attachment.kind} comparison` : 'Restore comparison'}</button>
            <button type="button" onClick={() => {
              if (dirty) { setNotice('Save or discard the current research draft before editing another note.'); return; }
              setEditing(saved.id); replaceDraft({ title: saved.title, classification: saved.classification, hypothesis: saved.hypothesis, observation: saved.observation, citations: structuredClone(saved.citations) }, saved.attachment?.kind ?? 'joint');
              setNotice('Editing this note; the original comparison snapshot will be retained.');
            }}>Edit note</button>
            <button type="button" onClick={() => action(() => download(exportResearchNotebook([saved.id]), 'biomechanics-research-entry.json'))}>Export note</button>
            <button type="button" onClick={() => action(() => {
              if (editing === saved.id && dirty) { setNotice('Save or discard this note’s edits before deleting the saved note.'); return; }
              setRemoved(removeResearchEntry(saved.id)); refresh();
              if (editing === saved.id) { setEditing(null); replaceDraft(blank(state)); }
              setNotice('Research note deleted. Undo is available until another note is deleted.');
            })}>Delete note</button>
          </div>
        </article>)}
      </div>
      <p className="research-muted">Methods references: <a href="https://openstax.org/books/university-physics-volume-1/pages/10-6-torque" target="_blank" rel="noreferrer">OpenStax: torque</a> · <a href="https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619" target="_blank" rel="noreferrer">OpenSim: assumptions for muscle-force estimation</a>. These explain modeling methods; they do not establish a hypertrophy ranking for your comparison.</p>
    </div>
  </details>;
}
