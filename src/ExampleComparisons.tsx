import { useState } from "react";
import { validateState, type LabState } from "./state";

const examples = [
  { file: "pullover-pulley-height", title: "Pullover: change pulley height", description: "Hold the body, force and movement range constant; compare cable direction and leverage." },
  { file: "cable-vs-dumbbell-raise", title: "Lateral raise: cable versus dumbbell", description: "Match force magnitude per attachment and inspect how its direction changes the moment curve." },
  { file: "equal-height-proportions", title: "Same height, different arm proportions", description: "Keep equipment fixed and see how independent segment lengths affect the comparison." },
];

export function ExampleComparisons({ onLoad, onNotice }: { onLoad: (state: LabState) => void; onNotice: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function load(file: string) {
    setLoading(true);
    try {
      const response = await fetch(`/examples/${file}.json`);
      if (!response.ok) throw new Error("Example could not be loaded. Reconnect or prepare offline access.");
      const state = validateState(await response.json());
      onLoad(state);
      onNotice("Example comparison loaded. Dimensions are illustrative. Undo restores your previous comparison.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load this example.");
    } finally {
      setLoading(false);
    }
  }
  return <details className="workspace-drawer" id="example-comparisons">
    <summary><span>Example comparisons</span><span className="drawer-description">Three ready-to-explore questions</span></summary>
    <div className="drawer-body">
      <p className="small-note">Load a complete comparison, then change one setting. These use fictional dimensions and explicit load assumptions. Your previous comparison remains available through Undo.</p>
      <div className="catalog-list">{examples.map(example => <div className="catalog-item" key={example.file}>
        <button className="catalog-pick" disabled={loading} onClick={() => void load(example.file)}><strong>{example.title}</strong><span>{example.description}</span></button>
        <a href={`/examples/${example.file}.json`} download aria-label={`Download ${example.title}`}>JSON</a>
      </div>)}</div>
    </div>
  </details>;
}
