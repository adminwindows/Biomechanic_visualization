import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { evaluate, sampleCurve, type Profile, type Setup } from "./engine";

type CurveProps = {
  setups: [Setup, Setup];
  profiles: [Profile, Profile];
  angles: [number, number];
  onAngle?: (angle: number) => void;
};

export function Curve({ setups, profiles, angles, onAngle }: CurveProps) {
  const curves = useMemo(
    () => setups.map((setup, index) => sampleCurve(setup, profiles[index])),
    [setups, profiles],
  );
  const colors = ["#007c78", "#d97a35"];
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(520);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const resize = () =>
      setWidth(Math.max(280, Math.round(svg.getBoundingClientRect().width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const height = 250;
  const compact = width < 440;
  const left = 43,
    right = 17,
    top = 35,
    bottom = 48;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const maximum = Math.max(
    10,
    ...curves.flatMap((curve) => curve.map((p) => Math.abs(p.moment ?? 0))),
  );
  const step = 10 ** Math.floor(Math.log10(maximum));
  const extent = Math.ceil(maximum / step) * step;
  const x = (angle: number) => left + (angle / 200) * plotWidth;
  const y = (moment: number) =>
    top + ((extent - moment) / (2 * extent)) * plotHeight;
  const path = (curve: (typeof curves)[number]) => {
    let started = false;
    return curve
      .map((point) => {
        if (point.moment === null || !Number.isFinite(point.moment)) {
          started = false;
          return "";
        }
        const command = started ? "L" : "M";
        started = true;
        return `${command}${x(point.angle).toFixed(2)},${y(point.moment).toFixed(2)}`;
      })
      .join(" ");
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!onAngle) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    onAngle(
      Math.round(
        Math.max(0, Math.min(200, ((point.x - left) / plotWidth) * 200)),
      ),
    );
  };
  const validCurves = curves.some((curve) =>
    curve.some((p) => p.moment !== null),
  );

  return (
    <svg
      ref={svgRef}
      className="curve-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Cable contribution versus upper-arm elevation. Positive values resist bringing the arms toward the torso; negative values assist. Gaps indicate invalid positions."
      tabIndex={onAngle ? 0 : undefined}
      onPointerDown={move}
      onKeyDown={(event) => {
        if (onAngle && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          onAngle(
            Math.max(
              0,
              Math.min(200, angles[0] + (event.key === "ArrowRight" ? 1 : -1)),
            ),
          );
        }
      }}
      style={{
        display: "block",
        width: "100%",
        height: `${height}px`,
        cursor: onAngle ? "crosshair" : "default",
      }}
    >
      <title>External cable contribution, total symmetric movement</title>
      <desc>
        Both configurations share the same axes and scale. Gaps mark contact or
        non-computable geometry. Click the chart or use arrow keys while focused
        to change the position.
      </desc>
      <rect
        x={left}
        y={top}
        width={plotWidth}
        height={plotHeight / 2}
        fill="#f4f8f2"
      />
      <rect
        x={left}
        y={top + plotHeight / 2}
        width={plotWidth}
        height={plotHeight / 2}
        fill="#fcf7ee"
      />
      {[-extent, -extent / 2, 0, extent / 2, extent].map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={width - right}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? "#96a69f" : "#dce5de"}
            strokeWidth={tick === 0 ? 1.2 : 0.75}
            strokeDasharray={tick === 0 ? undefined : "3 5"}
          />
          <text
            x={left - 12}
            y={y(tick) + 3.5}
            fill="#7b8a81"
            textAnchor="end"
            fontFamily="inherit"
            fontSize="11"
          >
            {tick > 0 ? "+" : ""}
            {tick.toFixed(tick % 1 ? 1 : 0)}
          </text>
        </g>
      ))}
      {(compact
        ? [0, 50, 100, 150, 200]
        : [0, 30, 60, 90, 120, 150, 180, 200]
      ).map((tick) => (
        <g key={tick}>
          <line
            x1={x(tick)}
            x2={x(tick)}
            y1={top}
            y2={height - bottom}
            stroke="#dfe6df"
            strokeWidth=".6"
          />
          <text
            x={x(tick)}
            y={height - bottom + 18}
            fill="#7b8a81"
            textAnchor="middle"
            fontFamily="inherit"
            fontSize="11"
          >
            {tick}°
          </text>
        </g>
      ))}
      <text x={left} y="19" fill="#60766c" fontSize="11" fontFamily="inherit">
        {compact
          ? "Total cable contribution · N·m"
          : "Cable contribution · N·m"}
      </text>
      {!compact && (
        <text
          x={width - right}
          y="19"
          textAnchor="end"
          fill="#60766c"
          fontSize="11"
          fontFamily="inherit"
        >
          Total · both sides
        </text>
      )}
      <text
        x={left + 10}
        y={top + 16}
        fill="#9aaa9b"
        fontSize="10"
        fontFamily="inherit"
        letterSpacing=".5"
      >
        + RESISTS
      </text>
      <text
        x={left + 10}
        y={height - bottom - 10}
        fill="#b2a38d"
        fontSize="10"
        fontFamily="inherit"
        letterSpacing=".5"
      >
        − ASSISTS
      </text>
      {curves.map((curve, i) => (
        <path
          key={i}
          d={path(curve)}
          stroke={colors[i]}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={i === 1 ? "7 3" : undefined}
        />
      ))}
      {angles.map((angle, i) => {
        const result = evaluate(setups[i], profiles[i], angle);
        return (
          <g key={i}>
            <line
              x1={x(angle)}
              x2={x(angle)}
              y1={top}
              y2={height - bottom}
              stroke={colors[i]}
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity=".35"
            />
            {result.moment !== null && (
              <>
                <circle
                  cx={x(angle)}
                  cy={y(result.moment)}
                  r="5"
                  fill={colors[i]}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={x(angle) + (i === 0 ? -10 : 10)}
                  y={y(result.moment) - 9}
                  textAnchor={i === 0 ? "end" : "start"}
                  fill={colors[i]}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="inherit"
                >
                  {i === 0 ? "A" : "B"}
                </text>
              </>
            )}
          </g>
        );
      })}
      {!validCurves && (
        <text
          x={width / 2}
          y={height / 2 - 8}
          textAnchor="middle"
          fill="#7b8a81"
          fontSize="12"
          fontFamily="inherit"
        >
          No valid cable result in these ranges
        </text>
      )}
      <text
        x={width / 2}
        y={height - 12}
        textAnchor="middle"
        fill="#7b8a81"
        fontSize="11"
        fontFamily="inherit"
      >
        {compact
          ? "Arm elevation relative to torso"
          : "Upper-arm elevation relative to torso"}
      </text>
    </svg>
  );
}
