import { useEffect, useRef, useState } from 'react';
import { forceValue, type LabState } from './state';
import { compatible, getDefinition } from './engine';
import { comparisonDifferences } from './analysis';
import {
  STUDY_PARAMETERS, applyStudyProposal, availableStudyParameters, buildStudyPlan,
  interpretStudyQuestion, parseStudyProposal, reviewStudyProposal, studyBasis, studyExchange,
  type ExchangeSelection, type StudyGoal, type StudyParameter, type StudyPlan, type StudyReview,
} from './studyAssistant';
import { WORKSPACE_FLUSH_EVENT } from './workspaceBackup';
import './study-assistant.css';

type Props = { state: LabState; onApply: (next: LabState) => void };
const goals: Record<StudyGoal, string> = { 'test-change': 'Test one specified change', 'increase-mean': 'Higher mean external resistance', 'reduce-mean': 'Lower mean external resistance', evenness: 'More even external resistance' };
const fmt = (value: number | null, unit = '') => value === null ? 'Unavailable' : Number(value.toFixed(2)) + (unit ? ' ' + unit : '');
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The study could not be prepared.';
function download(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StudyAssistant({ state, onApply }: Props) {
  const available = availableStudyParameters(state.setups[0]);
  const [question, setQuestion] = useState('How does lowering the pulley by 10 cm change resistance at the same body, load and movement range?');
  const [parameter, setParameter] = useState<StudyParameter>(available[0] ?? 'pulleyHeight');
  const selectedParameter = available.includes(parameter) ? parameter : available[0];
  const [goal, setGoal] = useState<StudyGoal>('test-change');
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [step, setStep] = useState(String(STUDY_PARAMETERS[available[0] ?? 'pulleyHeight'].step));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [review, setReview] = useState<StudyReview | null>(null);
  const [reviewRevision, setReviewRevision] = useState('');
  const [reviewDraftSignature, setReviewDraftSignature] = useState('');
  const [planDraftSignature, setPlanDraftSignature] = useState('');
  const [reviewSource, setReviewSource] = useState<'local' | 'external'>('local');
  const [selection, setSelection] = useState<ExchangeSelection>({ question: true, setup: false, body: false, results: false });
  const [exchange, setExchange] = useState('');
  const [exchangeRevision, setExchangeRevision] = useState('');
  const [proposalText, setProposalText] = useState('');
  const draft = { question, parameter, goal, direction, step, selection, proposalText };
  const draftSignature = JSON.stringify(draft);
  const [cleanDraft, setCleanDraft] = useState(draftSignature);
  const dirty = draftSignature !== cleanDraft, dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const flush = (event: Event) => {
      if (!dirtyRef.current) return;
      const warning = 'Study planner has an unsaved draft. Open Study planner, then export its draft, apply a reviewed proposal or discard the changes before workspace export or reload.';
      const detail = (event as CustomEvent<{ errors: string[] }>).detail;
      if (Array.isArray(detail?.errors)) detail.errors.push(warning);
      setNotice(warning);
    };
    window.addEventListener(WORKSPACE_FLUSH_EVENT, flush);
    return () => window.removeEventListener(WORKSPACE_FLUSH_EVENT, flush);
  }, []);
  const file = useRef<HTMLInputElement>(null), contextBox = useRef<HTMLTextAreaElement>(null);
  const revision = JSON.stringify(state), stale = !!review && (reviewRevision !== revision || reviewDraftSignature !== draftSignature);
  const exchangeStale = !!exchange && exchangeRevision !== JSON.stringify([studyBasis(state), question, selection]);
  const definition = getDefinition(state.setups[0]);
  const differences = comparisonDifferences(state).filter(row => row.different);
  function selectReview(candidate: StudyReview, source: 'local' | 'external', capturedDraft = draftSignature) { setReview(candidate); setReviewRevision(revision); setReviewDraftSignature(capturedDraft); setReviewSource(source); }
  function interpret() {
    const parsed = interpretStudyQuestion(question, state); setNotice(parsed.explanation);
    if (parsed.request) { setParameter(parsed.request.parameter); setGoal(parsed.request.goal); setDirection(parsed.request.direction); setStep(String(parsed.request.step)); }
  }
  async function calculate() {
    if (!selectedParameter) return;
    setBusy(true); setNotice(''); setReview(null); setPlan(null);
    try {
      const result = await buildStudyPlan(state, { question, parameter: selectedParameter, step: Number(step), direction, goal });
      setPlan(result); setPlanDraftSignature(draftSignature);
      if (result.selected) selectReview(result.selected, 'local');
      else setNotice('No neighbouring proposal met the selected calculation and full-range checks. Inspect the candidates or resolve missing measurements; no numerical winner is claimed.');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  async function reviewImport(text = proposalText) {
    setBusy(true); setNotice(''); setReview(null); setPlan(null);
    try {
      const proposal = parseStudyProposal(text, state);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      selectReview(reviewStudyProposal(state, proposal), 'external', JSON.stringify({ ...draft, proposalText: text }));
      setNotice('The imported proposal is validated and recalculated below. Its explanation remains an external hypothesis; nothing has been applied.');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  const reviewedDefinition = review ? getDefinition(review.next.setups[0]) : definition;
  return <section className="study-assistant" aria-label="Study assistant">
    <header className="study-heading"><p className="study-kicker">FROM A QUESTION TO A CONTROLLED COMPARISON</p><h2>Plan a study</h2><p>A local, deterministic planner for the current joint/exercise model. It works offline and calculates proposals with the same mechanics engine as the comparison. It is not an LLM or connected AI chat.</p></header>
    <div className="study-baseline"><div><strong>Baseline A · {state.setups[0].name}</strong><span>{definition.angleLabel} · {definition.angleUnit} → {definition.unit}</span></div><div><strong>{forceValue(state.setups[0]) === null ? 'Actual force unknown' : fmt(forceValue(state.setups[0]), 'N') + ' per attachment'}</strong><span>{state.setups[0].range.join('–')}{definition.angleUnit} original movement range</span></div></div>
    <details className="study-audit"><summary>Check the existing comparison · {differences.length} listed differences</summary><p>{compatible(...state.setups) ? 'A and B use compatible coordinate definitions.' : 'A and B have incompatible coordinate definitions; a direct numerical delta is not supported.'} A new controlled study copies A into B, including its body and load, before making the stated change. This replaces the previous B.</p>{differences.length > 1 && <p>Several settings currently differ. The existing result cannot identify the effect of just one of them.</p>}<ul>{differences.map(row => <li key={row.category + '-' + row.label}>{row.label}: {row.a} → {row.b}</li>)}</ul></details>
    {!available.length && <p className="study-message">A has an unknown mechanism or resistance route. Define its mechanism or supply machine measurements in the machine workspace before proposing a quantitative geometry study. This planner does not invent the missing transmission.</p>}
    <div className="study-layout">
      <section className="study-card" aria-label="Local study planner"><h3>1. Define the experiment</h3><label>Your question<textarea aria-label="Study question" rows={3} maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)}/></label><button type="button" onClick={interpret} disabled={!available.length || busy}>Interpret question locally</button><p className="study-help">Recognizes geometry words such as pulley, distance, inclination, elbow bend and movement plane. Review the interpretation; general training questions need a more specific mechanical variable.</p>
        <div className="study-fields"><label>Variable<select aria-label="Study variable" value={selectedParameter ?? ''} disabled={!available.length || busy} onChange={event => { const value = event.target.value as StudyParameter; setParameter(value); setStep(String(STUDY_PARAMETERS[value].step)); }}>{available.map(key => <option key={key} value={key}>{STUDY_PARAMETERS[key].label}</option>)}</select></label><label>Mechanical goal<select aria-label="Study mechanical goal" value={goal} onChange={event => setGoal(event.target.value as StudyGoal)}>{Object.entries(goals).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Change amount ({selectedParameter ? STUDY_PARAMETERS[selectedParameter].unit : 'SI'})<input aria-label="Study change amount" type="number" min="0.0001" step="any" value={step} onChange={event => setStep(event.target.value)}/></label><label>Direction<select aria-label="Study change direction" value={direction} disabled={goal !== 'test-change'} onChange={event => setDirection(Number(event.target.value) as 1 | -1)}><option value={-1}>Decrease</option><option value={1}>Increase</option></select></label></div>
        <p className="study-help">Goals comparing resistance evaluate both neighbouring values. Body, actual-force inputs, load convention and original ROM remain fixed. A higher mean is a mechanical objective, not a training recommendation.</p><button className="study-primary" type="button" disabled={busy || !available.length} onClick={() => void calculate()}>{busy ? 'Calculating…' : 'Calculate study preview'}</button>
      </section>
      <section className="study-card study-exchange" aria-label="Manual AI exchange"><h3>Manual AI exchange</h3><p>Use an external assistant yourself, then bring back a proposal for local review. This app sends nothing and has no API-key or chat connection.</p><fieldset><legend>Choose additional context to share</legend>{([['question', 'Question text'], ['setup', 'A setup, equipment and load settings'], ['body', 'A body dimensions, provenance and locks'], ['results', 'A calculated region summary and actual force']] as const).map(([key, label]) => <label className="study-check" key={key}><input type="checkbox" checked={selection[key]} onChange={event => setSelection(previous => ({ ...previous, [key]: event.target.checked }))}/>{label}</label>)}</fieldset><p className="study-help">Always includes the current model definition, permitted parameter names/global bounds and an opaque baseline revision marker. Excludes B, saved libraries, notes and any unchecked context. Preview the exact text before copying or downloading.</p><button type="button" onClick={() => { try { setExchange(studyExchange(state, question, selection)); setExchangeRevision(JSON.stringify([studyBasis(state), question, selection])); setNotice('Exchange preview prepared. Review its selected context before copying or downloading.'); } catch (error) { setNotice(errorText(error)); } }}>Prepare exchange preview</button>
        {exchange && <><label>Exact context, prompt and response schema<textarea ref={contextBox} aria-label="AI exchange preview" readOnly rows={10} value={exchange}/></label>{exchangeStale && <p className="study-message">Context or selections changed. Prepare a fresh preview before sharing it.</p>}<div className="assistant-actions"><button type="button" disabled={exchangeStale} onClick={async () => { try { await navigator.clipboard.writeText(exchange); setNotice('Selected exchange text copied. Paste it into your chosen assistant.'); } catch { contextBox.current?.focus(); contextBox.current?.select(); setNotice('Clipboard access is unavailable. The preview is selected for manual copying.'); } }}>Copy selected context</button><button type="button" disabled={exchangeStale} onClick={() => download(exchange, 'biomechanics-ai-exchange.txt', 'text/plain')}>Download selected context</button></div></>}
        <details className="study-import"><summary>Review a proposal returned by an assistant</summary><p>The response must match the schema in the exchange: one allowed numerical geometry change, targeting B, with the current revision marker. Model, force, body, ROM, arbitrary fields and code are rejected. Imported rationale is an unverified hypothesis.</p><label>Response JSON<textarea aria-label="Study proposal JSON" rows={7} maxLength={100000} value={proposalText} onChange={event => setProposalText(event.target.value)} placeholder='{"format":"biomechanics-study-proposal",…}'/></label><div className="assistant-actions"><button type="button" disabled={busy || !proposalText.trim()} onClick={() => void reviewImport()}>Validate & recalculate proposal</button><button type="button" disabled={busy} onClick={() => file.current?.click()}>Import proposal JSON</button><input hidden ref={file} type="file" accept=".json,application/json" aria-label="Import study proposal file" onChange={async event => { const selected = event.target.files?.[0]; if (!selected) return; if (selected.size > 100000) { setNotice('Choose a proposal smaller than 100 kB.'); return; } const text = await selected.text(); setProposalText(text); await reviewImport(text); event.target.value = ''; }}/></div></details>
      </section>
    </div>
    {notice && <p role="status" className="study-message">{notice}</p>}
    {plan && <section className="study-plan"><p>{plan.explanation}</p>{plan.rejected.map((reason, i) => <p key={i} className="study-message">Excluded candidate: {reason}</p>)}{plan.candidates.length > 1 && <div className="assistant-actions">{plan.candidates.map((candidate, index) => <button key={index} type="button" onClick={() => selectReview(candidate, 'local', planDraftSignature)}>Inspect {candidate.changes[0].after}{candidate.changes[0].unit} · {fmt(candidate.summaries[1].mean, reviewedDefinition.unit)}</button>)}</div>}</section>}
    {review && <section className="study-review" aria-label="Study proposal review"><div className="study-review-heading"><div><p className="study-kicker">2. REVIEW BEFORE APPLYING</p><h3>{review.proposal.question}</h3></div><span>{reviewSource === 'local' ? 'Deterministic proposal' : 'External proposal · locally recalculated'}</span></div>
      {stale && <p className="study-message">The comparison or planner inputs changed after this preview. Recalculate before applying.</p>}
      <p><strong>{reviewSource === 'external' ? 'Unverified external explanation' : 'Planner method'}:</strong> {review.proposal.rationale}</p>
      <div className="study-change">{review.changes.map(change => <p key={change.label}><strong>{change.label}</strong><span>A {fmt(change.before, change.unit)} → B {fmt(change.after, change.unit)}</span></p>)}</div>
      <p>B will be replaced with A’s setup, body profile and current position, then the change above. A stays intact. The criterion becomes this question. {state.lockEquipment && review.proposal.changes[0].parameter === 'pulleyHeight' && 'Same equipment will turn off to permit the proposed outlet placement.'}</p>
      <p className="study-help">{review.compatible ? 'Compatible coordinates and load convention.' : 'Incompatible coordinates: deltas unavailable.'} Calculated region: {review.region.join('–')}{reviewedDefinition.angleUnit}. {review.comparable ? 'Both region summaries are complete.' : 'Incomplete region: no comparative numerical claim.'}</p>
      <div className="study-table-wrap"><table><thead><tr><th>Engine calculation</th><th>A control</th><th>B proposal</th><th>B − A</th></tr></thead><tbody>{([['Mean resistance', 'mean', reviewedDefinition.unit], ['Minimum resistance', 'minimum', reviewedDefinition.unit], ['Maximum resistance', 'maximum', reviewedDefinition.unit], ['External-load work', 'externalWork', 'J']] as const).map(([label, key, unit]) => <tr key={key}><th>{label}</th>{review.summaries.map((summary, index) => <td key={index}>{fmt(summary[key], unit)}</td>)}<td>{review.comparable ? fmt(review.summaries[1][key]! - review.summaries[0][key]!, unit) : '—'}</td></tr>)}</tbody></table></div>
      <p>Entire original ROM geometrically clear: A {review.fullRangeClear[0] ? 'yes' : 'no / unavailable'} · B {review.fullRangeClear[1] ? 'yes' : 'no / unavailable'}. These are represented-model checks, not personal safety or mobility assessments.</p>
      {!!review.warnings.length && <div className="study-limitations"><h4>Confounds and missing inputs</h4><ul>{review.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      <details><summary>Assumptions and evidence</summary><ul>{review.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul><p>Evidence category: calculation within the stated model. The question and imported explanation remain hypotheses. No studies or citations are supplied automatically.</p></details>
      <div className="study-next"><h4>What to measure next</h4><ul>{review.measurements.map(measurement => <li key={measurement}>{measurement}</li>)}</ul></div>
      <div className="assistant-actions"><button className="study-primary" type="button" disabled={stale || busy} onClick={() => { try { onApply(applyStudyProposal(state, review.proposal)); setCleanDraft(draftSignature); setNotice('Reviewed proposal applied to B. The original A was preserved.'); } catch (error) { setNotice(errorText(error)); } }}>Apply reviewed proposal to B</button><button type="button" disabled={stale} onClick={() => download(JSON.stringify(review.proposal, null, 2), 'biomechanics-study-proposal.json')}>Export reviewed proposal</button></div>
    </section>}
    {dirty && <div className="study-draft"><p>Unsaved planner draft: navigating keeps it open. Whole-workspace export, restore and managed update reload wait until you export this draft, apply a reviewed proposal or discard the changes.</p><div className="assistant-actions"><button type="button" onClick={() => { download(JSON.stringify({ format: 'biomechanics-study-draft', version: 1, ...draft }, null, 2), 'biomechanics-study-draft.json'); setCleanDraft(draftSignature); setNotice('Planner question, controls and proposal text exported as a local draft. It includes no comparison snapshots.'); }}>Export planner draft</button><button type="button" onClick={() => { const previous = JSON.parse(cleanDraft) as typeof draft; setQuestion(previous.question); setParameter(previous.parameter); setGoal(previous.goal); setDirection(previous.direction); setStep(previous.step); setSelection(previous.selection); setProposalText(previous.proposalText); setReview(null); setPlan(null); setExchange(''); setNotice('Unsaved planner changes discarded. The comparison is unchanged.'); }}>Discard planner changes</button></div></div>}
    <p className="study-footer">Planner and exchange drafts stay in this session. Export a reviewed proposal to retain it, and use the research notebook to record a conclusion with its comparison. Compound and machine studies use their own workspaces and notebook snapshots.</p>
  </section>;
}
