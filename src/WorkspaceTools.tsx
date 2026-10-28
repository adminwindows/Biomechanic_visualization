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
import "./workspace-tools.css";

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
function readFavorites(): string[] {
  try {
    return JSON.parse(
      localStorage.getItem("biomechanics.exercise-favorites") ?? "[]",
    ).filter((id: unknown) => typeof id === "string");
  } catch {
    return [];
  }
}
export function ExerciseCatalog({
  onPick,
}: {
  onPick: (side: 0 | 1, preset: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("all");
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [target, setTarget] = useState<0 | 1>(0);
  useEffect(() => {
    try {
      localStorage.setItem(
        "biomechanics.exercise-favorites",
        JSON.stringify(favorites),
      );
    } catch {}
  }, [favorites]);
  const groups = Array.from(
    new Set(presets.map((p) => getDefinition(p).family)),
  );
  const visible = presets.filter(
    (p) =>
      (family === "all" || getDefinition(p).family === family) &&
      (!onlyFavorite || favorites.includes(p.preset)) &&
      `${p.name} ${getDefinition(p).family} ${getDefinition(p).angleLabel}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <details className="workspace-drawer catalog-drawer" id="catalog">
      <summary>
        <span>Exercise catalog</span>
        <span className="drawer-description">
          Six model families · search, compare, favorite
        </span>
      </summary>
      <div className="drawer-body">
        <div className="catalog-filters">
          <input
            type="search"
            aria-label="Search exercises"
            placeholder="Search exercises or movement…"
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
        <div className="catalog-list">
          {visible.map((p) => (
            <div key={p.preset} className="catalog-item">
              <button
                className="catalog-pick"
                onClick={() => onPick(target, p.preset)}
              >
                <strong>{p.name}</strong>
                <span>
                  {getDefinition(p).family} ·{" "}
                  {p.resistance === "unknown" || p.model === "machine"
                    ? "Geometry only"
                    : getDefinition(p).angleLabel}
                </span>
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
          ))}
        </div>
        {!visible.length && <p>No exercises match these filters.</p>}
        <p className="small-note">
          The catalog contains distinct joint and force models. Exercises with
          different joint coordinates can be viewed together, but their moments
          are not ranked or overlaid as equivalent.
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
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem("biomechanics.training-list") ?? "";
    } catch {
      return "";
    }
  });
  const [matches, setMatches] = useState<TrainingMatch[]>(() => {
    try {
      const rows = JSON.parse(
        localStorage.getItem("biomechanics.training-matches") ?? "[]",
      );
      if (!Array.isArray(rows)) return [];
      return rows
        .filter(
          (m: TrainingMatch) =>
            m &&
            typeof m.original === "string" &&
            typeof m.id === "string" &&
            typeof m.label === "string" &&
            Array.isArray(m.candidates) &&
            ["matched", "ambiguous", "unrecognized"].includes(m.status) &&
            (!m.selectedPreset ||
              presets.some((p) => p.preset === m.selectedPreset)),
        )
        .slice(0, 500);
    } catch {
      return [];
    }
  });
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem("biomechanics.training-list", text);
    } catch {}
  }, [text]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "biomechanics.training-matches",
        JSON.stringify(matches),
      );
    } catch {}
  }, [matches]);
  return (
    <details className="workspace-drawer">
      <summary>
        <span>Your exercise list</span>
        <span className="drawer-description">
          Paste names or CSV · keep unmatched exercises for later
        </span>
      </summary>
      <div className="drawer-body">
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
                {presets.map((p) => (
                  <option key={p.preset} value={p.preset}>
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

export function ModelControls({
  setup,
  profile,
  letter,
  change,
}: {
  setup: Setup;
  profile: Profile;
  letter: string;
  change: (key: keyof Setup, value: unknown) => void;
}) {
  const model = setup.model ?? "pullover";
  const d = getDefinition(setup);
  const known =
    setup.forceKnown !== false &&
    setup.resistance !== "unknown" &&
    model !== "machine";
  const cable = setup.resistance !== "dumbbell";
  return (
    <details open>
      <summary>Movement model & load</summary>
      <div className="details-content">
        <p className="small-note">
          <strong>{d.family}</strong> · Reference action: {d.action}. Values
          describe {d.forceConvention}.
        </p>
        {model !== "machine" && (
          <>
            <label className="select-field">
              Facing direction
              <select
                aria-label={`${letter} facing direction`}
                value={setup.facing}
                onChange={(e) => change("facing", Number(e.target.value))}
              >
                <option value={-1}>Toward the outlet plane</option>
                <option value={1}>Away from the outlet plane</option>
              </select>
            </label>
            <label className="select-field">
              Resistance
              <select
                aria-label={`${letter} resistance type`}
                value={setup.resistance ?? "cable"}
                onChange={(e) => change("resistance", e.target.value)}
              >
                <option value="cable">Cable force</option>
                {["raise", "curl", "extension", "fly"].includes(model) && (
                  <option value="dumbbell">Gravity / free weight</option>
                )}
                <option value="unknown">Unknown resistance</option>
              </select>
            </label>
            {known && cable && (
              <>
                <label className="select-field">
                  Load entry
                  <select
                    aria-label={`${letter} load entry`}
                    value={setup.loadMode ?? "force"}
                    onChange={(e) => change("loadMode", e.target.value)}
                  >
                    <option value="force">Actual force (N)</option>
                    <option value="mass">Selected mass + factor</option>
                  </select>
                </label>
                {setup.loadMode === "mass" && (
                  <>
                    <Field
                      label={`${letter} · Selected mass`}
                      value={setup.loadMass ?? 10}
                      min={0}
                      max={200}
                      unit="kg"
                      step={0.5}
                      onChange={(v) => change("loadMass", v)}
                    />
                    <Field
                      label={`${letter} · Force transmission factor`}
                      value={setup.transmissionFactor ?? 1}
                      min={0.05}
                      max={2}
                      unit="×"
                      step={0.05}
                      onChange={(v) => change("transmissionFactor", v)}
                      note="Force = mass × 9.81 × factor. Use 1 when a manufacturer's value is already corrected."
                    />
                  </>
                )}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={setup.slack ?? false}
                    onChange={(e) => change("slack", e.target.checked)}
                  />
                  Cable explicitly slack
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={setup.forceKnown !== false}
                    onChange={(e) => change("forceKnown", e.target.checked)}
                  />
                  Actual cable force is known
                </label>
              </>
            )}
            {!known && setup.resistance !== "unknown" && (
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => change("forceKnown", true)}
                />
                Actual cable force is known
              </label>
            )}
            {!cable && known && (
              <Field
                label={`${letter} · Free-weight mass`}
                value={setup.loadMass ?? 5}
                min={0}
                max={80}
                step={0.25}
                unit="kg"
                onChange={(v) => change("loadMass", v)}
                note="Mass per loaded hand. Bilateral models include both loads."
              />
            )}
          </>
        )}
        {["curl", "extension"].includes(model) && (
          <Field
            label={`${letter} · Upper-arm elevation`}
            value={setup.upperArmAngle ?? 0}
            min={-60}
            max={200}
            unit="°"
            onChange={(v) => change("upperArmAngle", v)}
            note="Upper-arm posture is fixed while the elbow moves."
          />
        )}
        {["raise", "fly"].includes(model) && (
          <Field
            label={`${letter} · Outlet fore–aft offset`}
            value={(setup.planeOffset ?? 0) * 100}
            min={-200}
            max={200}
            unit="cm"
            onChange={(v) => change("planeOffset", v / 100)}
            note="Signed position of the outlet in front of or behind the body's movement plane."
          />
        )}
        {model === "pullover" && (
          <>
            <Field
              label={`${letter} · Bar length`}
              value={
                (setup.barLength ??
                  Math.max(0.6, setup.attachmentSpacing + 0.08)) * 100
              }
              min={10}
              max={300}
              unit="cm"
              onChange={(v) => change("barLength", v / 100)}
            />
            <Field
              label={`${letter} · Grip separation`}
              value={(setup.gripWidth ?? profile.shoulderWidth) * 100}
              min={10}
              max={100}
              unit="cm"
              onChange={(v) => change("gripWidth", v / 100)}
              note="The arm solver preserves segment lengths and the fixed elbow angle. Incompatible widths are flagged."
            />
            <button onClick={() => change("gripWidth", undefined)}>
              Derive grip width from shoulders
            </button>
            <label className="select-field">
              Posture
              <select
                aria-label={`${letter} posture`}
                value={
                  setup.posture ??
                  (setup.kind === "bench" ? "seated" : "standing")
                }
                onChange={(e) => change("posture", e.target.value)}
              >
                <option value="standing">Standing</option>
                <option value="kneeling">Kneeling</option>
                <option value="seated">Seated / bench supported</option>
              </select>
            </label>
            <p className="small-note">
              Standing and kneeling leg lengths must reach the floor from the
              pelvis anchor. Incompatible support geometry is flagged.
            </p>
          </>
        )}
        {model !== "machine" && (
          <>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={setup.segmentGravity ?? false}
                onChange={(e) => change("segmentGravity", e.target.checked)}
              />
              Include explicitly estimated segment weight
            </label>
            {setup.segmentGravity && (
              <>
                <Field
                  label={`${letter} · ${model === "hip" ? "Thigh mass" : "Upper segment mass"}`}
                  value={
                    model === "hip"
                      ? (setup.thighMass ?? 0)
                      : (setup.upperArmMass ?? 0)
                  }
                  min={0}
                  max={15}
                  step={0.1}
                  unit="kg"
                  onChange={(v) =>
                    change(model === "hip" ? "thighMass" : "upperArmMass", v)
                  }
                  note={
                    model === "hip"
                      ? "Thigh mass; center of mass assumed at segment midpoint."
                      : "Upper-arm mass; center of mass assumed at segment midpoint."
                  }
                />
                <Field
                  label={`${letter} · ${model === "hip" ? "Lower-leg mass" : "Distal segment mass"}`}
                  value={
                    model === "hip"
                      ? (setup.shankMass ?? 0)
                      : (setup.forearmMass ?? 0)
                  }
                  min={0}
                  max={15}
                  step={0.1}
                  unit="kg"
                  onChange={(v) =>
                    change(model === "hip" ? "shankMass" : "forearmMass", v)
                  }
                  note={
                    model === "hip"
                      ? "Lower-leg mass; center of mass assumed at segment midpoint."
                      : "Forearm/hand mass; center of mass assumed at segment midpoint."
                  }
                />
              </>
            )}
          </>
        )}
        <p className="small-note">
          Quasi-static model: animation speed does not change the calculated
          forces. Exact muscle force, effort and growth are not calculated.
        </p>
      </div>
    </details>
  );
}
