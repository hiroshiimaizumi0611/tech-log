export type ShapeMode = 'radial' | 'wave' | 'clusters';
export type AnimationMode = 'running' | 'paused' | 'static';

export interface Point {
  x: number;
  y: number;
}

export const MOBILE_BREAKPOINT_PX = 1023.84;
export const SHAPE_DURATION_MS = 5_000;
export const POINTER_RANGE_PX = 150;

const MIN_COORDINATE = 0.05;
const MAX_COORDINATE = 0.95;
const TAU = Math.PI * 2;
const CLUSTER_CENTERS = [
  { x: 0.27, y: 0.3 },
  { x: 0.73, y: 0.32 },
  { x: 0.5, y: 0.72 },
] as const satisfies readonly Point[];

function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizedHash(index: number, salt: number): number {
  let value = (Math.trunc(index) + salt) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function bounded(point: Point): Point {
  return {
    x: clamp(point.x, MIN_COORDINATE, MAX_COORDINATE),
    y: clamp(point.y, MIN_COORDINATE, MAX_COORDINATE),
  };
}

export function particleCountForWidth(width: number): number {
  return width <= MOBILE_BREAKPOINT_PX ? 36 : 72;
}

export function pixelRatioForWidth(width: number, devicePixelRatio: number): number {
  const maximum = width <= MOBILE_BREAKPOINT_PX ? 1.5 : 2;
  return Math.min(Math.max(finiteOr(devicePixelRatio, 1), 1), maximum);
}

export function positionForShape(shape: ShapeMode, index: number, count: number, time: number): Point {
  const safeCount = Math.max(1, Math.trunc(finiteOr(count, 1)));
  const safeIndex = Math.max(0, Math.trunc(finiteOr(index, 0)));
  const phase = finiteOr(time, 0);
  const firstHash = normalizedHash(safeIndex, 17);
  const secondHash = normalizedHash(safeIndex, 53);

  if (shape === 'radial') {
    const angle = (safeIndex / safeCount) * TAU + phase + (firstHash - 0.5) * 0.3;
    const radius = 0.16 + secondHash * 0.29;
    return bounded({
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
    });
  }

  if (shape === 'wave') {
    const progress = safeCount === 1 ? 0.5 : safeIndex / (safeCount - 1);
    const x = 0.08 + progress * 0.84;
    return bounded({
      x,
      y: 0.5 + Math.sin(progress * TAU * 1.5 + phase + firstHash * 0.5) * 0.3,
    });
  }

  const center = CLUSTER_CENTERS[Math.floor(firstHash * CLUSTER_CENTERS.length)];
  const angle = secondHash * TAU + phase * 0.5;
  const radius = 0.04 + normalizedHash(safeIndex, 97) * 0.14;

  return bounded({
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  });
}

export function interpolatePosition(from: Point, to: Point, progress: number): Point {
  const clampedProgress = clamp(progress, 0, 1);
  return {
    x: from.x + (to.x - from.x) * clampedProgress,
    y: from.y + (to.y - from.y) * clampedProgress,
  };
}

/** Returns a normalized force vector with a maximum magnitude of about 1, not pixel displacement. */
export function cursorRepulsion(point: Point, pointer: Point, range = POINTER_RANGE_PX): Point {
  const safeRange = finiteOr(range, POINTER_RANGE_PX);
  if (safeRange <= 0) return { x: 0, y: 0 };

  const xDistance = point.x - pointer.x;
  const yDistance = point.y - pointer.y;
  const distance = Math.hypot(xDistance, yDistance);

  if (!Number.isFinite(distance) || distance >= safeRange) return { x: 0, y: 0 };

  const strength = (safeRange - distance) / safeRange;
  if (distance === 0) return { x: strength, y: 0 };

  return {
    x: (xDistance / distance) * strength,
    y: (yDistance / distance) * strength,
  };
}

export function advanceActiveElapsed(elapsed: number, delta: number, mode: AnimationMode): number {
  if (mode !== 'running') return elapsed;
  const safeElapsed = finiteOr(elapsed, 0);
  return safeElapsed + Math.max(0, finiteOr(delta, 0));
}

export function animationMode(input: { intersecting: boolean; documentVisible: boolean; reducedMotion: boolean }): AnimationMode {
  if (input.reducedMotion) return 'static';
  if (!input.intersecting || !input.documentVisible) return 'paused';
  return 'running';
}
