import { describe, expect, test } from "vitest";
import {
  beginUniverseTransition,
  isUniverseSceneId,
  settleUniverseTransition,
  universeSceneFromHash,
  universeSceneHref,
  withAuthoredEntries,
} from "../../src/lib/portfolio-universe/state";
import {
  createProjectConstellationManifest,
  resolveProjectConstellation,
} from "../../src/lib/portfolio-universe/project-constellations";
import {
  UNIVERSE_CONSTELLATION_OPACITY,
  UNIVERSE_EARTH_PALETTE,
  universeAboutRayIntensity,
  universeAnchorSnapshot,
  universeConstellationPulse,
  universeConstellationTint,
  universeEarthVisualState,
  universeNebulaBurst,
  universeNebulaLayerProfiles,
  universeStarBandCounts,
  universeTrailEnvelope,
  universeTrailSegment,
  universeTwinkleSample,
} from "../../src/lib/portfolio-universe/renderer";

describe("portfolio universe scene state", () => {
  test("accepts only public universe scenes", () => {
    expect(isUniverseSceneId("home")).toBe(true);
    expect(isUniverseSceneId("travel")).toBe(true);
    expect(isUniverseSceneId("unknown")).toBe(false);
  });

  test("restores valid hashes and defaults invalid hashes to home", () => {
    expect(universeSceneFromHash("#about")).toBe("about");
    expect(universeSceneFromHash("projects")).toBe("projects");
    expect(universeSceneFromHash("#elsewhere")).toBe("home");
    expect(universeSceneFromHash("")).toBe("home");
  });

  test("keeps every scene addressable with a durable root hash", () => {
    expect(universeSceneHref("home")).toBe("/#home");
    expect(universeSceneHref("projects")).toBe("/#projects");
  });

  test("omits unauthored almanac categories", () => {
    expect(
      withAuthoredEntries([
        { id: "empty", entries: [] },
        { id: "authored", entries: ["one"] },
      ]),
    ).toEqual([{ id: "authored", entries: ["one"] }]);
  });

  test("reconciles an interrupted flight without accepting stale completion", () => {
    const outbound = beginUniverseTransition("home", "travel", 0);
    const interrupted = beginUniverseTransition(
      outbound.current,
      "home",
      outbound.sequence,
    );

    expect(outbound.phase).toBe("approaching");
    expect(interrupted).toMatchObject({
      current: "home",
      from: "home",
      to: "home",
      phase: "idle",
      sequence: 2,
    });
    expect(settleUniverseTransition(outbound, interrupted.sequence)).toBe(
      outbound,
    );
    expect(settleUniverseTransition(outbound, outbound.sequence)).toMatchObject(
      { current: "travel", phase: "idle" },
    );
  });
});

describe("portfolio universe camera anchors", () => {
  test("project the same persistent Earth differently at each destination", () => {
    const home = universeAnchorSnapshot("home").earth;
    const about = universeAnchorSnapshot("about").earth;
    const projects = universeAnchorSnapshot("projects").earth;
    const travel = universeAnchorSnapshot("travel").earth;

    expect(home).not.toBeNull();
    expect(about).toBeNull();
    // The Projects camera passes the Earth on its way into the distant stars.
    expect(projects).toBeNull();
    expect(travel).not.toBeNull();
    expect(new Set([home!.x, travel!.x]).size).toBe(2);
    // Home deliberately crops a larger Earth; Travel pulls back to reveal
    // the full interactive globe while keeping the same world anchor.
    expect(home!.scale).toBeGreaterThan(travel!.scale);
    expect(travel!.x).toBeCloseTo(1440 * 0.68, 6);
    expect(travel!.y).toBeCloseTo(900 * 0.54, 6);
  });

  test("stages the supporting Home planet among the lower-left clouds", () => {
    const planet = universeAnchorSnapshot("home").alienPlanet;

    expect(planet).not.toBeNull();
    expect(planet!.x).toBeGreaterThan(1440 * 0.15);
    expect(planet!.x).toBeLessThan(1440 * 0.4);
    expect(planet!.y).toBeGreaterThan(900 * 0.6);
    expect(planet!.y).toBeLessThan(900 * 0.85);
  });

  test("crops the Home Earth into the reference's lower-right composition", () => {
    const earth = universeAnchorSnapshot("home").earth;

    expect(earth).not.toBeNull();
    expect(earth!.x).toBeCloseTo(1440 * 0.84, 6);
    expect(earth!.y).toBeCloseTo(900 * 0.96, 6);
  });
});

describe("portfolio universe nebula layers", () => {
  test("preserve layer identity and intended opacity in the low tier", () => {
    expect(
      universeNebulaLayerProfiles("low").map(
        ({ id, homeOpacity, aboutOpacity }) => ({
          id,
          homeOpacity,
          aboutOpacity,
        }),
      ),
    ).toEqual([
      { id: "far", homeOpacity: 0.34, aboutOpacity: 0.58 },
      { id: "core", homeOpacity: 0.42, aboutOpacity: 0.88 },
      { id: "crown", homeOpacity: 0.4, aboutOpacity: 0.38 },
      { id: "veil", homeOpacity: 0.34, aboutOpacity: 0.4 },
    ]);
  });

  test("keeps all seven high-tier layers in explicit depth order", () => {
    expect(universeNebulaLayerProfiles("high").map(({ id }) => id)).toEqual([
      "far",
      "core",
      "drift",
      "near",
      "crown",
      "veil",
      "lower-bank",
    ]);
    expect(
      universeNebulaLayerProfiles("high").map(
        ({ id, homeOpacity, aboutOpacity }) => [id, homeOpacity, aboutOpacity],
      ),
    ).toEqual([
      ["far", 0.34, 0.58],
      ["core", 0.42, 0.88],
      ["drift", 0.26, 0.56],
      ["near", 0.1, 0.48],
      ["crown", 0.4, 0.38],
      ["veil", 0.34, 0.4],
      ["lower-bank", 0.24, 0.34],
    ]);
    expect(
      universeNebulaLayerProfiles("high").map(({ travelOpacity }) =>
        Number(travelOpacity.toFixed(3)),
      ),
    ).toEqual([0.08, 0.08, 0.05, 0.01, 0.04, 0.05, 0.03]);
  });

  test("bursts deterministic rays from interactive and ambient cloud pockets", () => {
    const ambient = universeAboutRayIntensity(2_200, 0.17, 1, 0);
    const interactive = universeAboutRayIntensity(2_200, 0.17, 0, 1);

    expect(universeAboutRayIntensity(2_200, 0.17, 1, 0)).toBe(ambient);
    expect(ambient).toBeGreaterThan(0);
    expect(interactive).toBeGreaterThan(0);
    expect(universeAboutRayIntensity(2_200, 0.17, 1, 1, true)).toBeCloseTo(
      0.34,
      5,
    );
  });

  test("produces deterministic light bursts for every semantic layer", () => {
    const profiles = universeNebulaLayerProfiles("high");
    const first = profiles.map((profile) =>
      universeNebulaBurst(4_200, profile),
    );
    const repeated = profiles.map((profile) =>
      universeNebulaBurst(4_200, profile),
    );

    expect(repeated).toEqual(first);
    expect(first.some((burst) => burst > 0)).toBe(true);
    expect(first.every((burst) => burst >= 0 && burst <= 0.12)).toBe(true);
  });
});

describe("portfolio universe flight trails", () => {
  test("envelopes trails between zero-opacity endpoints", () => {
    expect(universeTrailEnvelope(0)).toBeCloseTo(0, 10);
    expect(universeTrailEnvelope(0.5)).toBeCloseTo(1, 10);
    expect(universeTrailEnvelope(1)).toBeCloseTo(0, 10);
    expect(universeTrailEnvelope(0.5, true)).toBe(0);
  });

  test("aligns segments with forward and reverse camera tangents", () => {
    const anchor = { x: 2, y: 3, z: 4 } as const;
    const [forward] = universeTrailSegment(anchor, { x: 1, y: -2, z: -3 }, 0.5);
    const [reverse] = universeTrailSegment(anchor, { x: -1, y: 2, z: 3 }, 0.5);

    expect(forward.x).toBeGreaterThan(anchor.x);
    expect(forward.y).toBeLessThan(anchor.y);
    expect(reverse.x).toBeLessThan(anchor.x);
    expect(reverse.y).toBeGreaterThan(anchor.y);
  });
});

describe("portfolio universe star effects", () => {
  test("keeps the Home constellation legible but subdued", () => {
    for (const channel of ["points", "lines"] as const) {
      expect(UNIVERSE_CONSTELLATION_OPACITY.home[channel]).toBeGreaterThan(0);
      expect(
        UNIVERSE_CONSTELLATION_OPACITY.projects[channel],
      ).toBeLessThanOrEqual(1);
      expect(UNIVERSE_CONSTELLATION_OPACITY.projects[channel]).toBeGreaterThan(
        UNIVERSE_CONSTELLATION_OPACITY.home[channel],
      );
    }
  });

  test("pulls semantic project accents into natural celestial tints", () => {
    const [red, green, blue] = universeConstellationTint("#ef4529", 0);

    for (const channel of [red, green, blue]) {
      expect(Number.isFinite(channel)).toBe(true);
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    expect(universeConstellationTint("#ef4529", 0)).toEqual([red, green, blue]);
    expect(universeConstellationTint("#3157ff", 0)).not.toEqual([
      red,
      green,
      blue,
    ]);
  });

  test("keeps exact particle totals across all depth bands", () => {
    expect(universeStarBandCounts(288)).toEqual({
      far: 150,
      middle: 86,
      near: 52,
    });
    expect(Object.values(universeStarBandCounts(176))).toEqual([92, 53, 31]);
  });

  test("samples seeded twinkles deterministically without exceeding glow bounds", () => {
    const first = universeTwinkleSample(3_250, 1.7, 0.82);

    expect(universeTwinkleSample(3_250, 1.7, 0.82)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0.72);
    expect(first).toBeLessThanOrEqual(1.5);
    expect(universeTwinkleSample(-5, 1.7, 0.82)).toBe(
      universeTwinkleSample(0, 1.7, 0.82),
    );
  });

  test("energizes Projects deterministically and freezes reduced motion", () => {
    expect(universeConstellationPulse(0, 1)).toBeCloseTo(0.5, 10);
    expect(universeConstellationPulse(2_000, 1)).not.toBeCloseTo(0.5, 3);
    expect(universeConstellationPulse(2_000, 0)).toBe(0);
    expect(universeConstellationPulse(2_000, 1, true)).toBeCloseTo(0.5, 10);
  });

  test("keeps Earth opaque at its fixed world position for every scene", () => {
    for (const scene of ["home", "about", "projects", "travel"] as const) {
      expect(
        universeEarthVisualState({
          home: scene === "home" ? 1 : 0,
          about: scene === "about" ? 1 : 0,
          projects: scene === "projects" ? 1 : 0,
          travel: scene === "travel" ? 1 : 0,
        }).opacity,
      ).toBe(1);
    }
    expect(
      universeEarthVisualState({
        home: 0,
        about: 1,
        projects: 0,
        travel: 0,
      }),
    ).toEqual({ opacity: 1, offset: { x: 0, y: 0 } });
  });

  test("uses one light palette across Home and Travel states", () => {
    expect(UNIVERSE_EARTH_PALETTE).toEqual({
      ocean: "#dce9ec",
      land: "#f5f0e8",
      homeVisited: "#bbb2d2",
      visited: "#ff8d6d",
      active: "#b7cf69",
      activeOutline: "#ff8d6d",
      coastline: "rgba(67, 54, 65, .28)",
    });
  });
});

describe("project constellation fallbacks", () => {
  test("are deterministic for a project id and distinct across ids", () => {
    const first = resolveProjectConstellation("future-project", 3);
    const repeated = resolveProjectConstellation("future-project", 3);
    const second = resolveProjectConstellation("another-project", 3);

    expect(repeated).toEqual(first);
    expect(second.points).not.toEqual(first.points);
  });

  test("produce valid edges inside the generated point set", () => {
    const fallback = resolveProjectConstellation("unmapped-project", 9);

    expect(fallback.points.length).toBeGreaterThanOrEqual(7);
    expect(
      fallback.edges.every(([from, to]) =>
        [from, to].every(
          (pointIndex) =>
            pointIndex >= 0 && pointIndex < fallback.points.length,
        ),
      ),
    ).toBe(true);
  });
});

describe("project constellation manifest", () => {
  test("maps authored and generated projects into a serializable renderer contract", () => {
    const manifest = createProjectConstellationManifest([
      "sightline",
      "future-project",
    ]);

    expect(manifest.map(({ id }) => id)).toEqual([
      "sightline",
      "future-project",
    ]);
    expect(manifest[0]).toMatchObject({
      id: "sightline",
      motif: "spatial sightline",
      accent: "#ef4529",
      worldOffset: { x: 1.4, y: 2.8, z: 0 },
      depth: 96,
    });
    expect(manifest[1].points.length).toBeGreaterThanOrEqual(7);
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });

  test("is deterministic, trims IDs, and omits empty or duplicate entries", () => {
    const projectIds = [" future-project ", "", "sightline", "future-project"];
    const first = createProjectConstellationManifest(projectIds);

    expect(createProjectConstellationManifest(projectIds)).toEqual(first);
    expect(first.map(({ id }) => id)).toEqual(["future-project", "sightline"]);
    expect(first[0]).toMatchObject(
      createProjectConstellationManifest(["future-project"])[0],
    );
  });
});
