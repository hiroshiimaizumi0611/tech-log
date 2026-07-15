import { describe, expect, it } from 'vitest';

import {
  MOBILE_BREAKPOINT_PX,
  POINTER_RANGE_PX,
  SHAPE_DURATION_MS,
  advanceActiveElapsed,
  animationMode,
  cursorRepulsion,
  interpolatePosition,
  particleCountForWidth,
  pixelRatioForWidth,
  positionForShape,
  type ShapeMode,
} from '../../src/scripts/hero-network';

describe('hero network configuration', () => {
  it('uses the mobile breakpoint to select a particle count', () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(1023.84);
    expect(particleCountForWidth(1440)).toBe(72);
    expect(particleCountForWidth(1023)).toBe(36);
    expect(particleCountForWidth(MOBILE_BREAKPOINT_PX)).toBe(36);
    expect(particleCountForWidth(MOBILE_BREAKPOINT_PX + 0.01)).toBe(72);
  });

  it('caps pixel ratio more aggressively on mobile', () => {
    expect(pixelRatioForWidth(1440, 3)).toBe(2);
    expect(pixelRatioForWidth(390, 3)).toBe(1.5);
    expect(pixelRatioForWidth(MOBILE_BREAKPOINT_PX, 3)).toBe(1.5);
    expect(pixelRatioForWidth(MOBILE_BREAKPOINT_PX + 0.01, 3)).toBe(2);
  });

  it('keeps pixel ratio at or above one', () => {
    expect(pixelRatioForWidth(1440, 0)).toBe(1);
    expect(pixelRatioForWidth(390, 0.75)).toBe(1);
    expect(pixelRatioForWidth(390, Number.NaN)).toBe(1);
  });

  it('exposes the shape duration and pointer range', () => {
    expect(SHAPE_DURATION_MS).toBe(5_000);
    expect(POINTER_RANGE_PX).toBe(150);
  });
});

describe('positionForShape', () => {
  const shapes: ShapeMode[] = ['radial', 'wave', 'clusters'];

  it.each(shapes)('returns bounded finite coordinates for %s', (shape) => {
    for (let index = 0; index < 24; index += 1) {
      const point = positionForShape(shape, index, 24, 12_345);

      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0.05);
      expect(point.x).toBeLessThanOrEqual(0.95);
      expect(point.y).toBeGreaterThanOrEqual(0.05);
      expect(point.y).toBeLessThanOrEqual(0.95);
    }
  });

  it.each(shapes)('is deterministic for %s', (shape) => {
    expect(positionForShape(shape, 7, 36, 4_200)).toEqual(positionForShape(shape, 7, 36, 4_200));
  });

  it('spreads radial samples around the center', () => {
    const samples = Array.from({ length: 24 }, (_, index) => positionForShape('radial', index, 24, 0));
    const quadrants = new Set(samples.map((point) => `${point.x >= 0.5 ? 'right' : 'left'}-${point.y >= 0.5 ? 'bottom' : 'top'}`));
    const radii = new Set(samples.map((point) => Math.hypot(point.x - 0.5, point.y - 0.5).toFixed(3)));

    expect(quadrants.size).toBe(4);
    expect(radii.size).toBeGreaterThan(3);
  });

  it('progresses wave samples across x and changes y with time', () => {
    const first = positionForShape('wave', 0, 24, 0);
    const middle = positionForShape('wave', 12, 24, 0);
    const last = positionForShape('wave', 23, 24, 0);

    expect(first.x).toBeLessThan(middle.x);
    expect(middle.x).toBeLessThan(last.x);
    expect(positionForShape('wave', 12, 24, 0.75)).not.toEqual(middle);
    expect(positionForShape('wave', 12, 24, 0.75)).toEqual(positionForShape('wave', 12, 24, 0.75));
  });

  it('distributes cluster samples near all three centers', () => {
    const centers = [
      { x: 0.27, y: 0.3 },
      { x: 0.73, y: 0.32 },
      { x: 0.5, y: 0.72 },
    ];
    const nearestCenterIndexes = Array.from({ length: 72 }, (_, index) => {
      const point = positionForShape('clusters', index, 72, 0);
      const distances = centers.map((center) => Math.hypot(point.x - center.x, point.y - center.y));
      const nearestDistance = Math.min(...distances);

      expect(nearestDistance).toBeLessThanOrEqual(0.18);
      return distances.indexOf(nearestDistance);
    });

    expect(new Set(nearestCenterIndexes)).toEqual(new Set([0, 1, 2]));
  });

  it.each(shapes)('keeps %s finite for non-finite scalar inputs', (shape) => {
    const point = positionForShape(shape, Number.POSITIVE_INFINITY, Number.NaN, Number.NaN);

    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});

describe('interpolatePosition', () => {
  it('interpolates halfway between two points', () => {
    expect(interpolatePosition({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5)).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it('clamps progress to prevent overshoot', () => {
    expect(interpolatePosition({ x: 0, y: 0 }, { x: 1, y: 1 }, -1)).toEqual({
      x: 0,
      y: 0,
    });
    expect(interpolatePosition({ x: 0, y: 0 }, { x: 1, y: 1 }, 2)).toEqual({
      x: 1,
      y: 1,
    });
  });

  it('normalizes non-finite progress without emitting NaN', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 1, y: 1 };

    expect(interpolatePosition(from, to, Number.NaN)).toEqual(from);
    expect(interpolatePosition(from, to, Number.POSITIVE_INFINITY)).toEqual(to);
    expect(interpolatePosition(from, to, Number.NEGATIVE_INFINITY)).toEqual(from);
  });
});

describe('cursorRepulsion', () => {
  it('returns no displacement outside the default or explicit range', () => {
    expect(cursorRepulsion({ x: 151, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(cursorRepulsion({ x: 51, y: 0 }, { x: 0, y: 0 }, 50)).toEqual({ x: 0, y: 0 });
  });

  it('pushes a nearby point away from the cursor', () => {
    const displacement = cursorRepulsion({ x: 50, y: 0 }, { x: 0, y: 0 });

    expect(displacement.x).toBeGreaterThan(0);
    expect(displacement.y).toBe(0);
  });

  it('handles a point coincident with the cursor without NaN', () => {
    const displacement = cursorRepulsion({ x: 10, y: 10 }, { x: 10, y: 10 });

    expect(Number.isFinite(displacement.x)).toBe(true);
    expect(Number.isFinite(displacement.y)).toBe(true);
  });

  it('uses the default range for non-finite range values', () => {
    const defaultForce = cursorRepulsion({ x: 50, y: 0 }, { x: 0, y: 0 });

    expect(cursorRepulsion({ x: 50, y: 0 }, { x: 0, y: 0 }, Number.NaN)).toEqual(defaultForce);
    expect(cursorRepulsion({ x: 50, y: 0 }, { x: 0, y: 0 }, Number.POSITIVE_INFINITY)).toEqual(defaultForce);
  });
});

describe('animation lifecycle', () => {
  it('runs only while intersecting and visible with motion enabled', () => {
    expect(animationMode({ intersecting: true, documentVisible: true, reducedMotion: false })).toBe('running');
    expect(animationMode({ intersecting: false, documentVisible: true, reducedMotion: false })).toBe('paused');
    expect(animationMode({ intersecting: true, documentVisible: false, reducedMotion: false })).toBe('paused');
    expect(animationMode({ intersecting: true, documentVisible: true, reducedMotion: true })).toBe('static');
  });

  it('advances elapsed time only while running', () => {
    expect(advanceActiveElapsed(4_800, 30_000, 'paused')).toBe(4_800);
    expect(advanceActiveElapsed(4_800, 16, 'running')).toBe(4_816);
    expect(advanceActiveElapsed(4_800, 30_000, 'static')).toBe(4_800);
  });

  it('ignores negative deltas', () => {
    expect(advanceActiveElapsed(4_800, -16, 'running')).toBe(4_800);
  });

  it('normalizes non-finite elapsed values and deltas only while running', () => {
    expect(advanceActiveElapsed(4_800, Number.NaN, 'running')).toBe(4_800);
    expect(advanceActiveElapsed(4_800, Number.POSITIVE_INFINITY, 'running')).toBe(4_800);
    expect(advanceActiveElapsed(Number.NaN, 16, 'running')).toBe(16);
    expect(advanceActiveElapsed(Number.POSITIVE_INFINITY, 16, 'paused')).toBe(Number.POSITIVE_INFINITY);
  });
});
