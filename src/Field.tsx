import { useEffect, useRef, useState } from "react";

export function Field({
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
  const lastCommitted = useRef(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => {
    if (!editing || value !== lastCommitted.current)
      setDraft(String(Number(value.toFixed(3))));
    lastCommitted.current = value;
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
              ) {
                lastCommitted.current = e.target.valueAsNumber;
                onChange(e.target.valueAsNumber);
              }
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
