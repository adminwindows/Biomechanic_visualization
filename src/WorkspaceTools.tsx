import { useEffect, useRef, useState } from "react";
import { presets, getDefinition, type Profile, type Setup } from "./engine";
import { MAX_IMPORT_BYTES, type LabState, type BodyProfile } from "./state";
import {
  listSavedComparisons,
  saveComparison,
  loadComparison,
  deleteComparison,
  setComparisonFavorite,
  listBodyProfiles,
  saveBodyProfile,
  loadBodyProfile,
  deleteBodyProfile,
  listEquipmentProfiles,
  saveEquipmentProfile,
  loadEquipmentProfile,
  deleteEquipmentProfile,
  exportLibrary,
  importLibrary,
} from "./library";
import {
  parseTraining,
  resolveTrainingMatch,
  type TrainingMatch,
} from "./training";
import { Field } from "./Field";
import { AdvancedExerciseControls } from "./AdvancedExerciseControls";
import "./workspace-tools.css";
import { emptyCatalogFilters, type CatalogFilters } from "./catalog";
import { allExerciseEntries, matchesExercise } from "./allExercises";
import { readSelection, saveSelection, replaceSelectionWithBackup, SelectionProtectionError, type SelectionKey } from './selectionStorage';

export function downloadText(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useProtectedSelection<T>(key: SelectionKey, fallback: T) {
  const [initial] = useState(() => readSelection(key, fallback));
  const [value, setValue] = useState(initial.value);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [error, setError] = useState(initial.error);
  const latest = useRef({ value, blocked }); latest.current = { value, blocked };
  const failed = (reason: unknown) => {
    if (reason instanceof SelectionProtectionError) setBlocked(true);
    const message = `${reason instanceof Error ? reason.message : 'Browser storage is unavailable.'} Current edits have not been saved.`;
    setError(message); return message;
  };
  useEffect(() => {
    if (blocked) return;
    try { saveSelection(key, value); setError(''); } catch (reason) { failed(reason); }
  }, [key, value, blocked]);
  useEffect(() => {
    const flush = (event: Event) => {
      try {
        if (latest.current.blocked) throw new Error('Unreadable exercise selection data is protected; download raw recovery before replacing it.');
        saveSelection(key, latest.current.value); setError('');
      } catch (reason) {
        const message = failed(reason);
        const errors = (event as CustomEvent<{ errors?: string[] }>).detail?.errors;
        if (errors) errors.push(message);
      }
    };
    window.addEventListener('biomechanics:flush-workspaces', flush);
    return () => window.removeEventListener('biomechanics:flush-workspaces', flush);
  }, [key]);
  const recover = () => {
    try { replaceSelectionWithBackup(key, value); setBlocked(false); setError(''); }
    catch (reason) { failed(reason); }
  };
  return { value, setValue, blocked, error, recover };
}
function SelectionStorageNotice({ label, store }: { label: string; store: { error: string; blocked: boolean; recover: () => void } }) {
  if (!store.error) return null;
  return <div className="selection-storage-notice"><p role="alert">{label}: {store.error}</p>{store.blocked && <><p className="small-note">Whole workspace backup → Download raw recovery keeps the original contents in a file. Enabling saving also retains a local recovery copy before replacing this section.</p><button onClick={store.recover}>Preserve original & enable {label.toLowerCase()} saving</button></>}</div>;
}
export function ExerciseCatalog({
  onPick,
}: {
  onPick: (side: 0 | 1, preset: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("all");
  const [filters, setFilters] = useState<CatalogFilters>({ ...emptyCatalogFilters });
  const favoriteStore = useProtectedSelection<string[]>('biomechanics.exercise-favorites', []);
  const { value: favorites, setValue: setFavorites } = favoriteStore;
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [target, setTarget] = useState<0 | 1>(0);
  const groups = Array.from(new Set(allExerciseEntries.map((entry) => entry.family)));
  const filterDefinitions: { key: keyof CatalogFilters; label: string; all: string; values: string[] }[] = [
    { key: "muscleGroup", label: "Muscle group", all: "All muscle groups", values: allExerciseEntries.flatMap((entry) => [...entry.muscleGroups]) },
    { key: "equipment", label: "Equipment", all: "All equipment", values: allExerciseEntries.flatMap((entry) => [...entry.equipment]) },
    { key: "mainJoint", label: "Main joint", all: "All joints", values: allExerciseEntries.map((entry) => entry.mainJoint) },
    { key: "posture", label: "Posture", all: "All postures", values: allExerciseEntries.flatMap((entry) => [...entry.postures]) },
    { key: "laterality", label: "Sides", all: "Both arrangements", values: allExerciseEntries.map((entry) => entry.laterality) },
    { key: "status", label: "Available model", all: "All model statuses", values: allExerciseEntries.map((entry) => entry.status) },
  ];
  const visible = allExerciseEntries.filter((entry) =>
    (family === "all" || entry.family === family) &&
    (!onlyFavorite || favorites.includes(entry.id)) &&
    matchesExercise(entry, search, filters),
  );
  const hasFilters = search !== "" || family !== "all" || onlyFavorite || Object.values(filters).some((value) => value !== "all");
  const clearFilters = () => { setSearch(""); setFamily("all"); setOnlyFavorite(false); setFilters({ ...emptyCatalogFilters }); };
  return (
    <details className="workspace-drawer catalog-drawer" id="catalog">
      <summary>
        <span>Exercise catalog</span>
        <span className="drawer-description">
          Isolated and compound movements · explicit model status
        </span>
      </summary>
      <div className="drawer-body">
        <SelectionStorageNotice label="Favorites" store={favoriteStore}/>
        <div className="catalog-filters">
          <input
            type="search"
            aria-label="Search exercises"
            placeholder="Search names or aliases, e.g. lat prayer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Exercise family"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          >
            <option value="all">All families</option>
            {groups.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={onlyFavorite}
              onChange={(e) => setOnlyFavorite(e.target.checked)}
            />
            Favorites
          </label>
          <label>
            Load into{" "}
            <select
              aria-label="Catalog target"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value) as 0 | 1)}
            >
              <option value={0}>A</option>
              <option value={1}>B</option>
            </select>
          </label>
        </div>
        <fieldset className="catalog-refinements">
          <legend>Refine the starting setup</legend>
          <div className="catalog-filter-grid">
            {filterDefinitions.map((filter) => (
              <label key={filter.key}>
                <span>{filter.label}</span>
                <select aria-label={`Catalog ${filter.label.toLowerCase()}`} value={filters[filter.key]} onChange={(event) => setFilters((old) => ({ ...old, [filter.key]: event.target.value }))}>
                  <option value="all">{filter.all}</option>
                  {[...new Set(filter.values)].sort().map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="catalog-results">
          <p role="status" aria-live="polite">{visible.length} of {allExerciseEntries.length} setups</p>
          {hasFilters && <button onClick={clearFilters}>Clear filters</button>}
        </div>
        <div className="catalog-list">
          {visible.map((entry) => { const p = { preset: entry.id, name: entry.name }; return (
            <div key={p.preset} className="catalog-item">
              <button
                className="catalog-pick"
                onClick={() => onPick(target, p.preset)}
              >
                <strong>{p.name}</strong>
                <span>{entry.family} · {entry.mainJoint}</span>
                <span>{entry.equipment.join(" + ")} · {entry.laterality}</span>
                <span className={`catalog-model-status ${entry.status === "Geometry only" ? "catalog-geometry-only" : ""}`}>{entry.status === "Geometry only" ? "Geometry only · mechanism unknown" : `${entry.status} · simplified model`}</span>
              </button>
              <button
                aria-label={`${favorites.includes(p.preset) ? "Unfavorite" : "Favorite"} ${p.name}`}
                aria-pressed={favorites.includes(p.preset)}
                onClick={() =>
                  setFavorites((old) =>
                    old.includes(p.preset)
                      ? old.filter((id) => id !== p.preset)
                      : [...old, p.preset],
                  )
                }
              >
                {favorites.includes(p.preset) ? "★" : "☆"}
              </button>
            </div>
          ); })}
        </div>
        {!visible.length && <p>No exercises match these filters.</p>}
        <p className="small-note">
          Muscle groups are navigation tags, not calculated recruitment. Filters
          describe each preset’s starting setup. Geometry-only entries have no
          calculated resistance profile. Different joint coordinates are shown
          separately rather than ranked or overlaid as equivalent.
        </p>
      </div>
    </details>
  );
}

export function SavedWorkspace({
  state,
  onRestore,
  onBody,
  onEquipment,
  onNotice,
}: {
  state: LabState;
  onRestore: (state: LabState) => void;
  onBody: (profile: BodyProfile, side: 0 | 1) => void;
  onEquipment: (setup: Setup, side: 0 | 1) => void;
  onNotice: (message: string) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState("");
  const [source, setSource] = useState<0 | 1>(0);
  const [showFavorites, setShowFavorites] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const safely = (action: () => void) => {
    try {
      action();
      setRevision((r) => r + 1);
    } catch (e) {
      onNotice(
        e instanceof Error ? e.message : "Could not access the saved library.",
      );
    }
  };
  let comparisons: ReturnType<typeof listSavedComparisons> = [],
    bodies: ReturnType<typeof listBodyProfiles> = [],
    equipment: ReturnType<typeof listEquipmentProfiles> = [];
  let error = "";
  try {
    comparisons = listSavedComparisons();
    bodies = listBodyProfiles();
    equipment = listEquipmentProfiles();
  } catch (e) {
    error = e instanceof Error ? e.message : "Library unavailable";
  }
  void revision;
  return (
    <details className="workspace-drawer" id="saved-library">
      <summary>
        <span>Saved comparisons & profiles</span>
        <span className="drawer-description">
          {comparisons.length} comparisons · {bodies.length} body profiles
        </span>
      </summary>
      <div className="drawer-body">
        {error && <p role="status">{error}</p>}
        <div className="library-save">
          <input
            aria-label="Library item name"
            value={name}
            placeholder="Name this setup or comparison"
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={() =>
              safely(() => {
                saveComparison(
                  state,
                  name.trim() || state.name || "Untitled comparison",
                );
                onNotice("Comparison saved in your library.");
              })
            }
          >
            Save comparison
          </button>
          <label>
            Profile from{" "}
            <select
              aria-label="Profile source"
              value={source}
              onChange={(e) => setSource(Number(e.target.value) as 0 | 1)}
            >
              <option value={0}>A</option>
              <option value={1}>B</option>
            </select>
          </label>
          <button
            onClick={() =>
              safely(() => {
                saveBodyProfile(
                  state.profiles[source],
                  name.trim() || "My body profile",
                );
                onNotice(
                  "Body profile saved with measurements and provenance.",
                );
              })
            }
          >
            Save body profile
          </button>
          <button
            onClick={() =>
              safely(() => {
                saveEquipmentProfile(
                  state.setups[source],
                  name.trim() || state.setups[source].name,
                );
                onNotice("Equipment/setup snapshot saved.");
              })
            }
          >
            Save equipment/setup
          </button>
        </div>
        <div className="library-grid">
          <section>
            <h3>Comparisons</h3>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={showFavorites}
                onChange={(e) => setShowFavorites(e.target.checked)}
              />
              Favorites only
            </label>
            {comparisons
              .filter((c) => !showFavorites || c.favorite)
              .map((c) => (
                <div className="saved-row" key={c.id}>
                  <div>
                    <strong>{c.name || "Untitled"}</strong>
                    <small>{new Date(c.updatedAt).toLocaleDateString()}</small>
                  </div>
                  <button
                    onClick={() =>
                      safely(() => {
                        onRestore(loadComparison(c.id));
                        if (c.sourceModelVersion)
                          onNotice(
                            `Comparison recalculated from ${c.sourceModelVersion} with the current mechanics model; a backup is preserved.`,
                          );
                      })
                    }
                  >
                    Open
                  </button>
                  <button
                    aria-label={`Favorite comparison ${c.name}`}
                    aria-pressed={c.favorite}
                    onClick={() =>
                      safely(() => setComparisonFavorite(c.id, !c.favorite))
                    }
                  >
                    {c.favorite ? "★" : "☆"}
                  </button>
                  <button
                    onClick={() => safely(() => deleteComparison(c.id))}
                    aria-label={`Delete comparison ${c.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            {!comparisons.length && (
              <p className="small-note">
                Save a comparison to return to all its settings later.
              </p>
            )}
          </section>
          <section>
            <h3>Body profiles</h3>
            {bodies.map((b) => (
              <div className="saved-row" key={b.id}>
                <div>
                  <strong>{b.name}</strong>
                  <small>{Math.round(b.profile.values.height * 100)} cm</small>
                </div>
                <button
                  onClick={() =>
                    safely(() => onBody(loadBodyProfile(b.id), source))
                  }
                >
                  Use in {source ? "B" : "A"}
                </button>
                <button
                  aria-label={`Delete body ${b.name}`}
                  onClick={() => safely(() => deleteBodyProfile(b.id))}
                >
                  Delete
                </button>
              </div>
            ))}
            <h3>Equipment/setup snapshots</h3>
            {equipment.map((e) => (
              <div className="saved-row" key={e.id}>
                <strong>{e.name}</strong>
                <button
                  onClick={() =>
                    safely(() =>
                      onEquipment(loadEquipmentProfile(e.id), source),
                    )
                  }
                >
                  Use in {source ? "B" : "A"}
                </button>
                <button
                  aria-label={`Delete equipment ${e.name}`}
                  onClick={() => safely(() => deleteEquipmentProfile(e.id))}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>
        </div>
        <div className="library-actions">
          <button
            onClick={() =>
              safely(() =>
                downloadText(exportLibrary(), "biomechanics-library.json"),
              )
            }
          >
            Export entire library
          </button>
          <button onClick={() => file.current?.click()}>Import library</button>
          <input
            ref={file}
            hidden
            aria-label="Import library file"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > MAX_IMPORT_BYTES)
                  throw new Error("Library file must be under 1 MB.");
                const result = importLibrary(await f.text(), "merge");
                setRevision((r) => r + 1);
                onNotice(
                  `Imported ${result.comparisons} comparisons, ${result.bodies} body profiles, ${result.equipment} equipment snapshots.`,
                );
              } catch (err) {
                onNotice(
                  err instanceof Error ? err.message : "Invalid library",
                );
              }
              e.target.value = "";
            }}
          />
          <p className="small-note">
            Saved only in this browser. Export a backup to move to another
            device. Loading a profile respects your A/B body lock.
          </p>
        </div>
      </div>
    </details>
  );
}

export function TrainingImport({
  onPick,
}: {
  onPick: (side: 0 | 1, preset: string) => void;
}) {
  const textStore = useProtectedSelection<string>('biomechanics.training-list', '');
  const matchStore = useProtectedSelection<TrainingMatch[]>('biomechanics.training-matches', []);
  const { value: text, setValue: setText } = textStore;
  const { value: matches, setValue: setMatches } = matchStore;
  const [error, setError] = useState("");
  return (
    <details className="workspace-drawer">
      <summary>
        <span>Your exercise list</span>
        <span className="drawer-description">
          Paste names or CSV · keep unmatched exercises for later
        </span>
      </summary>
      <div className="drawer-body">
        <SelectionStorageNotice label="Exercise-list text" store={textStore}/>
        <SelectionStorageNotice label="Exercise mappings" store={matchStore}/>
        <p className="small-note">
          Import serves exercise selection. Loads, sets and repetitions are not
          interpreted as force or coaching instructions.
        </p>
        <textarea
          aria-label="Training exercise list"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Low cable curl\nOverhead extension\nCable lateral raise"
          }
          rows={5}
        />
        <button
          onClick={() => {
            try {
              setMatches(parseTraining(text));
              setError("");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Could not read exercise list.",
              );
            }
          }}
        >
          Match exercises
        </button>
        {error && <p role="alert">{error}</p>}
        <div className="training-matches">
          {matches.map((item) => (
            <div key={item.id} className="training-row">
              <div>
                <strong>{item.label}</strong>
                <small>{item.status}</small>
              </div>
              <select
                aria-label={`Match ${item.label}`}
                value={item.selectedPreset ?? ""}
                onChange={(e) => {
                  if (e.target.value)
                    setMatches((items) =>
                      items.map((m) =>
                        m.id === item.id
                          ? resolveTrainingMatch(m, e.target.value)
                          : m,
                      ),
                    );
                }}
              >
                <option value="">Choose a matching exercise</option>
                {allExerciseEntries.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!item.selectedPreset}
                onClick={() =>
                  item.selectedPreset && onPick(0, item.selectedPreset)
                }
              >
                Load A
              </button>
            </div>
          ))}
        </div>
        <p className="small-note">
          Ambiguous and unsupported names are retained for your review. A
          machine-specific profile cannot be inferred from a name.
        </p>
      </div>
    </details>
  );
}

export function ModelControls({ setup:s, profile, letter:L, change }: {
  setup:Setup;profile:Profile;letter:string;change:(key:keyof Setup,value:unknown)=>void;
}) {
  const model=s.model??'pullover',d=getDefinition(s),leg=/^(hip|knee)/.test(model),distal=/^(wrist|forearm)/.test(model);
  const known=s.forceKnown!==false&&s.resistance!=='unknown'&&model!=='machine',cable=s.resistance!=='dumbbell';
  const number=(key:keyof Setup,label:string,value:number,min:number,max:number,unit='°',step=1,note?:string)=><Field key={key} label={`${L} · ${label}`} value={value} min={min} max={max} unit={unit} step={step} note={note} onChange={v=>change(key,v)}/>;
  const select=(key:keyof Setup,label:string,value:string,options:[string,string][],aria?:string)=><label className="select-field">{label}<select aria-label={aria??`${L} ${label.toLowerCase()}`} value={value} onChange={e=>change(key,e.target.value)}>{options.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>;
  return <><details open><summary>Movement model & load</summary><div className="details-content">
    <p className="small-note"><strong>{d.family}</strong> · Reference action: {d.action}. Values describe {d.forceConvention}.</p>
    {model!=='machine'&&<>
      <label className="select-field">Facing direction<select aria-label={`${L} facing direction`} value={s.facing} onChange={e=>change('facing',Number(e.target.value))}><option value={-1}>Toward the outlet plane</option><option value={1}>Away from the outlet plane</option></select></label>
      {select('resistance','Resistance',s.resistance??'cable',[['cable','Cable force'],['dumbbell','Gravity / free weight'],['unknown','Unknown resistance']],`${L} resistance type`)}
      {known&&cable&&<>
        {select('loadMode','Load entry',s.loadMode??'force',[['force','Actual force (N)'],['mass','Selected mass + factor']])}
        {s.loadMode==='mass'&&<>{number('loadMass','Selected mass',s.loadMass??10,0,500,'kg',.5)}{s.transmissionFactor===undefined?<><p className="small-note">Transmission is unknown; selected mass does not determine attachment force.</p><button onClick={()=>change('transmissionFactor',1)}>Declare factor 1</button></>:<>{number('transmissionFactor','Force transmission factor',s.transmissionFactor,0,10,'×',.05,'Force per attachment = total selected mass × 9.81 × this attachment factor.')}<button onClick={()=>change('transmissionFactor',undefined)}>Mark transmission unknown</button></>}</>}
        <label className="inline-check"><input type="checkbox" checked={s.slack??false} onChange={e=>change('slack',e.target.checked)}/>Cable explicitly slack</label>
        <label className="inline-check"><input type="checkbox" checked={s.forceKnown!==false} onChange={e=>change('forceKnown',e.target.checked)}/>Actual cable force is known</label>
      </>}
      {!known&&s.resistance!=='unknown'&&<label className="inline-check"><input type="checkbox" checked={false} onChange={()=>change('forceKnown',true)}/>Actual cable force is known</label>}
      {!cable&&known&&<>
        {select('freeWeightKind','Free-weight convention',s.freeWeightKind??'dumbbell',[['dumbbell','Mass per loaded hand / ankle'],['barbell','Total rigid-bar mass'],['shared','Total shared implement mass']])}
        {number('loadMass','Free-weight mass',s.loadMass??5,0,500,'kg',.25,s.freeWeightKind==='barbell'||s.freeWeightKind==='shared'?'Total implement mass, counted once. For two hands only total generalized resistance is inferred.':'Mass per loaded hand or ankle. Bilateral models include two loads.')}
      </>}
      {!leg&&model!=='pullover'&&select('loadedSides','Loaded sides',s.loadedSides??(['fly','reverse-fly','shrug'].includes(model)||s.cables===2?'bilateral':'unilateral'),[['unilateral','One loaded side'],['bilateral','Both loaded sides']])}
      {select('posture','Posture',s.posture??(s.kind==='bench'?'seated':'standing'),[['standing','Standing'],['kneeling','Kneeling'],['seated','Seated / bench supported'],['supine','Supine / face up'],['prone','Prone / face down'],...(model==='pullover'?[]:[['side-lying','Side lying']] as [string,string][])])}
      <p className="small-note">Segment lengths stay fixed. Incompatible supports, bar grips and floor intersections are flagged; support reaction forces are not inferred.</p>
    </>}
    {(['curl','extension'].includes(model)||distal)&&number('upperArmAngle','Upper-arm elevation',s.upperArmAngle??0,-90,200,'°',1,'Upper-arm posture remains fixed while the distal joint moves.')}
    {['raise','fly','reverse-fly','curl','extension'].includes(model)&&number('movementPlane','Movement plane',s.movementPlane??0,-180,180,'°',1,model==='raise'?'0° lateral, 30° scaption, 90° forward elevation. This changes the actual arm trajectory.':model==='fly'||model==='reverse-fly'?'0° horizontal adduction; positive planes tilt the forward hand path upward. Different planes have different axes.':'Rotates the forearm motion plane around the fixed upper arm; rigid bars may become incompatible.')}
    {s.posture==='side-lying'&&number('bodyRoll','Body roll',s.bodyRoll??-90,-180,180,'°',1,'Sets the supported torso orientation; this is a prescribed body frame.')}
    {model.startsWith('knee-')&&number('jointPlacement','Thigh placement',s.jointPlacement??90,-180,200,'°',1,'Fixed thigh angle from downward vertical, with the knee moving in the prescribed sagittal plane.')}
    {distal&&number('elbow','Fixed elbow flexion',s.elbow,0,160)}
    {model.startsWith('wrist-')&&number('forearmRotation','Forearm rotation',s.forearmRotation??0,-180,180,'°',1,'Rotates the anatomical wrist-flexion plane; 180° reverses palm orientation.')}
    {model==='forearm-rotation'&&<><Field label={`${L} · Rotation lever offset`} value={(s.rotationLever??.12)*100} min={.5} max={100} unit="cm" step={.5} onChange={v=>change('rotationLever',v/100)} note="Explicit perpendicular load lever; a load on the forearm axis produces zero moment."/>{select('rotationDirection','Reference rotation',s.rotationDirection??'pronation',[['pronation','Positive rotation / pronation'],['supination','Negative rotation / supination']])}</>}
    {['curl','extension'].includes(model)&&<>{select('gripStyle','Grip annotation',s.gripStyle??'supinated',[['supinated','Supinated'],['neutral','Neutral / hammer'],['pronated','Pronated / reverse'],['ez','EZ handle']])}<p className="small-note">Grip labels do not change recruitment or muscle force. Only the declared segment path, load and joint axis affect this external calculation.</p></>}
    {(model==='pullover'||s.freeWeightKind==='barbell')&&<><Field label={`${L} · Bar length`} value={(s.barLength??Math.max(.6,s.attachmentSpacing+.08))*100} min={10} max={300} unit="cm" onChange={v=>change('barLength',v/100)}/><Field label={`${L} · Grip separation`} value={(s.gripWidth??profile.shoulderWidth)*100} min={5} max={150} unit="cm" onChange={v=>change('gripWidth',v/100)} note="Segment lengths and fixed elbow bend are preserved. Incompatible widths are flagged."/><button onClick={()=>change('gripWidth',undefined)}>Derive grip width from shoulders</button></>}
    {model!=='machine'&&<><label className="inline-check"><input type="checkbox" checked={s.segmentGravity??false} onChange={e=>change('segmentGravity',e.target.checked)}/>Include explicitly estimated segment weight</label>{s.segmentGravity&&(distal?number('handMass','Moving hand mass',s.handMass??0,0,5,'kg',.05,'Uniform hand segment; this mass must be explicitly estimated.'):<>{number(leg?'thighMass':'upperArmMass',leg?'Thigh mass':'Upper segment mass',(leg?s.thighMass:s.upperArmMass)??0,0,50,'kg',.1,'Explicit mass; center of mass at the segment midpoint.')}{number(leg?'shankMass':'forearmMass',leg?'Lower-leg mass':'Distal segment mass',(leg?s.shankMass:s.forearmMass)??0,0,50,'kg',.1,'Explicit mass; center of mass at the segment midpoint.')}</>)}</>}
    <p className="small-note">Quasi-static model: animation speed does not change the calculated forces. Exact muscle force, effort and growth are not calculated.</p>
  </div></details><AdvancedExerciseControls setup={s} profile={profile} letter={L} change={change}/></>;
}
