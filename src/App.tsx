import { useEffect, useMemo, useRef, useState } from "react";
import { evaluate, presets, type Profile, type Setup } from "./engine";
import { Scene } from "./Scene";
import { Curve } from "./Curve";
import {
  changeHeight,
  createInitialState,
  editMeasurement,
  loadState,
  saveState,
  setAngle,
  sharedRange,
  validateState,
  type LabState,
} from "./state";

type Side = 0 | 1;
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
};
const profileFields: [keyof Profile, string, string, number, number][] = [
  ["height", "Standing height", "Floor to the top of the head", 1.2, 2.2],
  ["upperArm", "Upper arm", "Shoulder reference to elbow", 0.2, 0.5],
  ["forearm", "Forearm", "Elbow to wrist reference", 0.15, 0.45],
  ["hand", "Wrist to grip", "Wrist reference to centre of grip", 0.03, 0.18],
  ["torso", "Torso", "Pelvis to shoulder reference", 0.35, 0.8],
  [
    "shoulderWidth",
    "Shoulder width",
    "Between shoulder references; also sets grip width",
    0.25,
    0.6,
  ],
];

function Field({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
  note?: string;
}) {
  min = Math.min(min, value);
  max = Math.max(max, value);
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => {
    if (!editing) setDraft(String(Number(value.toFixed(3))));
  }, [value, editing]);
  return (
    <div className="field">
      <div className="field-heading">
        <label htmlFor={`${id}-range`}>{label}</label>
        <span className="number-wrap">
          <input
            aria-label={`${label} value`}
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            onFocus={() => setEditing(true)}
            onChange={(e) => {
              setDraft(e.target.value);
              if (
                e.target.value !== "" &&
                Number.isFinite(e.target.valueAsNumber) &&
                e.target.valueAsNumber >= min &&
                e.target.valueAsNumber <= max
              )
                onChange(e.target.valueAsNumber);
            }}
            onBlur={() => {
              const parsed = Number(draft);
              const next =
                draft.trim() !== "" && Number.isFinite(parsed)
                  ? Math.max(min, Math.min(max, parsed))
                  : value;
              setEditing(false);
              setDraft(String(Number(next.toFixed(3))));
              if (next !== value) onChange(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <span>{unit}</span>
        </span>
      </div>
      <input
        id={`${id}-range`}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {note && <small>{note}</small>}
    </div>
  );
}

export default function App() {
  const [initial] = useState(loadState);
  const [state, setState] = useState<LabState>(initial.state);
  const [notice, setNotice] = useState(initial.error ?? "");
  const [view, setView] = useState<"side" | "top">("side");
  const [annotations, setAnnotations] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(!initial.error);
  const [saved, setSaved] = useState(!initial.error);
  const [history, setHistory] = useState<LabState[]>([]);
  const [future, setFuture] = useState<LabState[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const direction = useRef(-1);
  const stateRef = useRef(state);
  stateRef.current = state;
  const profiles = useMemo<[Profile, Profile]>(
    () => [state.profiles[0].values, state.profiles[1].values],
    [state.profiles],
  );
  const results = state.setups.map((setup, i) =>
    evaluate(setup, profiles[i], state.angles[i]),
  );
  const shared = sharedRange(state);

  function update(change: (draft: LabState) => LabState | void) {
    setPlaying(false);
    const previous = stateRef.current;
    const draft = clone(previous);
    const next = change(draft) ?? draft;
    setHistory((h) => [...h.slice(-49), clone(previous)]);
    setFuture([]);
    setState(next);
  }
  useEffect(() => {
    if (!savingEnabled) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      const success = saveState(state);
      setSaved(success);
      if (!success)
        setNotice(
          "Could not save this comparison in the browser. Export it to keep a copy.",
        );
    }, 250);
    return () => clearTimeout(timer);
  }, [state, savingEnabled]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setState((previous) => {
          const interval =
            previous.sync === "angle"
              ? sharedRange(previous)
              : previous.setups[0].range;
          if (!interval || interval[0] === interval[1]) return previous;
          let next = previous.angles[0] + direction.current * 1.1;
          if (next <= interval[0]) {
            next = interval[0];
            direction.current = 1;
          }
          if (next >= interval[1]) {
            next = interval[1];
            direction.current = -1;
          }
          return setAngle(previous, 0, next);
        }),
      50,
    );
    return () => clearInterval(timer);
  }, [playing]);

  function setupChange(side: Side, key: keyof Setup, value: unknown) {
    update((draft) => {
      draft.setups[side] = { ...draft.setups[side], [key]: value };
      if (key === "tension" && draft.lockForce)
        draft.setups[side === 0 ? 1 : 0].tension = value as number;
      if (key === "range") {
        if (draft.sync === "angle" && !sharedRange(draft)) {
          draft.sync = "independent";
          setNotice(
            "These movement ranges do not overlap. Positions are now independent.",
          );
        }
        return setAngle(draft, side, draft.angles[side]);
      }
    });
  }
  function choosePreset(side: Side, name: string) {
    const preset = presets.find((p) => p.preset === name);
    if (!preset) return;
    update((draft) => {
      const tension = draft.setups[side].tension;
      draft.setups[side] = clone(preset);
      if (draft.lockForce) draft.setups[side].tension = tension;
      if (draft.sync === "angle" && !sharedRange(draft))
        draft.sync = "independent";
      return setAngle(draft, side, draft.angles[side]);
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
      const imported = validateState(JSON.parse(await file.text()));
      update(() => imported);
      setNotice(
        "Comparison imported. All settings and body profiles have been restored.",
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
  const difference =
    results[0].moment !== null && results[1].moment !== null
      ? results[1].moment - results[0].moment
      : null;

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#workspace"
          aria-label="Biomechanics Lab home"
        >
          <span className="brand-mark">
            b<span>·</span>
          </span>
          <span>
            BIOMECHANICS<span className="brand-sub">EXERCISE LAB</span>
          </span>
        </a>
        <nav aria-label="Main">
          <a className="active" href="#workspace">
            Workspace
          </a>
          <a href="#model-notes">Model notes</a>
        </nav>
        <span className="version-tag">
          <i /> Pullover study · 01
        </span>
      </header>
      <main id="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">EXPLORE THE MECHANICS</p>
            <h1>
              A different setup.
              <br className="mobile-break" /> A different pull.
            </h1>
            <p className="intro">
              Move through a pullover. Change one thing. See what changes.
            </p>
          </div>
          <div className="heading-actions">
            <button onClick={exportFile}>↓ Export</button>
            <button onClick={() => fileInput.current?.click()}>↑ Import</button>
            <input
              ref={fileInput}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </div>
        </div>
        <div className="study-bar">
          <div className="study-name">
            <span className="study-icon">
              <ArrowIcon />
            </span>
            <div>
              <span className="overline">CURRENT STUDY</span>
              <input
                aria-label="Comparison name"
                placeholder="Untitled comparison"
                value={state.name}
                maxLength={100}
                onChange={(e) =>
                  update((d) => {
                    d.name = e.target.value;
                  })
                }
              />
            </div>
          </div>
          <div className="study-actions">
            <span className="save-label">
              {!savingEnabled
                ? "Autosave paused"
                : saved
                  ? "Saved on this browser"
                  : "Saving…"}
            </span>
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
        </div>
        {!savingEnabled && (
          <div className="notice" role="status">
            The previous saved data could not be restored and has been
            preserved. This session is not saving over it.
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
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
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
          </div>
          <div className="view-options">
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
                    <span className="overline">CONFIGURATION {letter}</span>
                    <select
                      aria-label={`Configuration ${letter} preset`}
                      value={setup.preset}
                      onChange={(e) => choosePreset(side, e.target.value)}
                    >
                      {presets.map((p) => (
                        <option key={p.preset} value={p.preset}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="cable-count">
                    {setup.cables === 1 ? "1 cable" : "2 cables"}
                  </span>
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
                />
                <div className="metric-strip">
                  <div>
                    <span className="overline">TOTAL CABLE CONTRIBUTION</span>
                    <p className="moment">
                      {result.moment === null
                        ? "—"
                        : `${result.moment > 0 ? "+" : ""}${result.moment.toFixed(1)}`}{" "}
                      <small>N·m</small>
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
                    {labels[result.status] ?? result.status}
                  </div>
                </div>
                <p className="panel-footnote">
                  <strong>
                    {setup.cables} × {setup.tension} N
                  </strong>{" "}
                  ·{" "}
                  {result.status === "contact"
                    ? `${result.contactKind ?? "Cable or bar"} meets the backrest. Direct cable mechanics are unavailable here.`
                    : setup.kind === "bench"
                      ? "No contact detected with the represented backrest."
                      : "Standing setup · equipment and body clearance not evaluated."}
                </p>
                <div className="quick-settings">
                  <Field
                    label={`${letter} · Pulley height`}
                    value={setup.pulleyHeight * 100}
                    min={5}
                    max={300}
                    unit="cm"
                    onChange={(v) => setupChange(side, "pulleyHeight", v / 100)}
                  />
                  <Field
                    label={`${letter} · ${setup.kind === "bench" ? "Backrest above floor" : "Torso from vertical"}`}
                    value={setup.tilt}
                    min={setup.kind === "bench" ? 0 : -30}
                    max={90}
                    unit="°"
                    onChange={(v) => setupChange(side, "tilt", v)}
                  />
                </div>
              </article>
            );
          })}
        </section>
        <section className="movement-panel" aria-label="Movement controls">
          <div className="movement-title">
            <span className="overline">MOVE THROUGH THE REP</span>
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
                <option value="angle" disabled={!shared}>
                  the same angle
                </option>
                <option value="progress">the same progress</option>
                <option value="independent">independent positions</option>
              </select>
            </label>
          </div>
          <div className="movement-row">
            <button
              className={`play-button ${playing ? "is-playing" : ""}`}
              disabled={
                state.sync === "angle" && (!shared || shared[0] === shared[1])
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
              {(state.sync === "independent" ? [0, 1] : [0]).map((i) => (
                <Field
                  key={i}
                  label={
                    state.sync === "independent"
                      ? `${i === 0 ? "A" : "B"} · Arm elevation`
                      : "Arm elevation relative to torso"
                  }
                  value={state.angles[i]}
                  min={
                    state.sync === "angle" && shared
                      ? shared[0]
                      : state.setups[i].range[0]
                  }
                  max={
                    state.sync === "angle" && shared
                      ? shared[1]
                      : state.setups[i].range[1]
                  }
                  step={0.5}
                  unit="°"
                  onChange={(v) => update((d) => setAngle(d, i as Side, v))}
                />
              ))}
            </div>
            <div className="angle-readout">
              <span className="a-text">A {state.angles[0].toFixed(0)}°</span>
              <span className="b-text">B {state.angles[1].toFixed(0)}°</span>
            </div>
          </div>
          <div className="movement-caption">
            <span>
              0° alongside torso · 180° overhead · beyond 180° exploratory
            </span>
            <span>
              {state.sync === "progress"
                ? "Equal progress does not mean equal joint angles."
                : "Reference action: bring the arms toward the torso."}
            </span>
          </div>
        </section>
        <section className="analysis-grid" aria-label="Results">
          <article className="curve-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE RESISTANCE PROFILE</p>
                <h2>Where does the pull change?</h2>
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
              onAngle={(angle) => update((d) => setAngle(d, 0, angle))}
            />
            <p className="chart-caption">
              Above zero resists the pull toward the torso; below zero assists
              it. Gaps indicate contact or unavailable mechanics.
            </p>
          </article>
          <aside className="insight-card">
            <span className="insight-symbol">
              <ArrowIcon />
            </span>
            <p className="eyebrow">READING THIS COMPARISON</p>
            <h2>
              {difference === null
                ? "A limit changes the story."
                : Math.abs(difference) < 0.1
                  ? "The external moments match."
                  : `${Math.abs(difference).toFixed(1)} N·m ${difference > 0 ? "higher" : "lower"} in B.`}
            </h2>
            <p>
              {difference === null
                ? "At least one setup has contact or an invalid position. Move to a valid position to compare the direct cable contributions."
                : `At A ${state.angles[0].toFixed(0)}° and B ${state.angles[1].toFixed(0)}°, the difference is in the total external cable contribution to the symmetric movement.`}
            </p>
            <div className="insight-divider" />
            <p className="insight-note">
              Try copying A into B, then changing only pulley height. Keep force
              and body dimensions locked to isolate that change.
            </p>
            <button
              onClick={() =>
                update((d) => {
                  d.setups[1] = clone(d.setups[0]);
                  d.setups[1].pulleyHeight = Math.max(
                    0.05,
                    d.setups[0].pulleyHeight - 0.4,
                  );
                  d.profiles[1] = clone(d.profiles[0]);
                  d.angles[1] = d.angles[0];
                  d.lockBody = true;
                  d.lockForce = true;
                  d.sync = "angle";
                  d.name = "What changes with a lower pulley?";
                })
              }
            >
              Try a pulley-height comparison →
            </button>
          </aside>
        </section>
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
                      if (d.lockForce)
                        d.setups[1].tension = d.setups[0].tension;
                    })
                  }
                />
                Same force per cable
              </label>
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
                >
                  <h3>
                    <span className="letter-badge">{letter}</span>
                    {setup.name}
                  </h3>
                  <details open>
                    <summary>Position & cable force</summary>
                    <div className="details-content">
                      <Field
                        label={`${letter} · Pelvis to pulley plane`}
                        value={setup.hipX * 100}
                        min={-150}
                        max={250}
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
                      <Field
                        label={`${letter} · Force per cable`}
                        value={setup.tension}
                        min={0}
                        max={500}
                        unit="N"
                        onChange={(v) => setupChange(side, "tension", v)}
                      />
                      <p className="small-note">
                        {setup.cables} × {setup.tension} N tension. The 3D
                        resultant depends on cable direction. Constant tension
                        and travel assumed available.
                      </p>
                      <Field
                        label={`${letter} · Fixed elbow bend`}
                        value={setup.elbow}
                        min={0}
                        max={100}
                        unit="°"
                        onChange={(v) => setupChange(side, "elbow", v)}
                      />
                    </div>
                  </details>
                  <details>
                    <summary>Equipment & movement range</summary>
                    <div className="details-content">
                      <label className="select-field">
                        Cable arrangement
                        <select
                          aria-label={`${letter} cable arrangement`}
                          value={setup.cables}
                          onChange={(e) =>
                            setupChange(side, "cables", Number(e.target.value))
                          }
                        >
                          <option value={1}>One central attachment</option>
                          <option value={2}>Two end attachments</option>
                        </select>
                      </label>
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
                        label={`${letter} · Minimum elevation`}
                        value={setup.range[0]}
                        min={0}
                        max={setup.range[1] - 1}
                        unit="°"
                        onChange={(v) =>
                          setupChange(side, "range", [v, setup.range[1]])
                        }
                      />
                      <Field
                        label={`${letter} · Maximum elevation`}
                        value={setup.range[1]}
                        min={setup.range[0] + 1}
                        max={200}
                        unit="°"
                        onChange={(v) =>
                          setupChange(side, "range", [setup.range[0], v])
                        }
                      />
                    </div>
                  </details>
                  <details>
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
                        The illustration uses a symmetric, fixed-elbow arm
                        model. Grip width follows shoulder width; bar
                        attachments are separate. The head contour is schematic;
                        lower-body geometry is not yet modeled.
                      </p>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </section>
        <section className="model-notes" id="model-notes">
          <div>
            <p className="eyebrow">WHAT THIS MODEL TELLS YOU</p>
            <h2>
              Geometry first.
              <br />
              Interpretation with care.
            </h2>
          </div>
          <div>
            <h3>Calculated</h3>
            <p>
              3D cable forces and their total contribution to a symmetric
              pullover with fixed elbows. Positive values resist bringing the
              arms toward the torso—even during the return animation.
            </p>
            <h3>Assumed</h3>
            <p>
              Constant cable tension, fixed outlets, a rigid bar, and available
              cable travel. Gravity, friction, inertia, and individual shoulder
              load sharing are excluded. Contact checks cover the represented
              backrest only.
            </p>
          </div>
          <div>
            <h3>Not inferred</h3>
            <p>
              External moment is not muscle tension, muscle activation, or a
              hypertrophy score. Body dimensions are editable geometric inputs;
              they do not establish mobility or training suitability.
            </p>
            <h3>Next study</h3>
            <p>
              Map pulley height against distance for a chosen overhead range,
              then check how sensitive clearance is to your actual bench
              dimensions.
            </p>
          </div>
        </section>
        <footer>
          <span>
            BIOMECHANICS LAB <span className="footer-dot">/</span> First
            interactive milestone
          </span>
          <button
            onClick={() => {
              update(() => createInitialState());
              setNotice("Example comparison restored. Undo is available.");
            }}
          >
            Reset to example
          </button>
          <span>
            Your settings stay in this browser. Export to keep a copy.
          </span>
        </footer>
      </main>
    </div>
  );
}
