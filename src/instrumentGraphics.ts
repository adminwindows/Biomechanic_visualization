/** Presentation geometry only: these outlines never enter the mechanics model. */
export function taperedSegment(from: readonly number[], to: readonly number[], startWidth: number, endWidth: number): string {
  const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
  if (length < .01) { const r = startWidth / 2; return `M${from[0] - r},${from[1]}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`; }
  const tx = dx / length, ty = dy / length, nx = -ty, ny = tx, a = startWidth / 2, b = endWidth / 2;
  return `M${from[0] + nx * a},${from[1] + ny * a}L${to[0] + nx * b},${to[1] + ny * b}Q${to[0] + tx * b},${to[1] + ty * b} ${to[0] - nx * b},${to[1] - ny * b}L${from[0] - nx * a},${from[1] - ny * a}Q${from[0] - tx * a},${from[1] - ty * a} ${from[0] + nx * a},${from[1] + ny * a}Z`;
}
export const instrumentPalette = { ink: '#172b3a', muted: '#607383', grid: '#dbe3ea', paper: '#f3f5f7', teal: '#087f8c', coral: '#d66a45', gravity: '#74658b', outline: '#425d70', structure: '#97aab9' } as const;
