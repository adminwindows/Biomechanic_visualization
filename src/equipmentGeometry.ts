import type { Setup, Vec3 } from './engine';

/** Mean height for independently positioned outlets; nominal rail height otherwise. */
export function outletHeight(setup: Setup): number {
  return setup.outletPositions?.length
    ? setup.outletPositions.reduce((sum, point) => sum + point[2], 0) / setup.outletPositions.length
    : setup.pulleyHeight;
}

/** Translate the actual outlets together, retaining their height differences. */
export function withOutletHeight(setup: Setup, height: number): Setup {
  const delta = height - outletHeight(setup);
  return {
    ...setup,
    pulleyHeight: setup.outletPositions ? Math.max(.01, Math.min(5, height)) : height,
    ...(setup.outletPositions ? { outletPositions: setup.outletPositions.map(point => [point[0], point[1], point[2] + delta] as Vec3) } : {}),
  };
}
