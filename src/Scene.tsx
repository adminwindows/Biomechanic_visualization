import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  evaluate,
  geometry,
  type Profile,
  type Setup,
  type Vec3,
} from "./engine";

type SceneProps = {
  setup: Setup;
  profile: Profile;
  angle: number;
  setups: [Setup, Setup];
  profiles: [Profile, Profile];
  view: "side" | "top";
  label: "A" | "B";
  annotations: boolean;
};

const ink = "#334746";
const muted = "#7d8d89";
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];

function extent(setups: [Setup, Setup], profiles: [Profile, Profile]) {
  const points: Vec3[] = [
    [0, 0, 0],
    [0, 0, 2.8],
  ];
  setups.forEach((setup, i) => {
    for (let angle = 0; angle <= 200; angle += 5) {
      const g = geometry(setup, profiles[i], angle);
      points.push(
        g.hip,
        g.shoulder,
        g.elbow,
        g.hand,
        g.head,
        g.backBase,
        g.backTop,
      );
      g.cables.forEach((c) => points.push(c.attachment, c.outlet));
    }
  });
  return {
    minX: Math.min(...points.map((p) => p[0])) - 0.28,
    maxX: Math.max(...points.map((p) => p[0])) + 0.28,
    minZ: Math.min(0, ...points.map((p) => p[2])) - 0.1,
    maxZ: Math.max(...points.map((p) => p[2])) + 0.2,
    spanY:
      Math.max(
        1.1,
        ...setups.map((s) => s.outletSpacing),
        ...setups.map((s) => s.attachmentSpacing),
        ...setups.map((s) => s.backWidth),
      ) + 0.35,
  };
}

export function Scene({
  setup,
  profile,
  angle,
  setups,
  profiles,
  view,
  label,
  annotations,
}: SceneProps) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderedWidth, setRenderedWidth] = useState(520);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const resize = () =>
      setRenderedWidth(Math.max(280, svg.getBoundingClientRect().width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  // Keep annotations readable while preserving the same physical framing in both panels.
  const fontScale = Math.max(1, 520 / renderedWidth);
  const color = label === "A" ? "#007c78" : "#d97a35";
  const result = evaluate(setup, profile, angle);
  const g = result.geometry;
  const bounds = useMemo(() => extent(setups, profiles), [setups, profiles]);
  const top = view === "top";
  const width = 520;
  const height = top ? 224 : 350;
  const chartScale = Math.min(
    460 / (bounds.maxX - bounds.minX),
    278 / (bounds.maxZ - bounds.minZ),
    158 / bounds.spanY,
  );
  const xOffset = (width - (bounds.maxX - bounds.minX) * chartScale) / 2;
  const zOffset = 30 + (280 - (bounds.maxZ - bounds.minZ) * chartScale) / 2;
  const p = (v: Vec3): [number, number] => [
    xOffset + (v[0] - bounds.minX) * chartScale,
    top
      ? height / 2 + v[1] * chartScale
      : zOffset + (bounds.maxZ - v[2]) * chartScale,
  ];
  const path = (points: Vec3[]) =>
    points.map((point, i) => `${i ? "L" : "M"}${p(point).join(",")}`).join(" ");
  const line = (
    a: Vec3,
    b: Vec3,
    stroke = ink,
    strokeWidth = 2,
    extra: Record<string, string | number> = {},
  ) => {
    const [x1, y1] = p(a),
      [x2, y2] = p(b);
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        {...extra}
      />
    );
  };
  const circle = (
    at: Vec3,
    r: number,
    fill: string,
    stroke = "none",
    strokeWidth = 1,
  ) => (
    <circle
      cx={p(at)[0]}
      cy={p(at)[1]}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
  const backCorners = [
    add(g.backBase, scale(g.normal, -setup.backThickness / 2)),
    add(g.backTop, scale(g.normal, -setup.backThickness / 2)),
    add(g.backTop, scale(g.normal, setup.backThickness / 2)),
    add(g.backBase, scale(g.normal, setup.backThickness / 2)),
  ];
  const backMinX = Math.min(...backCorners.map((v) => v[0]));
  const backMaxX = Math.max(...backCorners.map((v) => v[0]));
  const topBack: Vec3[] = [
    [backMinX, -setup.backWidth / 2, 0],
    [backMaxX, -setup.backWidth / 2, 0],
    [backMaxX, setup.backWidth / 2, 0],
    [backMinX, setup.backWidth / 2, 0],
  ];
  const floorY = p([0, 0, 0])[1];
  const invalid = result.status === "contact" || result.status === "invalid";
  const handTrail = useMemo(
    () =>
      Array.from(
        { length: 41 },
        (_, i) => geometry(setup, profile, i * 5).hand,
      ),
    [setup, profile],
  );
  const theta = (angle * Math.PI) / 180;
  const arcSamples = Math.max(2, Math.ceil(Math.abs(theta) / 0.15));
  const angleLabel = `${Math.round(angle)}°${angle > 180 ? " · exploratory" : ""}`;
  const title = `${label}: ${top ? "top" : "side"} view. ${setup.name}. Upper-arm elevation ${Math.round(angle)} degrees. ${result.status}.`;

  return (
    <svg
      ref={svgRef}
      className={`scene-svg scene-${view}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <title>{title}</title>
      <defs>
        <pattern
          id={`${id}-grid`}
          width={0.5 * chartScale}
          height={0.5 * chartScale}
          patternUnits="userSpaceOnUse"
          x={p([0, 0, 0])[0]}
          y={top ? height / 2 : floorY}
        >
          <path
            d={`M ${0.5 * chartScale} 0 L 0 0 0 ${0.5 * chartScale}`}
            fill="none"
            stroke="#dae2dc"
            strokeWidth=".65"
          />
        </pattern>
        <marker
          id={`${id}-arrow`}
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L6 3 L0 6 Z" fill={color} />
        </marker>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="#f3f6f0" />
      <rect
        x="15"
        y="28"
        width={width - 30}
        height={height - 61}
        fill={`url(#${id}-grid)`}
      />
      <text
        x="20"
        y="19"
        fill={muted}
        fontSize={9 * fontScale}
        fontFamily="inherit"
        letterSpacing="1.1"
      >
        {top ? "TOP VIEW · X–Y" : "SIDE VIEW · X–Z"}
      </text>
      {!top && (
        <text
          x={width - 20}
          y="19"
          textAnchor="end"
          fill={ink}
          fontSize={11 * fontScale}
          fontFamily="inherit"
        >
          {angleLabel}
        </text>
      )}
      {top ? (
        line(
          [0, -bounds.spanY / 2, 0],
          [0, bounds.spanY / 2, 0],
          "#a8b8af",
          1,
          { strokeDasharray: "4 5" },
        )
      ) : (
        <>
          <line
            x1="20"
            y1={floorY}
            x2={width - 20}
            y2={floorY}
            stroke="#aab9ae"
            strokeWidth="1.1"
          />
          {line(
            [0, 0, 0],
            [0, 0, Math.max(setup.pulleyHeight + 0.14, 2.65)],
            "#9aaea3",
            3,
          )}
          {line(
            [-0.045, 0, 0],
            [-0.045, 0, Math.max(setup.pulleyHeight + 0.14, 2.65)],
            "#d1dcd2",
            1,
          )}
        </>
      )}
      {setup.kind === "bench" && (
        <g>
          <polygon
            points={(top ? topBack : backCorners)
              .map((v) => p(v).join(","))
              .join(" ")}
            fill="#d2ddd3"
            stroke="#81988c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {!top && (
            <>
              {line(
                add(g.hip, [-0.09, 0, -0.075]),
                add(g.hip, [0.4 * setup.facing, 0, -0.075]),
                "#91a497",
                7,
              )}
              {line(
                add(g.hip, [0.15 * setup.facing, 0, -0.09]),
                [g.hip[0] + 0.15 * setup.facing, 0, 0.035],
                "#9aac9f",
                4,
              )}
              {line(
                [g.hip[0] - 0.2, 0, 0.035],
                [g.hip[0] + 0.5, 0, 0.035],
                "#9aac9f",
                4,
              )}
            </>
          )}
        </g>
      )}
      {!top && (
        <path
          d={path(handTrail)}
          stroke={color}
          strokeWidth="1.05"
          strokeDasharray="3 5"
          fill="none"
          opacity=".25"
        />
      )}
      <g opacity={invalid ? 0.42 : 1}>
        {g.cables.map((c, i) => (
          <g key={i}>
            {line(c.attachment, c.outlet, color, 1.65)}
            {circle(c.outlet, 5, "#f3f6f0", color, 2)}
            {circle(c.outlet, 1.5, color)}
            {c.force &&
              setup.tension > 0 &&
              (() => {
                const start = p(c.attachment),
                  end = p(c.outlet);
                const distance = Math.hypot(
                  end[0] - start[0],
                  end[1] - start[1],
                );
                if (distance < 7) return null;
                const arrowLength = Math.min(distance * 0.45, 32);
                return (
                  <line
                    x1={start[0]}
                    y1={start[1]}
                    x2={
                      start[0] + ((end[0] - start[0]) / distance) * arrowLength
                    }
                    y2={
                      start[1] + ((end[1] - start[1]) / distance) * arrowLength
                    }
                    stroke={color}
                    strokeWidth="2.2"
                    markerEnd={`url(#${id}-arrow)`}
                  />
                );
              })()}
          </g>
        ))}
        {top ? (
          <>
            {line(g.hip, g.shoulder, "#bfcbc1", 19)}
            {line(g.shoulders[0], g.shoulders[1], ink, 10)}
            {g.shoulders.map((shoulder, i) => (
              <g key={i}>
                <path
                  d={path([shoulder, g.elbows[i], g.grips[i]])}
                  fill="none"
                  stroke={ink}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {circle(shoulder, 3.5, "#f3f6f0", ink, 1.3)}
                {circle(g.elbows[i], 2.7, "#f3f6f0", ink, 1.2)}
                {circle(g.grips[i], 3.3, color, "#f3f6f0", 1.2)}
              </g>
            ))}
            {line(g.barEnds[0], g.barEnds[1], ink, 3.5)}
            {circle(g.head, 0.08 * chartScale, "#bdcbc0", ink, 1)}
          </>
        ) : (
          <>
            {line(g.hip, g.shoulder, ink, 17)}
            {line(g.hip, g.shoulder, "#64786c", 10)}
            {line(
              g.shoulder,
              add(g.shoulder, scale(g.torsoDirection, 0.1)),
              ink,
              7,
            )}
            {circle(g.head, 0.1 * chartScale, "#d8dfce", ink, 1.5)}
            {line(
              add(g.head, scale(g.normal, 0.07)),
              add(g.head, scale(g.normal, 0.12)),
              ink,
              2,
            )}
            {circle(g.hip, 7, ink)}
            <path
              d={path([g.shoulder, g.elbow, g.hand])}
              stroke={ink}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {circle(g.shoulder, 4.2, "#e7ecdf", ink, 1.5)}
            {circle(g.elbow, 3.2, "#e7ecdf", ink, 1.4)}
            {circle(g.hand, 4.5, color, "#f3f6f0", 1.4)}
            {line(
              add(g.hand, [0, 0, -0.035]),
              add(g.hand, [0, 0, 0.035]),
              ink,
              3.5,
            )}
            {annotations && (
              <>
                {line(
                  g.shoulder,
                  add(g.shoulder, scale(g.torsoDirection, 0.33)),
                  "#94a79d",
                  0.8,
                  { strokeDasharray: "3 3" },
                )}
                <path
                  d={path(
                    Array.from({ length: arcSamples }, (_, i) => {
                      const q = (angle * i) / (arcSamples - 1);
                      const ga = geometry(setup, profile, q);
                      const delta: Vec3 = [
                        ga.elbow[0] - ga.shoulder[0],
                        ga.elbow[1] - ga.shoulder[1],
                        ga.elbow[2] - ga.shoulder[2],
                      ];
                      const length = Math.hypot(...delta);
                      return add(g.shoulder, scale(delta, 0.18 / length));
                    }),
                  )}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  opacity=".55"
                />
              </>
            )}
          </>
        )}
      </g>
      {result.contact && (
        <g>
          {circle(result.contact, 8, "#fff1e4", "#b84c22", 1.7)}
          <text
            x={p(result.contact)[0]}
            y={p(result.contact)[1] + 3.6}
            textAnchor="middle"
            fontSize={12 * fontScale}
            fontWeight="700"
            fill="#b84c22"
          >
            !
          </text>
        </g>
      )}
      {annotations && (
        <>
          <text
            x={Math.max(
              32,
              Math.min(width - 100, p([0, 0, setup.pulleyHeight])[0] + 11),
            )}
            y={top ? 39 : Math.max(39, p([0, 0, setup.pulleyHeight])[1] - 9)}
            fill={muted}
            fontSize={9 * fontScale}
            fontFamily="inherit"
          >
            Outlet plane
          </text>
          {!top && (
            <text
              x={Math.max(24, Math.min(width - 62, p(g.hand)[0] + 12))}
              y={Math.max(40, p(g.hand)[1] - 11)}
              fill={color}
              fontSize={10 * fontScale}
              fontWeight="600"
              fontFamily="inherit"
            >
              Grip
            </text>
          )}
          {top && (
            <text
              x="20"
              y={height - 13}
              fill={muted}
              fontSize={9 * fontScale}
              fontFamily="inherit"
            >
              Cable clearance is checked in 3D
            </text>
          )}
        </>
      )}
      {!top && (
        <text
          x="20"
          y={height - 15}
          fill={muted}
          fontSize={9 * fontScale}
          fontFamily="inherit"
        >
          {setup.facing === -1
            ? "← Facing the outlets"
            : "Facing into the room →"}
        </text>
      )}
      <g stroke={muted} strokeWidth="1">
        <line
          x1={width - 23 - 0.5 * chartScale}
          x2={width - 23}
          y1={height - 18}
          y2={height - 18}
        />
        <line
          x1={width - 23 - 0.5 * chartScale}
          x2={width - 23 - 0.5 * chartScale}
          y1={height - 21}
          y2={height - 15}
        />
        <line
          x1={width - 23}
          x2={width - 23}
          y1={height - 21}
          y2={height - 15}
        />
      </g>
      <text
        x={width - 23 - 0.25 * chartScale}
        y={height - 25}
        textAnchor="middle"
        fontSize={8 * fontScale}
        fontFamily="inherit"
        fill={muted}
      >
        50 cm
      </text>
    </svg>
  );
}
