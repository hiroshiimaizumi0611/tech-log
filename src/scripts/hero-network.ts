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

const initializedNetworks = new WeakMap<Element, () => void>();
const SHAPES: readonly ShapeMode[] = ['radial', 'wave', 'clusters'];

interface CanvasSize {
  width: number;
  height: number;
  pixelRatio: number;
  particleCount: number;
}

function initializeNetwork(element: HTMLElement): void {
  if (initializedNetworks.has(element)) return;
  if (typeof window === 'undefined' || typeof HTMLCanvasElement === 'undefined') return;

  const canvas = element.querySelector('canvas');
  const pointerRing = element.querySelector<HTMLElement>('[data-pointer-ring]');
  if (!(canvas instanceof HTMLCanvasElement) || !pointerRing) return;

  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    return;
  }

  if (
    !context ||
    typeof ResizeObserver === 'undefined' ||
    typeof IntersectionObserver === 'undefined' ||
    typeof window.matchMedia !== 'function' ||
    typeof window.requestAnimationFrame !== 'function' ||
    typeof window.cancelAnimationFrame !== 'function'
  ) {
    return;
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (
    typeof reducedMotionQuery.addEventListener !== 'function' ||
    typeof reducedMotionQuery.removeEventListener !== 'function' ||
    typeof finePointerQuery.addEventListener !== 'function' ||
    typeof finePointerQuery.removeEventListener !== 'function'
  ) {
    return;
  }
  let size: CanvasSize = { width: 0, height: 0, pixelRatio: 1, particleCount: 36 };
  let intersecting = true;
  let currentMode: AnimationMode | 'fallback' = 'fallback';
  let activeElapsedMs = 0;
  let lastFrameTime: number | null = null;
  let frameRequest: number | null = null;
  let pointer: Point | null = null;
  let canvasBounds: DOMRect | null = null;
  let cleanedUp = false;

  const clearPointer = (): void => {
    pointer = null;
    canvasBounds = null;
    pointerRing.classList.remove('is-visible');
  };

  const updateCanvasSize = (width: number, height: number): boolean => {
    const cssWidth = Math.max(1, Math.round(width));
    const cssHeight = Math.max(1, Math.round(height));
    const viewportWidth = window.innerWidth;
    const cappedPixelRatio = pixelRatioForWidth(viewportWidth, window.devicePixelRatio);
    const pixelRatio =
      Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
        ? Math.min(window.devicePixelRatio, cappedPixelRatio)
        : cappedPixelRatio;
    const particleCount = particleCountForWidth(viewportWidth);

    if (size.width === cssWidth && size.height === cssHeight && size.pixelRatio === pixelRatio && size.particleCount === particleCount) {
      return false;
    }

    size = { width: cssWidth, height: cssHeight, pixelRatio, particleCount };
    element.dataset.particleCount = String(particleCount);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    return true;
  };

  const draw = (forcedShape?: ShapeMode): void => {
    if (size.width <= 0 || size.height <= 0) return;

    const count = size.particleCount;
    const cycle = activeElapsedMs / SHAPE_DURATION_MS;
    const shapeIndex = Math.floor(cycle) % SHAPES.length;
    const fromShape = forcedShape ?? SHAPES[shapeIndex];
    const toShape = forcedShape ?? SHAPES[(shapeIndex + 1) % SHAPES.length];
    const rawProgress = forcedShape ? 0 : cycle - Math.floor(cycle);
    const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
    const phase = forcedShape ? 0 : (activeElapsedMs / 1_000) * 0.18;
    const points: Point[] = [];

    context.setTransform(size.pixelRatio, 0, 0, size.pixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    for (let index = 0; index < count; index += 1) {
      const from = positionForShape(fromShape, index, count, phase);
      const to = positionForShape(toShape, index, count, phase);
      const normalized = interpolatePosition(from, to, progress);
      const point = { x: normalized.x * size.width, y: normalized.y * size.height };

      if (pointer && finePointerQuery.matches && currentMode !== 'static') {
        const force = cursorRepulsion(point, pointer);
        point.x += force.x * 22;
        point.y += force.y * 22;
      }

      points.push(point);
    }

    const connectionRange = Math.min(125, Math.max(72, size.width * 0.12));
    const connectionCounts = points.map(() => 0);
    const candidates: { fromIndex: number; toIndex: number; distance: number }[] = [];

    for (let fromIndex = 0; fromIndex < points.length; fromIndex += 1) {
      for (let toIndex = fromIndex + 1; toIndex < points.length; toIndex += 1) {
        const distance = Math.hypot(points[fromIndex].x - points[toIndex].x, points[fromIndex].y - points[toIndex].y);
        if (distance <= connectionRange) candidates.push({ fromIndex, toIndex, distance });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    context.lineWidth = 0.7;
    for (const { fromIndex, toIndex, distance } of candidates) {
      if (connectionCounts[fromIndex] >= 3 || connectionCounts[toIndex] >= 3) continue;

      connectionCounts[fromIndex] += 1;
      connectionCounts[toIndex] += 1;
      context.strokeStyle = `rgba(92, 210, 180, ${0.18 * (1 - distance / connectionRange)})`;
      context.beginPath();
      context.moveTo(points[fromIndex].x, points[fromIndex].y);
      context.lineTo(points[toIndex].x, points[toIndex].y);
      context.stroke();
    }

    context.fillStyle = 'rgba(112, 232, 202, 0.72)';
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, 1.45, 0, TAU);
      context.fill();
    }

    const frameShape = forcedShape ?? fromShape;
    if (element.dataset.networkRendered !== 'true') element.dataset.networkRendered = 'true';
    if (element.dataset.networkFrame !== frameShape) element.dataset.networkFrame = frameShape;
  };

  const scheduleFrame = (): void => {
    if (frameRequest === null && currentMode === 'running') frameRequest = window.requestAnimationFrame(runFrame);
  };

  const runFrame = (time: number): void => {
    frameRequest = null;
    if (currentMode !== 'running') return;

    if (lastFrameTime === null) {
      lastFrameTime = time;
    } else {
      activeElapsedMs = advanceActiveElapsed(activeElapsedMs, time - lastFrameTime, currentMode);
      lastFrameTime = time;
    }

    draw();
    scheduleFrame();
  };

  const transition = (): void => {
    const nextMode = animationMode({
      intersecting,
      documentVisible: document.visibilityState === 'visible',
      reducedMotion: reducedMotionQuery.matches,
    });
    if (nextMode === currentMode) return;

    currentMode = nextMode;
    element.dataset.networkState = nextMode;

    if (frameRequest !== null) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = null;
    }
    lastFrameTime = null;

    if (nextMode === 'static') {
      clearPointer();
      draw('radial');
    } else if (nextMode === 'running') {
      scheduleFrame();
    } else {
      clearPointer();
    }
  };

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const resized = updateCanvasSize(entry.contentRect.width, entry.contentRect.height);
    canvasBounds = canvas.getBoundingClientRect();
    if (resized && currentMode === 'static') draw('radial');
  });

  const intersectionObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    intersecting = entry.isIntersecting;
    transition();
  });

  const onPointerMove = (event: PointerEvent): void => {
    if (!finePointerQuery.matches || currentMode !== 'running') return;
    const bounds = canvasBounds ?? canvas.getBoundingClientRect();
    canvasBounds = bounds;
    pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    pointerRing.style.setProperty('--pointer-x', `${pointer.x}px`);
    pointerRing.style.setProperty('--pointer-y', `${pointer.y}px`);
    pointerRing.classList.add('is-visible');
  };
  const onPointerEnter = (): void => {
    if (finePointerQuery.matches && currentMode === 'running') canvasBounds = canvas.getBoundingClientRect();
  };

  const onFinePointerChange = (): void => {
    if (!finePointerQuery.matches) clearPointer();
  };
  const onVisibilityChange = (): void => transition();
  const onReducedMotionChange = (): void => transition();
  const onWindowResize = (): void => {
    const bounds = element.getBoundingClientRect();
    const resized = updateCanvasSize(bounds.width, bounds.height);
    canvasBounds = canvas.getBoundingClientRect();
    if (resized && currentMode === 'static') draw('radial');
  };

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (frameRequest !== null) window.cancelAnimationFrame(frameRequest);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    finePointerQuery.removeEventListener('change', onFinePointerChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('astro:before-swap', cleanup);
    window.removeEventListener('resize', onWindowResize);
    element.removeEventListener('pointerenter', onPointerEnter);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerleave', clearPointer);
    initializedNetworks.delete(element);
  };

  initializedNetworks.set(element, cleanup);
  resizeObserver.observe(element);
  intersectionObserver.observe(element);
  reducedMotionQuery.addEventListener('change', onReducedMotionChange);
  finePointerQuery.addEventListener('change', onFinePointerChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('astro:before-swap', cleanup);
  window.addEventListener('resize', onWindowResize, { passive: true });
  element.addEventListener('pointerenter', onPointerEnter, { passive: true });
  element.addEventListener('pointermove', onPointerMove, { passive: true });
  element.addEventListener('pointerleave', clearPointer);

  const initialBounds = element.getBoundingClientRect();
  updateCanvasSize(initialBounds.width, initialBounds.height);
  transition();
}

export function initHeroNetworks(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-hero-network]')) initializeNetwork(element);
}
