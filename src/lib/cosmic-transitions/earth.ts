export const HOME_EARTH_ROTATION = [85, 5, 0] as const;

export const TRAVEL_EARTH_ROTATION = [-108, -22, 0] as const;

export const TORONTO_COORDINATES = [-79.3832, 43.6532] as const;

export const HOME_EARTH_LAND_ASSET = "/media/cosmic/earth-land-110m.svg#land";

// Projected once with HOME_EARTH_ROTATION so the shared Earth does not need to
// parse the world atlas or run d3-geo while rendering every page.
export const HOME_BASE_POINT = [191.6137272566104, 56.930789116840685] as const;
