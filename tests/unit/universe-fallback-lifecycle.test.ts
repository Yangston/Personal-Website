import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPortfolioUniverseRenderer,
  type PortfolioUniverseRenderer,
  type UniverseRuntimeSnapshot,
} from "../../src/lib/portfolio-universe/renderer";
import {
  projectWorldPoint,
  resolveCameraPose,
} from "../../src/lib/portfolio-universe/camera";
import { WORLD_ANCHORS } from "../../src/lib/portfolio-universe/scene-manifest";

const webglAttempts = vi.hoisted(() => ({ value: 0 }));
vi.mock("three", async (original) => ({
  ...(await original<typeof import("three")>()),
  WebGLRenderer: class {
    constructor() {
      webglAttempts.value += 1;
      throw new Error("WebGL is unavailable on this device");
    }
  },
}));

describe("unavailable-WebGL runtime lifecycle", () => {
  let runtime: PortfolioUniverseRenderer;
  let viewport: { width: number; height: number };
  let browser: EventTarget;
  let page: EventTarget & { hidden: boolean };
  let resize: () => void;
  const requestFrame = vi.fn(() => 1);

  beforeEach(() => {
    viewport = { width: 1440, height: 900 };
    browser = Object.assign(new EventTarget(), {
      devicePixelRatio: 1,
      visualViewport: new EventTarget(),
    });
    page = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", page);
    vi.stubGlobal("navigator", { hardwareConcurrency: 4, deviceMemory: 4 });
    vi.stubGlobal("innerWidth", viewport.width);
    vi.stubGlobal("innerHeight", viewport.height);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {
          resize = () => undefined;
        }
      },
    );
    requestFrame.mockClear();
    webglAttempts.value = 0;
    const host = { dataset: {}, setAttribute: vi.fn() };
    const canvas = {
      closest: () => host,
      getBoundingClientRect: () => ({ ...viewport, left: 0, top: 0 }),
      style: { visibility: "" },
    } as unknown as HTMLCanvasElement;
    runtime = createPortfolioUniverseRenderer(canvas);
  });

  afterEach(() => {
    runtime.destroy();
    vi.unstubAllGlobals();
  });

  test("publishes the current scene immediately and reprojects after resize without a frame loop", async () => {
    expect(await runtime.ready).toBe(false);
    runtime.jumpTo("travel");
    const snapshots: UniverseRuntimeSnapshot[] = [];
    runtime.subscribe((snapshot) => snapshots.push(snapshot));
    expect(snapshots.at(-1)?.sceneWeights.travel).toBe(1);
    viewport = { width: 390, height: 844 };
    resize();
    const expectedPose = resolveCameraPose(
      "travel",
      viewport.width,
      viewport.height,
    );
    expect(snapshots.at(-1)?.camera.position).toEqual(
      Object.values(expectedPose.position),
    );
    const projected = runtime.projectPlane(WORLD_ANCHORS.earth, 0, 0);
    const expected = projectWorldPoint(
      expectedPose,
      WORLD_ANCHORS.earth,
      viewport,
    );
    expect(projected?.x).toBeCloseTo(expected!.x, 8);
    expect(projected?.y).toBeCloseTo(expected!.y, 8);
    expect(snapshots).toHaveLength(2);
    expect(requestFrame).not.toHaveBeenCalled();
    expect(webglAttempts.value).toBe(1);
  });

  test("caches paused resize/navigation and publishes their latest state once resumed", () => {
    const listener = vi.fn();
    runtime.subscribe(listener);
    listener.mockClear();
    runtime.suspend();
    viewport = { width: 320, height: 700 };
    resize();
    runtime.jumpTo("projects");
    expect(listener).not.toHaveBeenCalled();
    runtime.resume();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      activeScene: "projects",
      sceneWeights: { projects: 1 },
      lifecycle: { frameScheduled: false },
    });
    expect(listener.mock.calls[0][0].camera.position).toEqual(
      Object.values(resolveCameraPose("projects", 320, 700).position),
    );
    listener.mockClear();
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    runtime.jumpTo("about");
    resize();
    expect(listener).not.toHaveBeenCalled();
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].activeScene).toBe("about");
    expect(requestFrame).not.toHaveBeenCalled();
  });

  test("destroy removes resize and visibility subscriptions", () => {
    const listener = vi.fn();
    runtime.subscribe(listener);
    runtime.destroy();
    listener.mockClear();
    resize();
    browser.dispatchEvent(new Event("resize"));
    page.dispatchEvent(new Event("visibilitychange"));
    runtime.jumpTo("about");
    runtime.resume();
    expect(listener).not.toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(webglAttempts.value).toBe(1);
  });
});
