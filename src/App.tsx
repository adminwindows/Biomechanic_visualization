import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { deploymentStorage as localStorage } from "./deploymentStorage";
import {
  evaluate,
  presets,
  compatible,
  getDefinition,
  forceToSetup,
  type Profile,
  type Setup,
} from "./engine";
import { Field } from "./Field";
import { constrainMotion, motionConstraints, setMotionAngle } from "./motionConstraint";
import {
  ExerciseCatalog,
  SavedWorkspace,
  TrainingImport,
  ModelControls,
} from "./WorkspaceTools";
import { AnalysisPanel } from "./AnalysisPanel";
import { BodyDiagram } from "./BodyDiagram";
import { OfflineStatus } from "./OfflineStatus";
import { ExampleComparisons } from "./ExampleComparisons";
import { saveExerciseDraft, loadExerciseDraft } from "./exerciseDrafts";
const DesignExplorer = lazy(() => import("./DesignExplorer").then(module => ({ default: module.DesignExplorer })));
const MachineLab = lazy(() => import("./MachineLab").then(module => ({ default: module.MachineLab })));
const CompoundLab = lazy(() => import("./compoundLab").then(module => ({ default: module.CompoundLab })));
import { WorkspaceBackup } from "./WorkspaceBackup";
import { flushWorkspaceEdits } from "./workspaceBackup";
import { Scene } from "./Scene";
import { Curve } from "./Curve";
import {
  changeHeight,
  regenerateEstimates,
  forceValue,
  movementProgress,
  angleAtProgress,
  EQUIPMENT_KEYS,
  createInitialState,
  editMeasurement,
  loadState,
  saveState,
  setAngle,
  sharedRange,
  validateState,
  type LabState,
} from "./state";

import { StudioDialog, CommandPalette } from "./StudioDialogs";
import { Icon } from "./Icon";
import { reuseModelReferences } from "./stateIdentity";
import { createComparisonLifecycle } from "./comparisonLifecycle";
import { ComparisonResults } from "./ComparisonResults";
import { ExercisePairPicker } from "./ExercisePairPicker";
import { createJointPairChooser } from "./exercisePairs";
const StudyAssistant = lazy(() => import("./StudyAssistant").then(module => ({ default: module.StudyAssistant })));
const CalibrationGuide = lazy(() => import("./CalibrationGuide").then(module => ({ default: module.CalibrationGuide })));

const deploymentBase = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL;

type Side = 0 | 1;
type Workspace = "compare" | "compound" | "machines" | "design" | "assistant" | "calibration";
const workspaceInfo: Record<Workspace, { title: string; label: string; description: string; icon: "compare" | "movement" | "machine" | "search" | "study" | "measure" }> = {
  compare: { title: "Compare exercises", label: "Compare exercises", description: "Joint movement and resistance", icon: "compare" },
  compound: { title: "Compare exercises", label: "Compound exercises", description: "Resistance over a multi-joint movement", icon: "movement" },
  machines: { title: "Machine resistance", label: "Machine resistance", description: "Compare mechanisms and measured curves", icon: "machine" },
  design: { title: "Explore setup changes", label: "Explore setup changes", description: "Placement, sensitivity and research notes", icon: "search" },
  assistant: { title: "Try a setup change", label: "Try a setup change", description: "Change one setting and compare the result", icon: "study" },
  calibration: { title: "Measurements", label: "Measurements", description: "Measure body dimensions, equipment and force", icon: "measure" },
};
const workspaceFromHash = (): Workspace => {
  const name = window.location.hash.slice(1);
  return Object.hasOwn(workspaceInfo, name) ? name as Workspace : "compare";
};
function jumpToSection(event: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById(event.currentTarget.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  if (target instanceof HTMLDetailsElement) target.open = true;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

function ArrowIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      style={down ? { transform: "scaleY(-1)" } : undefined}
    >
      <path d="M5 19 19 5M6 5h13v13" />
    </svg>
  );
}
const clone = <T,>(value: T): T => structuredClone(value);
const labels: Record<string, string> = {
  resists: "Resists the pull",
  assists: "Assists the pull",
  "near-zero": "Almost neutral",
  "no-force": "No cable force",
  singular: "Undefined cable direction",
  contact: "Backrest contact",
  invalid: "Outside physical bounds",
  unknown: "Resistance not calculated",
  slack: "Cable slack",
};
const profileFields: [keyof Profile, string, string, number, number][] = [
  ["height", "Standing height", "Floor to the top of the head", 1.2, 2.2],
  ["upperArm", "Upper arm", "Shoulder reference to elbow", 0.2, 0.5],
  ["forearm", "Forearm", "Elbow to wrist reference", 0.15, 0.45],
  ["hand", "Wrist to grip", "Wrist reference to centre of grip", 0.03, 0.18],
  ["thigh", "Thigh", "Hip reference to knee", 0.25, 0.7],
  ["shank", "Lower leg", "Knee reference to ankle", 0.25, 0.65],
  ["foot", "Foot length", "Heel to toe", 0.15, 0.4],
  ["pelvisWidth", "Pelvis width", "Between hip reference points", 0.2, 0.55],
  ["headNeck", "Head and neck", "Shoulder reference to top of head", 0.18, 0.4],
  ["torso", "Torso", "Pelvis to shoulder reference", 0.35, 0.8],
  [
    "shoulderWidth",
    "Shoulder width",
    "Between shoulder references; also sets grip width",
    0.25,
    0.6,
  ],
];

export default function App() {
  const [initial] = useState(loadState);
  const [state, setState] = useState<LabState>(() => constrainMotion(initial.state));
  const [notice, setNotice] = useState(initial.error ?? "");
  const [workspace, setWorkspace] = useState<Workspace>(workspaceFromHash);
  const [visited, setVisited] = useState<Workspace[]>(() => [...new Set<Workspace>(["compare", workspaceFromHash()])]);
  const [dialog, setDialog] = useState<"tools" | "catalog" | "examples" | "library" | "help" | "command" | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSide, setInspectorSide] = useState<Side>(0);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const inspectorClose = useRef<HTMLButtonElement>(null);
  const inspectorOpener = useRef<HTMLElement | null>(null);
  function closeInspector() {
    setInspectorOpen(false);
    requestAnimationFrame(() => {
      const previous = inspectorOpener.current;
      if (previous?.isConnected && previous.getClientRects().length) previous.focus();
      else document.querySelector<HTMLButtonElement>('[aria-label="Edit setup A"]')?.focus();
    });
  }
  function editSetup(side: Side, body = false) {
    inspectorOpener.current = document.activeElement as HTMLElement;
    activate("compare"); setInspectorSide(side); setInspectorOpen(true);
    requestAnimationFrame(() => {
      inspectorClose.current?.focus();
      if (body) { const panel = document.querySelector<HTMLDetailsElement>(`#body-profile-${side === 0 ? 'a' : 'b'}`); if (panel) { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); } }
    });
  }
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setDialog(value => value === 'command' ? null : 'command'); }
      if (event.key === 'Escape') closeInspector();
    };
    const location = () => { const next = workspaceFromHash(); setWorkspace(next); setVisited(previous => previous.includes(next) ? previous : [...previous, next]); setPlaying(false); };
    window.addEventListener('keydown', keyboard); window.addEventListener('popstate', location); window.addEventListener('hashchange', location);
    return () => { window.removeEventListener('keydown', keyboard); window.removeEventListener('popstate', location); window.removeEventListener('hashchange', location); };
  }, []);
  const [workbenchRevision, setWorkbenchRevision] = useState({ compound: 0, machine: 0 });
  const [compoundSelection, setCompoundSelection] = useState<{preset: string; side: Side; nonce: number; pair?: boolean}>();
  function activate(next: Workspace) {
    setPlaying(false);
    setWorkspace(next);
    if (window.location.hash !== `#${next}`) window.history.pushState(null, "", `#${next}`);
    if (next !== "compare") setInspectorOpen(false);
    setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
  }
  const framing = state.viewFraming ?? { view: "side" as const, zoom: 1, pan: [0, 0] as [number, number] };
  const { view, zoom, pan } = framing;
  function setView(next: "side" | "top" | "front") {
    setState(previous => ({ ...previous, viewFraming: { ...(previous.viewFraming ?? framing), view: next } }));
  }
  function setZoom(change: number | ((previous: number) => number)) {
    setState(previous => {
      const current = previous.viewFraming ?? framing;
      return { ...previous, viewFraming: { ...current, zoom: typeof change === "function" ? change(current.zoom) : change } };
    });
  }
  function setPan(next: [number, number]) {
    setState(previous => ({ ...previous, viewFraming: { ...(previous.viewFraming ?? framing), pan: next.map(value => Math.max(-100, Math.min(100, value))) as [number, number] } }));
  }
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [annotations, setAnnotations] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(!initial.error);
  const [comparisonPersistence] = useState(createComparisonLifecycle);
  const [savingPauseReason, setSavingPauseReason] = useState("The previous saved data could not be restored and has been preserved. This session is not saving over it.");
  const [saved, setSaved] = useState(!initial.error);
  const [history, setHistory] = useState<LabState[]>([]);
  const [future, setFuture] = useState<LabState[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const direction = useRef(-1);
  const stateRef = useRef(state);
  stateRef.current = state;
  const profiles = useMemo<[Profile, Profile]>(
    () => [state.profiles[0].values, state.profiles[1].values],
    [state.profiles[0].values, state.profiles[1].values],
  );
  const results = state.setups.map((setup, i) =>
    evaluate(setup, profiles[i], state.angles[i]),
  );
  const usableMode = state.motionMode === "usable";
  const motion = useMemo(() => usableMode ? motionConstraints(state) : null, [state, usableMode]);
  const shared = sharedRange(state);
  const comparable = compatible(state.setups[0], state.setups[1]);
  const modelDefinitions = state.setups.map(getDefinition);

  function update(change: (draft: LabState) => LabState | void) {
    setPlaying(false);
    try {
      const previous = stateRef.current;
      const draft = clone(previous);
      const next = reuseModelReferences(previous, constrainMotion(validateState(change(draft) ?? draft)));
      setHistory((h) => [...h.slice(-49), clone(previous)]);
      setFuture([]);
      stateRef.current = next;
      setState(next);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "This change is incompatible with the current settings.",
      );
    }
  }
  function persistComparison(): boolean {
    if (!savingEnabled) return false;
    const result = comparisonPersistence.write(() => saveState(stateRef.current));
    if (result === "saved") { setSaved(true); return true; }
    if (result === "suspended") return false;
    const message = result === "changed"
      ? "The saved comparison was cleared or changed outside this tab. Autosave paused to preserve it. Export this session, then reload to use the stored version, or explicitly back up that version and enable saving."
      : "Browser storage could not preserve this comparison. Autosave paused. Export this session before reloading; retry saving only after storage is available.";
    setSaved(false); setSavingEnabled(false); setSavingPauseReason(message); setNotice(message);
    return false;
  }
  useEffect(() => {
    if (!savingEnabled) return;
    setSaved(false);
    const timer = window.setTimeout(() => { persistComparison(); }, 250);
    return () => clearTimeout(timer);
  }, [state, savingEnabled]);
  useEffect(() => {
    if (!savingEnabled) return;
    // Preserve rapid live edits only while this tab still owns the stored snapshot.
    const flush = () => { persistComparison(); };
    const whenHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", whenHidden);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", whenHidden); };
  }, [savingEnabled]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setState((previous) => {
          const interval = previous.motionMode === "usable"
            ? motionConstraints(previous).selected[0]
            : previous.sync === "angle"
              ? sharedRange(previous)
              : previous.setups[0].range;
          if (!interval || interval[0] === interval[1]) return previous;
          let next = previous.angles[0] + direction.current * (interval[1] - interval[0]) / 110 * speed;
          if (next <= interval[0]) {
            next = interval[0];
            direction.current = 1;
          }
          if (next >= interval[1]) {
            next = interval[1];
            direction.current = -1;
          }
          return setMotionAngle(previous, 0, next);
        }),
      50,
    );
    return () => clearInterval(timer);
  }, [playing, speed]);

  function matchForce(setup: Setup, force: number): Setup | null {
    return forceToSetup(setup, force);
  }
  function equalizeForce(draft: LabState, side: Side, force: number) {
    const matched = matchForce(draft.setups[side], force);
    if (matched) draft.setups[side] = matched;
    else {
      draft.lockForce = false;
      setNotice(
        "The other setup cannot match that force with its current slack state, transmission, or load limits. Force lock was released.",
      );
    }
  }
  function normalize(draft: LabState, side: Side): LabState {
    if (draft.sync === "angle" && !sharedRange(draft))
      draft.sync = "independent";
    return setAngle(draft, side, draft.angles[side]);
  }
  function setupPatch(side: Side, patch: Partial<Setup>) {
    update((draft) => {
      draft.setups[side] = { ...draft.setups[side], ...patch };
      const other: Side = side === 0 ? 1 : 0;
      if (draft.lockEquipment) {
        for (const key of [...EQUIPMENT_KEYS, "transmissionFactor" as const]) {
          if (key in patch)
            Object.assign(draft.setups[other], {
              [key]: clone(draft.setups[side][key]),
            });
        }
      }
      if (draft.lockForce) {
        const force = forceValue(draft.setups[side]);
        if (force === null || forceValue(draft.setups[other]) === null)
          draft.lockForce = false;
        else equalizeForce(draft, other, force);
      }
      return normalize(draft, side);
    });
  }
  function setupChange(side: Side, key: keyof Setup, value: unknown) {
    const patch: Partial<Setup> = { [key]: value };
    const current = state.setups[side];
    const model = current.model ?? "pullover";
    const legModel = /^(hip|knee)/.test(model);
    if (key === "pulleyHeight" && current.outletPositions) {
      const shift = Number(value) - current.pulleyHeight;
      patch.outletPositions = current.outletPositions.map(point => [point[0], point[1], Math.max(0, Math.min(10, point[2] + shift))]);
    }
    if (key === "loadedSides" && model !== "pullover") patch.cables = value === "bilateral" ? 2 : 1;
    if (key === "freeWeightKind" && (value === "barbell" || value === "shared") && !legModel) {
      patch.loadedSides = "bilateral";
      if (model !== "pullover") patch.cables = 2;
    }
    if (key === "loadMode" && value === "mass") {
      patch.loadMass = state.setups[side].loadMass ?? 10;
      patch.transmissionFactor = state.setups[side].transmissionFactor ?? 1;
    }
    if (key === "resistance" && value === "dumbbell")
      patch.loadMass = state.setups[side].loadMass ?? 5;
    if (key === "posture") {
      patch.bodyRoll = value === "side-lying" ? -90 : undefined;
      if (["supine", "prone", "side-lying"].includes(String(value))) {
        patch.kind = "bench";
        patch.tilt = 0;
        patch.hipHeight = value === "side-lying" ? .7 : .65;
      } else if (value === "seated") {
        patch.kind = "bench";
        patch.tilt = current.kind === "bench" ? current.tilt : 60;
        patch.hipHeight = 0.46;
      } else {
        patch.kind = "standing";
        if (current.kind === "bench") patch.tilt = 0;
        if (value === "kneeling")
          patch.hipHeight = (state.profiles[side].values.thigh ?? 0.43) + 0.06;
        else
          patch.hipHeight = Math.min(
            0.9,
            (state.profiles[side].values.thigh ?? 0.43) +
              (state.profiles[side].values.shank ?? 0.43) +
              0.04,
          );
      }
    }
    if (key === "segmentGravity" && value === true) {
      if (legModel) {
        patch.thighMass = state.setups[side].thighMass ?? 0;
        patch.shankMass = state.setups[side].shankMass ?? 0;
      } else if (model.startsWith("wrist-") || model === "forearm-rotation") {
        patch.handMass = current.handMass ?? 0;
      } else {
        patch.upperArmMass = state.setups[side].upperArmMass ?? 0;
        patch.forearmMass = state.setups[side].forearmMass ?? 0;
        patch.handMass = state.setups[side].handMass ?? 0;
      }
    }
    setupPatch(side, patch);
  }
  function chooseSetup(side: Side, next: Setup) {
    update((draft) => {
      draft.viewFraming = { view: getDefinition(next).plane, zoom: 1, pan: [0, 0] };
      const force = forceValue(draft.setups[side]);
      draft.setups[side] = clone(next);
      draft.lockEquipment = false;
      if (draft.lockForce && force !== null && forceValue(next) !== null)
        equalizeForce(draft, side, force);
      else draft.lockForce = false;
      return normalize(draft, side);
    });
  }
  function choosePreset(side: Side, name: string) {
    if (name.startsWith("compound:")) {
      setCompoundSelection({ preset: name.slice("compound:".length), side, nonce: Date.now() });
      activate("compound");
      return;
    }
    activate("compare");
    const preset = presets.find((p) => p.preset === name);
    if (!preset) return;
    try {
      const previous = stateRef.current;
      if (previous.setups[side].preset === name) return;
      saveExerciseDraft(side, previous.setups[side], previous.profiles[side], previous.angles[side]);
      const restored = loadExerciseDraft(side, name);
      if (!restored) { chooseSetup(side, preset); return; }
      update(draft => {
        const other: Side = side === 0 ? 1 : 0;
        draft.setups[side] = clone(restored.setup);
        draft.profiles[side] = clone(restored.profile);
        draft.angles[side] = restored.angle;
        if (draft.lockBody) draft.profiles[other] = clone(restored.profile);
        draft.lockEquipment = false;
        const force = forceValue(restored.setup);
        if (draft.lockForce && force !== null && forceValue(draft.setups[other]) !== null) equalizeForce(draft, other, force);
        else draft.lockForce = false;
        draft.viewFraming = { view: getDefinition(restored.setup).plane, zoom: 1, pan: [0, 0] };
        return normalize(draft, side);
      });
      setNotice(`Restored your working settings for ${restored.setup.name}${restored.sourceModelVersion ? "; recalculated using the current mechanics model" : ""}. Reset setup preset loads the original example.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not preserve your exercise settings. Export the comparison before switching.");
    }
  }
  const [applyJointPair] = useState(createJointPairChooser);
  function choosePairPreset(side: Side, id: string) {
    if (id.startsWith("compound:")) {
      setCompoundSelection({ preset: id.slice("compound:".length), side, nonce: Date.now(), pair: true });
      activate("compound");
      return;
    }
    activate("compare");
    update(draft => {
      const choice = applyJointPair(draft, side, id);
      setNotice(choice.notice);
      return choice.state;
    });
  }
  function bodyChange(side: Side, key: keyof Profile, value: number) {
    update((draft) => {
      const next =
        key === "height"
          ? changeHeight(draft.profiles[side], value)
          : editMeasurement(draft.profiles[side], key, value);
      draft.profiles[side] = next;
      if (draft.lockBody) draft.profiles[side === 0 ? 1 : 0] = clone(next);
    });
  }
  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "biomechanics-comparison.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Comparison exported with settings, body dimensions, and measurement provenance.",
    );
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("Choose a comparison file smaller than 1 MB.");
      const raw = JSON.parse(await file.text());
      const imported = validateState(raw);
      update(() => imported);
      setNotice(
        raw.modelVersion !== imported.modelVersion
          ? "Comparison imported and recalculated with the current mechanics model. Your original file is unchanged."
          : "Comparison imported. All settings and body profiles have been restored.",
      );
    } catch (error) {
      setNotice(
        `Import failed: ${error instanceof Error ? error.message : "Invalid file."}`,
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function undo() {
    if (!history.length) return;
    setPlaying(false);
    setFuture((f) => [clone(state), ...f]);
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPlaying(false);
    setHistory((h) => [...h, clone(state)]);
    setState(future[0]);
    setFuture((f) => f.slice(1));
  }
  return (
    <div className="app-shell comparator-shell">
      <a className="skip-link" href="#studio-content">Skip to comparison</a>
      <main id="workspace" className={`studio-main compare-main ${inspectorOpen ? "inspector-open" : ""}`}>
        <header className="compare-topbar">
          <a className="compare-brand" href="#compare" onClick={event => { event.preventDefault(); activate("compare"); }}>
            <img src={`${deploymentBase}brand-mark.svg`} alt="" />Biomechanics Lab
          </a>
          <div className="compare-topbar-actions">
            <OfflineStatus beforeReload={() => { if (!savingEnabled) throw new Error("Comparison saving is paused. Export this session or resolve the saved-data conflict before updating."); flushWorkspaceEdits(); if (!persistComparison()) throw new Error("The current comparison could not be saved without replacing other data. Export this session and reload or resolve the storage conflict before updating."); }}/>
            <button className="tools-trigger" aria-haspopup="dialog" onClick={() => setDialog("tools")}><Icon name="settings"/>Tools</button>
          </div>
          <input ref={fileInput} hidden aria-label="Import comparison file" type="file" accept=".json,application/json" onChange={event => void importFile(event.target.files?.[0])}/>
        </header>
        <div className="compare-content">
        <header className="compare-header" id="studio-content" tabIndex={-1}>
          <h1>{workspaceInfo[workspace].title}</h1>
          {workspace !== "compare" && workspace !== "compound" && <button onClick={() => activate("compare")}>Back to comparison</button>}
        </header>
        {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
        <section hidden={workspace !== "compare"} aria-label="Joint and exercise comparison workspace">
        <ExercisePairPicker jointSetups={state.setups} onPick={choosePairPreset}/>
        <div className="pair-actions">
            <button
              className="icon-button"
              aria-label="Undo"
              disabled={!history.length}
              onClick={undo}
            >
              ↶
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              ↷
            </button>
            <button
              onClick={() =>
                update((d) => {
                  d.setups[1] = clone(d.setups[0]);
                  d.profiles[1] = clone(d.profiles[0]);
                  d.angles[1] = d.angles[0];
                })
              }
            >
              Copy A → B
            </button>
            <button
              onClick={() =>
                update((d) => {
                  d.setups.reverse();
                  d.profiles.reverse();
                  d.angles.reverse();
                })
              }
            >
              Swap A ⇄ B
            </button>
        </div>
        <nav className="compare-jumps" aria-label="Jump to comparison details">
          <a href="#resistance-curve" onClick={jumpToSection}>Curve</a>
          <a href="#exercise-movement" onClick={jumpToSection}>Movement</a>
          <a href="#comparison-details" onClick={jumpToSection}>Details</a>
        </nav>
        <div className="comparison-overview">
          <ComparisonResults state={state} results={results} />
        <section id="resistance-curve" className="analysis-grid" tabIndex={-1} aria-label="Results">
          <article className="curve-card">
            <div className="section-heading">
              <div>
                <h2>Resistance across the movement</h2>
              </div>
              <div className="legend">
                <span className="a-text">━ A</span>
                <span className="b-text">━ B</span>
              </div>
            </div>
            <Curve
              setups={state.setups}
              profiles={profiles}
              angles={state.angles}
              onAngle={(angle) => update((d) => setMotionAngle(d, 0, angle))}
              region={state.region}
              onRegionChange={(region) =>
                update((d) => {
                  d.region = region;
                })
              }
            />
            <p className="chart-caption">
              Positive values resist the indicated movement. Negative values assist it. Gaps mark positions where the model cannot give a value.
            </p>
          </article>

        </section>
        </div>
        {!savingEnabled && (
          <div className="notice recovery-notice" role="status">
            {savingPauseReason}
            <button
              onClick={() => {
                try {
                  const previous = localStorage.getItem(
                    "exercise-biomechanics-lab.comparison.v1",
                  );
                  if (previous)
                    localStorage.setItem(
                      "exercise-biomechanics-lab.recovery." + Date.now(),
                      previous,
                    );
                  if (!comparisonPersistence.rebase()) throw new Error("Storage could not be read after backing up the original.");
                  setSavingEnabled(true);
                  setNotice(
                    "Previous data backed up in browser storage. Autosave enabled for this comparison.",
                  );
                } catch {
                  setNotice(
                    "Cannot back up browser storage. Export this session to keep it.",
                  );
                }
              }}
            >
              Back up previous data & enable saving
            </button>
          </div>
        )}
        {!comparable && (
          <div className="incompatible-message">
            These exercises use different joint coordinates. Positions remain
            independent or use equal progress; each curve is shown separately
            and no moment difference is calculated.
          </div>
        )}
        <section id="exercise-movement" tabIndex={-1} className="movement-panel" aria-label="Movement controls">
          <h2 className="rep-title">Position in the rep</h2>
          <div className="movement-row">
            <button
              className={`play-button ${playing ? "is-playing" : ""}`}
              disabled={
                reducedMotion ||
                (usableMode && !motion?.selected[0]) ||
                (state.sync === "angle" && (!shared || shared[0] === shared[1]))
              }
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Pause animation" : "Play animation"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                aria-hidden="true"
                fill="currentColor"
              >
                {playing ? (
                  <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
                ) : (
                  <path d="m6 3 11 7-11 7z" />
                )}
              </svg>
            </button>
            <div className="movement-sliders">
              {state.sync === "progress" && (
                <fieldset disabled={usableMode && !motion?.progress} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <Field
                  label="Shared movement progress"
                  value={
                    movementProgress(state.setups[0], state.angles[0]) * 100
                  }
                  min={motion?.progress ? motion.progress[0] * 100 : 0}
                  max={motion?.progress ? motion.progress[1] * 100 : 100}
                  unit="%"
                  onChange={(value) =>
                    update((d) =>
                      setMotionAngle(d, 0, angleAtProgress(d.setups[0], value / 100)),
                    )
                  }
                />
                </fieldset>
              )}
              {(state.sync === "independent" ? [0, 1] : [0]).map((i) => (
                <fieldset key={i} disabled={usableMode && !motion?.selected[i]} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <Field
                  label={
                    state.sync === "independent"
                      ? `${i === 0 ? "A" : "B"} · ${modelDefinitions[i].angleLabel}`
                      : modelDefinitions[0].angleLabel
                  }
                  value={state.angles[i]}
                  min={
                    motion?.selected[i]?.[0] ?? (state.sync === "angle" && shared
                      ? shared[0]
                      : state.setups[i].range[0])
                  }
                  max={
                    motion?.selected[i]?.[1] ?? (state.sync === "angle" && shared
                      ? shared[1]
                      : state.setups[i].range[1])
                  }
                  step={0.5}
                  unit={modelDefinitions[i].angleUnit ?? "°"}
                  onChange={(v) => update((d) => setMotionAngle(d, i as Side, v))}
                />
                </fieldset>
              ))}
            </div>
            <div className="angle-readout">
              <span className="a-text">A {state.angles[0].toFixed(1)}{modelDefinitions[0].angleUnit ?? "°"}</span>
              <span className="b-text">B {state.angles[1].toFixed(1)}{modelDefinitions[1].angleUnit ?? "°"}</span>
            </div>
          </div>
          <details className="movement-settings"><summary>Movement settings</summary>
            <label className="sync-label">
              Compare at{" "}
              <select
                aria-label="Synchronization mode"
                value={state.sync}
                onChange={(e) =>
                  update((d) => {
                    d.sync = e.target.value as LabState["sync"];
                    return setAngle(d, 0, d.angles[0]);
                  })
                }
              >
                <option value="angle" disabled={!shared || !comparable}>
                  the same angle
                </option>
                <option value="progress">the same progress</option>
                <option value="independent">independent positions</option>
              </select>
            </label>
            {state.sync === "progress" && <p className="small-note">Equal progress does not mean equal joint angles.</p>}
          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            <label className="select-field">
              Movement mode
              <select aria-label="Movement mode" value={state.motionMode ?? "explore"}
                onChange={(event) => update(d => {
                  d.motionMode = event.target.value as "explore" | "usable";
                  d.clearIntervalAnchors = [...d.angles];
                })}>
                <option value="explore">Explore full range</option>
                <option value="usable">Usable range according to the model</option>
              </select>
            </label>
            <p className="small-note" style={{ margin: 0 }}>
              {usableMode
                ? "Motion stays within one connected portion without represented backrest contact or invalid geometry. This is not personal range of motion or a clearance assessment of the whole machine. Your original ranges are preserved."
                : "Explore the full selected ranges. Contact poses are ghosted and their direct mechanical results are unavailable."}
            </p>
            {usableMode && motion && (state.sync === "independent" ? [0, 1] : [0]).map(index => {
              const side = index as Side;
              const options = motion.options[side];
              const selected = motion.selected[side];
              const selectedIndex = selected ? options.findIndex(interval => interval[0] === selected[0] && interval[1] === selected[1]) : -1;
              return <label className="select-field" key={side} style={{ display: "grid", justifyContent: "stretch" }}>
                {state.sync === "independent" ? `${side === 0 ? "A" : "B"} clear portion` : "Shared clear portion"}
                <select aria-label={state.sync === "independent" ? `${side === 0 ? "A" : "B"} clear portion` : "Shared clear portion"}
                  disabled={!options.length} value={selectedIndex} style={{ maxWidth: "100%", width: "100%" }}
                  onChange={event => update(d => {
                    const choice = Number(event.target.value);
                    const anchors: [number, number] = [...d.angles];
                    for (const target of (d.sync === "independent" ? [side] : [0, 1])) {
                      const interval = motion.options[target][choice];
                      anchors[target] = (interval[0] + interval[1]) / 2;
                    }
                    d.clearIntervalAnchors = anchors;
                  })}>
                  {!options.length && <option value={-1}>No shared clear portion</option>}
                  {options.map((interval, option) => <option key={option} value={option}>
                    {interval[0].toFixed(2)}–{interval[1].toFixed(2)}{modelDefinitions[side].angleUnit ?? "°"}
                    {state.sync === "progress" ? ` in A; ${motion.options[1][option][0].toFixed(2)}–${motion.options[1][option][1].toFixed(2)}${modelDefinitions[1].angleUnit ?? "°"} in B` : ""}
                  </option>)}
                </select>
                {!options.length && <span role="status" className="small-note">
                  {(state.sync === "independent" ? !motion.known[side] : motion.known.some(known => !known))
                    ? "Cable routing or machine motion is not modeled for this configuration. Use exploration mode; no model clearance claim is available."
                    : state.sync === "independent"
                      ? "No clear portion was found in this setup's selected range. Change the setup or range, or return to exploration."
                      : "No clear portion satisfies both setups at this synchronization. Choose independent positions, change the setup or return to exploration."}
                </span>}
              </label>;
            })}
          </div>
        <div className="motion-options">
          <label>
            Playback speed{" "}
            <select
              aria-label="Animation speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => {
                setReducedMotion(e.target.checked);
                setPlaying(false);
              }}
            />
            Reduced motion · manual movement
          </label>
          <span>
            Drag the outlet, pelvis or active grip in a drawing. Drag empty
            space to pan both views.
          </span>
        </div>
          </details>
        </section>
        <div className="view-toolbar">
          <div className="segmented" aria-label="Drawing view">
            <button
              aria-pressed={view === "side"}
              onClick={() => setView("side")}
            >
              Side view
            </button>
            <button
              aria-pressed={view === "top"}
              onClick={() => setView("top")}
            >
              Top view
            </button>
            <button
              aria-pressed={view === "front"}
              onClick={() => setView("front")}
            >
              Front view
            </button>
          </div>
          <div className="view-options">
            <div className="toolbar-zoom">
              <button
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan([0, 0]);
                }}
              >
                Fit
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={annotations}
                onChange={(e) => setAnnotations(e.target.checked)}
              />{" "}
              Labels
            </label>
            <span>
              <i className="scale-icon" /> Shared scale
            </span>
          </div>
        </div>
        <section
          className="comparison-grid"
          aria-label="A and B configurations"
        >
          {state.setups.map((setup, index) => {
            const side = index as Side;
            const letter = side === 0 ? "A" : "B";
            const result = results[side];
            return (
              <article
                className={`setup-card setup-${letter.toLowerCase()}`}
                key={letter}
                aria-label={`Configuration ${letter}`}
              >
                <div className="card-heading">
                  <span className="letter-badge">{letter}</span>
                  <div>
                    <h3 className="setup-name">{setup.name}</h3>
                  </div>
                  <span className="cable-count">
                    {setup.resistance === "dumbbell"
                      ? "Gravity"
                      : setup.resistance === "unknown" ||
                          setup.model === "machine"
                        ? "Geometry only"
                        : setup.cables === 1
                          ? "1 cable"
                          : "2 cables"}
                  </span>
                  <button className="edit-setup-button" onClick={() => editSetup(side)} aria-label={`Edit setup ${letter}`}><Icon name="settings"/>Edit setup</button>
                </div>
                <Scene
                  setup={setup}
                  profile={profiles[side]}
                  angle={state.angles[side]}
                  setups={state.setups}
                  profiles={profiles}
                  view={view}
                  label={letter}
                  annotations={annotations}
                  zoom={zoom}
                  pan={pan}
                  onPanChange={setPan}
                  onSetupChange={(patch) => setupPatch(side, patch)}
                  onAngleChange={(angle) =>
                    update((d) => setMotionAngle(d, side, angle))
                  }
                />
                <div className="metric-strip">
                  <div>
                    <span className="overline">{modelDefinitions[side].unit === "N" ? "External force" : "External moment"}</span>
                    <p className="moment">
                      {result.moment === null
                        ? "—"
                        : `${result.moment > 0 ? "+" : ""}${result.moment.toFixed(1)}`}{" "}
                      <small>{modelDefinitions[side].unit}</small>
                    </p>
                  </div>
                  <div className={`status status-${result.status}`}>
                    <span>
                      {result.status === "resists" ||
                      result.status === "assists" ? (
                        <ArrowIcon down={result.status === "assists"} />
                      ) : result.status === "contact" ? (
                        "!"
                      ) : (
                        "○"
                      )}
                    </span>
                    {(result.status === "resists" ||
                      result.status === "assists") &&
                    (setup.model ?? "pullover") !== "pullover"
                      ? `${result.status === "resists" ? "Resists" : "Assists"} movement`
                      : (result.status === "contact" && !result.contactKind?.includes("backrest") ? "Geometry contact" : labels[result.status] ?? result.status)}
                  </div>
                </div>
                <details className="load-details"><summary>Load and clearance</summary>
                <div className="force-components">
                  <span>
                    Cable:{" "}
                    {result.cableMoment == null
                      ? "—"
                      : result.cableMoment.toFixed(1) + " " + modelDefinitions[side].unit}
                  </span>
                  <span>
                    Gravity:{" "}
                    {result.gravityMoment == null
                      ? "—"
                      : result.gravityMoment.toFixed(1) + " " + modelDefinitions[side].unit}
                  </span>
                </div>
                <p className="panel-footnote">
                  <strong>
                    {setup.resistance === "dumbbell"
                      ? `${setup.loadMass ?? 5} kg free weight`
                      : forceValue(setup) === null
                        ? "Unknown force"
                        : `${setup.cables} × ${forceValue(setup)!.toFixed(1)} N`}
                  </strong>{" "}
                  ·{" "}
                  {result.status === "contact"
                    ? (result.validityReason ?? `${result.contactKind ?? "Represented contact"}. Direct mechanics are unavailable here.`)
                    : (result.validityReason ??
                      (setup.kind === "bench"
                        ? "No contact detected with the represented backrest."
                        : "Clearance checks use only the enabled body proxies and obstacles. Balance is not evaluated."))}
                </p>
                </details>
              </article>
            );
          })}
        </section>
        <details id="comparison-details" tabIndex={-1} className="analysis-workbench" open={showAnalysis} onToggle={event => setShowAnalysis(event.currentTarget.open)}><summary><span><Icon name="search"/>Detailed analysis & comparison notes</span><span>Regions · differences · sensitivity</span></summary>{showAnalysis && <AnalysisPanel state={state} onChange={update}/>}</details>
        </section>
                {visited.includes("compound") && <section hidden={workspace !== "compound"} aria-label="Compound movement workspace"><Suspense fallback={<div className="workspace-loading" role="status">Opening workspace…</div>}><CompoundLab key={workbenchRevision.compound} profiles={profiles} selection={compoundSelection} onPickJoint={id => choosePairPreset(0, id)} /></Suspense></section>}
        {visited.includes("machines") && <section hidden={workspace !== "machines"} aria-label="Machine workspace"><Suspense fallback={<div className="workspace-loading" role="status">Opening workspace…</div>}><MachineLab key={workbenchRevision.machine} /></Suspense></section>}
        {visited.includes("design") && <section hidden={workspace !== "design"} aria-label="Setup search workspace"><Suspense fallback={<div className="workspace-loading" role="status">Opening workspace…</div>}><DesignExplorer state={state} onResearchRestore={source => {
          setWorkbenchRevision(previous => ({ ...previous, [source]: previous[source] + 1 }));
          setCompoundSelection(undefined);
          activate(source === "machine" ? "machines" : "compound");
        }} onApply={next => { update(() => next); activate("compare"); }} /></Suspense></section>}
        {visited.includes("assistant") && <section hidden={workspace !== "assistant"} aria-label="Setup change workspace"><Suspense fallback={<div className="workspace-loading" role="status">Opening workspace…</div>}><StudyAssistant state={state} onApply={next => { update(() => next); activate("compare"); }}/></Suspense></section>}
        {visited.includes("calibration") && <section hidden={workspace !== "calibration"} aria-label="Measurement and calibration workspace"><Suspense fallback={<div className="workspace-loading" role="status">Opening workspace…</div>}><CalibrationGuide state={state} onApply={next => { update(() => next); activate("compare"); }} onOpenMachine={() => activate("machines")}/></Suspense></section>}
        <footer className="studio-footer"><button onClick={() => setDialog("help")}>Model &amp; data guide</button></footer>
        </div>
      </main>
      <aside className="setup-inspector" aria-label="Setup inspector" hidden={!inspectorOpen}><header className="inspector-heading"><div><span className="overline">PARAMETERS</span><h2>Setup inspector</h2></div><button ref={inspectorClose} aria-label="Close setup inspector" onClick={closeInspector}><Icon name="close"/></button></header><div className="inspector-side-tabs" aria-label="Inspector configuration"><button aria-pressed={inspectorSide === 0} onClick={() => setInspectorSide(0)}>Configuration A</button><button aria-pressed={inspectorSide === 1} onClick={() => setInspectorSide(1)}>Configuration B</button></div><div className="inspector-scroll">
        <section className="settings-section" aria-label="Detailed settings">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MAKE IT YOUR SETUP</p>
              <h2>Dimensions & assumptions</h2>
            </div>
            <div className="lock-options">
              <label>
                <input
                  type="checkbox"
                  checked={state.lockBody}
                  onChange={(e) =>
                    update((d) => {
                      d.lockBody = e.target.checked;
                      if (d.lockBody) d.profiles[1] = clone(d.profiles[0]);
                    })
                  }
                />
                Same body
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={state.lockForce}
                  onChange={(e) =>
                    update((d) => {
                      d.lockForce = e.target.checked;
                      if (d.lockForce) {
                        const force = forceValue(d.setups[0]);
                        if (
                          force === null ||
                          forceValue(d.setups[1]) === null
                        ) {
                          d.lockForce = false;
                          setNotice(
                            "Enter known forces in both setups before locking force.",
                          );
                        } else equalizeForce(d, 1, force);
                      }
                    })
                  }
                />
                Same force per attachment
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={state.lockEquipment ?? false}
                  onChange={(e) =>
                    update((d) => {
                      d.lockEquipment = e.target.checked;
                      if (d.lockEquipment) {
                        for (const key of EQUIPMENT_KEYS)
                          Object.assign(d.setups[1], {
                            [key]: clone(d.setups[0][key]),
                          });
                        d.setups[1].transmissionFactor =
                          d.setups[0].transmissionFactor;
                        if (d.lockForce) {
                          const f = forceValue(d.setups[0]);
                          if (f !== null) equalizeForce(d, 1, f);
                        }
                        return normalize(d, 0);
                      }
                    })
                  }
                />
                Same equipment
              </label>
              <button
                disabled={
                  !(
                    state.setups[0].resistance === "dumbbell" ||
                    state.setups[0].loadMode === "mass"
                  ) || state.setups[0].loadMass === undefined
                }
                onClick={() =>
                  update((d) => {
                    d.lockForce = false;
                    d.setups[1].loadMass = d.setups[0].loadMass;
                    if (d.setups[1].resistance !== "dumbbell") {
                      d.setups[1].loadMode = "mass";
                      d.setups[1].transmissionFactor =
                        d.setups[1].transmissionFactor;
                    }
                    setNotice(
                      "Selected mass copied. Different transmission factors can produce different actual forces.",
                    );
                  })
                }
              >
                Match selected mass A → B
              </button>
            </div>
          </div>
          <div className="comparison-grid settings-grid">
            {state.setups.map((setup, index) => {
              const side = index as Side;
              const letter = side === 0 ? "A" : "B";
              const profile = state.profiles[side];
              return (
                <div
                  key={letter}
                  className={`settings-card setup-${letter.toLowerCase()}`}
                  hidden={inspectorSide !== side}
                >
                  <h3>
                    <span className="letter-badge">{letter}</span>
                    {setup.name}
                  </h3>
                  <ModelControls
                    setup={setup}
                    profile={profile.values}
                    letter={letter}
                    change={(key, value) => setupChange(side, key, value)}
                  />
                  <div className="reset-controls">
                    <button onClick={() => {
                      const original = presets.find(preset => preset.preset === setup.preset);
                      if (original) chooseSetup(side, original);
                    }}>
                      Reset setup preset
                    </button>
                    <button
                      onClick={() => {
                        const original = presets.find(
                          (p) => p.preset === setup.preset,
                        );
                        if (original)
                          setupPatch(
                            side,
                            Object.fromEntries(
                              EQUIPMENT_KEYS.map((key) => [key, original[key]]),
                            ) as Partial<Setup>,
                          );
                      }}
                    >
                      Reset equipment group
                    </button>
                    <button
                      onClick={() => {
                        const original = presets.find(
                          (p) => p.preset === setup.preset,
                        );
                        if (original)
                          setupPatch(side, {
                            hipX: original.hipX,
                            hipHeight: original.hipHeight,
                            tilt: original.tilt,
                          });
                      }}
                    >
                      Reset placement
                    </button>
                    <button
                      onClick={() =>
                        update((d) => {
                          d.profiles[side] = regenerateEstimates(
                            d.profiles[side],
                          );
                          if (d.lockBody)
                            d.profiles[side === 0 ? 1 : 0] = clone(
                              d.profiles[side],
                            );
                        })
                      }
                    >
                      Regenerate unlocked body estimates
                    </button>
                  </div>
                  <details open>
                    <summary>Position & cable force</summary>
                    <div className="details-content">
                  {!setup.outletPositions ? <Field
                    label={`${letter} · Pulley height`}
                    value={setup.pulleyHeight * 100}
                    min={(setup.exploration ? .01 : setup.equipmentLimits?.pulleyMin ?? .05) * 100}
                    max={(setup.exploration ? 5 : setup.equipmentLimits?.pulleyMax ?? 3) * 100}
                    unit="cm"
                    onChange={(v) => setupChange(side, "pulleyHeight", v / 100)}
                  /> : <p className="small-note">Independent outlet positions · edit each coordinate under Equipment geometry & clearance.</p>}
                  <Field
                    label={`${letter} · ${setup.kind === "bench" ? "Backrest above floor" : "Torso from vertical"}`}
                    value={setup.tilt}
                    min={setup.kind === "bench" ? 0 : -30}
                    max={90}
                    unit="°"
                    onChange={(v) => setupChange(side, "tilt", v)}
                  />

                      <Field
                        label={`${letter} · Pelvis to pulley plane`}
                        value={setup.hipX * 100}
                        min={(setup.exploration ? -10 : setup.equipmentLimits?.distanceMin ?? -1.5) * 100}
                        max={(setup.exploration ? 10 : setup.equipmentLimits?.distanceMax ?? 2.5) * 100}
                        unit="cm"
                        onChange={(v) => setupChange(side, "hipX", v / 100)}
                        note="Signed X distance: negative is behind the outlet plane. The pelvis anchors the body."
                      />
                      <Field
                        label={`${letter} · Pelvis height`}
                        value={setup.hipHeight * 100}
                        min={25}
                        max={140}
                        unit="cm"
                        onChange={(v) =>
                          setupChange(side, "hipHeight", v / 100)
                        }
                      />
                      {(setup.resistance ?? "cable") === "cable" &&
                        setup.loadMode !== "mass" && (
                          <Field
                            label={`${letter} · Force per cable`}
                            value={setup.tension}
                            min={0}
                            max={500}
                            unit="N"
                            onChange={(v) => setupChange(side, "tension", v)}
                          />
                        )}
                      <p className="small-note">
                        {setup.resistance === "dumbbell"
                          ? `${setup.loadMass ?? 5} kg free weight`
                          : forceValue(setup) === null
                            ? "Unknown force"
                            : `${setup.cables} × ${forceValue(setup)!.toFixed(1)} N`}{" "}
                        tension. The 3D resultant depends on cable direction.
                        Constant tension and travel assumed available.
                      </p>
                      {!["curl", "extension", "hip"].includes(
                        setup.model ?? "pullover",
                      ) && (
                        <Field
                          label={`${letter} · Fixed elbow bend`}
                          value={setup.elbow}
                          min={0}
                          max={100}
                          unit="°"
                          onChange={(v) => setupChange(side, "elbow", v)}
                        />
                      )}
                    </div>
                  </details>
                  <details>
                    <summary>Equipment & movement range</summary>
                    <div className="details-content">
                      {!["raise", "hip", "fly", "machine"].includes(
                        setup.model ?? "pullover",
                      ) && (
                        <label className="select-field">
                          Cable arrangement
                          <select
                            aria-label={`${letter} cable arrangement`}
                            value={setup.cables}
                            onChange={(e) =>
                              setupChange(
                                side,
                                "cables",
                                Number(e.target.value),
                              )
                            }
                          >
                            <option value={1}>
                              {(setup.model ?? "pullover") === "pullover"
                                ? "One central attachment"
                                : "One loaded handle"}
                            </option>
                            <option value={2}>
                              {(setup.model ?? "pullover") === "pullover"
                                ? "Two end attachments"
                                : "Two independent handles"}
                            </option>
                          </select>
                        </label>
                      )}
                      {["raise", "hip"].includes(setup.model ?? "pullover") && (
                        <Field
                          label={`${letter} · Lateral outlet position`}
                          value={setup.outletSpacing * 50}
                          min={0}
                          max={125}
                          unit="cm"
                          onChange={(v) =>
                            setupChange(side, "outletSpacing", v / 50)
                          }
                        />
                      )}
                      {setup.cables === 2 && (
                        <>
                          <Field
                            label={`${letter} · Outlet separation`}
                            value={setup.outletSpacing * 100}
                            min={15}
                            max={250}
                            unit="cm"
                            onChange={(v) =>
                              setupChange(side, "outletSpacing", v / 100)
                            }
                          />
                          {(setup.model ?? "pullover") === "pullover" && (
                            <Field
                              label={`${letter} · Attachment separation`}
                              value={setup.attachmentSpacing * 100}
                              min={10}
                              max={150}
                              unit="cm"
                              onChange={(v) =>
                                setupChange(side, "attachmentSpacing", v / 100)
                              }
                            />
                          )}
                        </>
                      )}
                      {setup.kind === "bench" && (
                        <>
                          <Field
                            label={`${letter} · Backrest length`}
                            value={setup.backLength * 100}
                            min={35}
                            max={120}
                            unit="cm"
                            onChange={(v) =>
                              setupChange(side, "backLength", v / 100)
                            }
                          />
                          <Field
                            label={`${letter} · Backrest width`}
                            value={setup.backWidth * 100}
                            min={20}
                            max={100}
                            unit="cm"
                            onChange={(v) =>
                              setupChange(side, "backWidth", v / 100)
                            }
                          />
                          <Field
                            label={`${letter} · Backrest thickness`}
                            value={setup.backThickness * 100}
                            min={4}
                            max={22}
                            unit="cm"
                            onChange={(v) =>
                              setupChange(side, "backThickness", v / 100)
                            }
                          />
                        </>
                      )}
                      <Field
                        label={`${letter} · Minimum position`}
                        value={setup.range[0]}
                        min={getDefinition(setup).minAngle}
                        max={setup.range[1] - 1}
                        unit={getDefinition(setup).angleUnit ?? "°"}
                        onChange={(v) =>
                          setupChange(side, "range", [v, setup.range[1]])
                        }
                      />
                      <Field
                        label={`${letter} · Maximum position`}
                        value={setup.range[1]}
                        min={setup.range[0] + 1}
                        max={getDefinition(setup).maxAngle}
                        unit={getDefinition(setup).angleUnit ?? "°"}
                        onChange={(v) =>
                          setupChange(side, "range", [setup.range[0], v])
                        }
                      />
                    </div>
                  </details>
                  <details id={`body-profile-${letter.toLowerCase()}`}>
                    <summary>
                      Body profile{" "}
                      <span className="summary-note">
                        {state.lockBody ? "linked A + B" : "independent"}
                      </span>
                    </summary>
                    <div className="details-content">
                      <p className="small-note">
                        Start with fictional example proportions. Height scales
                        unmeasured, unlocked dimensions; your measurements stay
                        fixed. Equipment stays in place.
                      </p>
                      <BodyDiagram profile={profile.values} />
                      <p className="body-profile-notes">
                        Neutral segment-stack estimate:{" "}
                        {(
                          (profile.values.thigh +
                            profile.values.shank +
                            0.06 +
                            profile.values.torso +
                            profile.values.headNeck) *
                          100
                        ).toFixed(1)}{" "}
                        cm; entered height:{" "}
                        {(profile.values.height * 100).toFixed(1)} cm. This
                        estimate assumes straight legs, an upright torso, your
                        head/neck dimension, and a fixed 6 cm ankle-to-floor
                        offset. Differences do not change or stretch measured
                        segments.
                      </p>
                      {profileFields.map(
                        ([key, label, definition, min, max]) => (
                          <div className="profile-field" key={key}>
                            <Field
                              label={`${letter} · ${label}`}
                              value={profile.values[key] * 100}
                              min={min * 100}
                              max={max * 100}
                              step={0.1}
                              unit="cm"
                              onChange={(v) => bodyChange(side, key, v / 100)}
                              note={definition}
                            />
                            <div className="provenance">
                              <span>
                                {profile.provenance[key] === "measured"
                                  ? "User supplied"
                                  : profile.provenance[key] === "estimated"
                                    ? "Estimated from height"
                                    : "Example dimension"}
                              </span>
                              {key !== "height" && (
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={profile.locked[key]}
                                    onChange={(e) =>
                                      update((d) => {
                                        d.profiles[side].locked[key] =
                                          e.target.checked;
                                        if (d.lockBody)
                                          d.profiles[side === 0 ? 1 : 0] =
                                            clone(d.profiles[side]);
                                      })
                                    }
                                  />{" "}
                                  Lock
                                </label>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                      <p className="small-note">
                        Body dimensions feed the selected joint model. Grip
                        spacing on a rigid bar must remain geometrically
                        compatible. Height does not determine mobility, muscle
                        strength, or pain-free range.
                      </p>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </section>
      </div></aside>
      <StudioDialog open={dialog === "tools"} title="Tools" onClose={() => setDialog(null)}>
        <div className="tools-list">
          <button onClick={() => setDialog("command")}><Icon name="search"/>Find a tool or exercise</button>
          <button onClick={() => { setDialog(null); editSetup(0, true); }}><Icon name="measure"/>Edit body profiles</button>
          <button onClick={() => setDialog("examples")}><Icon name="compare"/>Example comparisons</button>
          <button onClick={() => setDialog("catalog")}><Icon name="movement"/>Exercise catalog</button>
          {(Object.keys(workspaceInfo) as Workspace[]).map(id => <button key={id} aria-current={workspace === id ? "page" : undefined} onClick={() => { setDialog(null); activate(id); }}><Icon name={workspaceInfo[id].icon}/>{workspaceInfo[id].label}</button>)}
          <button onClick={() => setDialog("library")}><Icon name="library"/>Library &amp; backup</button>
          <button onClick={() => setDialog("help")}><Icon name="help"/>Model &amp; data guide</button>
        </div>
        <div className="tools-files">
          <label>Comparison name<input value={state.name} maxLength={100} onChange={event => update(draft => { draft.name = event.target.value; })}/></label>
          <span className="save-label">{!savingEnabled ? "Autosave paused" : saved ? "Saved on this browser" : "Saving…"}</span>
          <button onClick={exportFile} aria-label="Export comparison">Export joint comparison</button>
          <button onClick={() => fileInput.current?.click()} aria-label="Import comparison">Import joint comparison</button>
        </div>
      </StudioDialog>
      <StudioDialog open={dialog === "catalog"} title="Exercise catalog" onClose={() => setDialog(null)}><ExerciseCatalog onPick={(side,id) => { choosePreset(side,id); setDialog(null); }}/></StudioDialog>
      <StudioDialog open={dialog === "examples"} title="Example comparisons" onClose={() => setDialog(null)}><ExampleComparisons onLoad={next => { activate("compare"); setPlaying(false); update(() => ({ ...next, viewFraming: next.viewFraming ?? { view: getDefinition(next.setups[0]).plane, zoom: 1, pan: [0,0] } })); setDialog(null); }} onNotice={setNotice}/><button className="text-action" onClick={() => { update(() => createInitialState()); activate("compare"); setDialog(null); setNotice("Example comparison restored. Undo is available."); }}>Reset to the opening comparison</button></StudioDialog>
      <StudioDialog open={dialog === "library"} title="Library & backup" onClose={() => setDialog(null)}>
        <SavedWorkspace
          state={state}
          onRestore={(next) => {
            update(() => next); activate("compare"); setDialog(null);
            setNotice("Saved comparison restored.");
          }}
          onBody={(profile, side) =>
            update((d) => {
              d.profiles[side] = profile;
              if (d.lockBody) d.profiles[side === 0 ? 1 : 0] = clone(profile);
            })
          }
          onEquipment={(setup, side) => chooseSetup(side, setup)}
          onNotice={setNotice}
        />
        <TrainingImport onPick={choosePreset} />
        <WorkspaceBackup state={state} onNotice={setNotice} onRestored={() => { comparisonPersistence.suspend(); setSavingEnabled(false); window.location.reload(); }}/>
      </StudioDialog>
      <StudioDialog open={dialog === "help"} title="Model & data guide" onClose={() => setDialog(null)}>
        <section className="model-notes" id="model-notes">
          <div>
            <p className="eyebrow">WHAT THIS MODEL TELLS YOU</p>
            <h2>
              How the model works
            </h2>
          </div>
          <div>
            <h3>Calculated within the model</h3>
            <p>
              Spatial geometry, force vectors, and signed external contributions
              about the named coordinate. Cable pull and gravity are shown
              separately. Unknown resistance remains unavailable.
            </p>
            <h3>Explicit assumptions</h3>
            <p>
              Quasi-static movement, prescribed joint paths and rigid segments.
              Tension and travel are assumed available unless the cable is
              marked slack or outside supplied travel limits. Backrest, enabled
              body proxies and supplied obstacles are checked; whole-body balance
              and clearance beyond those represented volumes are not certified.
            </p>
          </div>
          <div>
            <h3>Evidence and hypotheses</h3>
            <p>
              Body estimates and midpoint segment masses are assumptions.
              External moment alone does not determine muscle tension or growth.
              The comparison notebook separates calculations, estimates,
              evidence and questions for further study.
            </p>
            <h3>Where the knowledge comes from</h3>
            <p>The handoff and physics references define the force, moment and work principles. Rigid segments, joint axes, movement paths and starting body proportions are explicit modeling choices, not an experimentally validated digital copy of a person. Your measurements and supplied machine data add observations with their own provenance. Numerical tests check the implemented equations; they do not establish anatomical realism.</p>
            <h3>Smart tools and data</h3>
            <p>Try a setup change uses local rules and the same mechanics engine. Manual AI exchange only prepares text for you to review and share yourself; no AI service is connected and nothing is uploaded automatically. Imported proposals are constrained, recalculated and reviewed before applying to B. Formula editing and calibration also run locally.</p>
            <h3>Mechanical references</h3>
            <p>
              <a
                href="https://openstax.org/books/university-physics-volume-1/pages/10-6-torque"
                target="_blank"
                rel="noreferrer"
              >
                OpenStax: torque
              </a>{" "}
              ·{" "}
              <a
                href="https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619/How+Static+Optimization+Works"
                target="_blank"
                rel="noreferrer"
              >
                OpenSim: what muscle-force estimation requires
              </a>
            </p>
          </div>
        </section>
      </StudioDialog>
      <CommandPalette open={dialog === "command"} onClose={() => setDialog(null)} onExercise={choosePreset} commands={[
        ...(Object.keys(workspaceInfo) as Workspace[]).map(id => ({ id, label: workspaceInfo[id].label, detail: workspaceInfo[id].description, run: () => activate(id) })),
        { id: 'examples', label: 'Example comparisons', detail: 'Pulley height, lateral raises, body proportions', run: () => setDialog('examples') },
        { id: 'library', label: 'Library & backup', detail: 'Saved work, full export and recovery', run: () => setDialog('library') },
        { id: 'catalog', label: 'Exercise catalog', detail: 'Filter every modeled exercise', run: () => setDialog('catalog') },
        { id: 'setup-a', label: 'Edit setup A', detail: 'Body, resistance and equipment geometry', run: () => editSetup(0) },
        { id: 'setup-b', label: 'Edit setup B', detail: 'Body, resistance and equipment geometry', run: () => editSetup(1) },
      ]}/>
    </div>
  );
}
