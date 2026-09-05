import type { PanelPosition } from "@/types/panel-layout";

export type PanelOrientation = "horizontal" | "vertical";

export interface GenerateRangéesOptions {
  zonePolygon: number[][];
  panelLengthM: number;
  panelWidthM: number;
  orientation: PanelOrientation;
  totalPanels: number;
  numRangées: number;
  colsPerRangée: number;
  spacingXM: number;
  spacingYM: number;
  gapRangéeM: number;
  orientationDeg: number;
  /** Margin in meters to keep panels away from zone edges (default 0.3) */
  marginM?: number;
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(
  point: [number, number],
  polygon: number[][]
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Check if ALL 4 corners of a panel are inside the polygon */
function panelInsideZone(
  corners: [number, number][],
  polygon: number[][]
): boolean {
  return corners.every((c) => pointInPolygon(c, polygon));
}

/**
 * Shrink a polygon inward by `marginM` meters.
 * Moves each vertex toward the centroid by the margin distance.
 */
function shrinkPolygon(
  polygon: number[][],
  marginM: number,
  mPerDegLat: number,
  mPerDegLng: number
): number[][] {
  const cLng = polygon.reduce((s, c) => s + c[0], 0) / polygon.length;
  const cLat = polygon.reduce((s, c) => s + c[1], 0) / polygon.length;

  return polygon.map((vertex) => {
    const dxM = (vertex[0] - cLng) * mPerDegLng;
    const dyM = (vertex[1] - cLat) * mPerDegLat;
    const dist = Math.sqrt(dxM * dxM + dyM * dyM);
    if (dist < marginM) return [cLng, cLat]; // vertex too close to centroid
    const scale = (dist - marginM) / dist;
    return [
      cLng + (vertex[0] - cLng) * scale,
      cLat + (vertex[1] - cLat) * scale,
    ];
  });
}

/**
 * Generate panel rectangles arranged as rangées (tables) stacked top→bottom.
 * Only panels entirely inside the zone polygon (with margin) are kept.
 */
export function generateRangées(opts: GenerateRangéesOptions): PanelPosition[] {
  const {
    zonePolygon,
    panelLengthM,
    panelWidthM,
    orientation,
    totalPanels,
    numRangées,
    colsPerRangée,
    spacingXM,
    spacingYM,
    gapRangéeM,
    orientationDeg,
    marginM = 0.3,
  } = opts;

  // Panel footprint depends on orientation
  const panelW = orientation === "horizontal" ? panelLengthM : panelWidthM;
  const panelH = orientation === "horizontal" ? panelWidthM : panelLengthM;

  // Zone centroid
  const cLng = zonePolygon.reduce((s, c) => s + c[0], 0) / zonePolygon.length;
  const cLat = zonePolygon.reduce((s, c) => s + c[1], 0) / zonePolygon.length;

  // Meters → degrees at this latitude
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((cLat * Math.PI) / 180);

  const pw = panelW / mPerDegLng;
  const ph = panelH / mPerDegLat;
  const spX = spacingXM / mPerDegLng;
  const spY = spacingYM / mPerDegLat;
  const gapR = gapRangéeM / mPerDegLat;

  const cellW = pw + spX;
  const cellH = ph + spY;

  // Distribute panels across rangées
  const panelsPerRangée = Math.ceil(totalPanels / numRangées);
  const rangées: { cols: number; rows: number }[] = [];
  let remaining = totalPanels;

  for (let r = 0; r < numRangées; r++) {
    const count = Math.min(remaining, panelsPerRangée);
    if (count <= 0) break;
    const cols = Math.min(colsPerRangée, count);
    const rows = Math.ceil(count / cols);
    rangées.push({ cols, rows });
    remaining -= count;
  }

  // Compute total height to center vertically
  let totalH = 0;
  for (let r = 0; r < rangées.length; r++) {
    totalH += rangées[r].rows * cellH - spY;
    if (r < rangées.length - 1) totalH += gapR;
  }

  // Total width = widest rangée
  const maxCols = Math.max(...rangées.map((r) => r.cols));
  const totalW = maxCols * cellW - spX;

  // Starting position (top-left, centered on centroid)
  const startLng = cLng - totalW / 2;
  let currentLat = cLat + totalH / 2;

  const rotRad = (orientationDeg * Math.PI) / 180;
  const features: PanelPosition[] = [];
  let idx = 0;
  let panelsPlaced = 0;

  // Prepare shrunk polygon for containment test (with margin)
  const rawPoly = zonePolygon;
  const lastPt = rawPoly[rawPoly.length - 1];
  const firstPt = rawPoly[0];
  const openPoly =
    lastPt[0] === firstPt[0] && lastPt[1] === firstPt[1]
      ? rawPoly.slice(0, -1)
      : rawPoly;

  const testPoly = marginM > 0
    ? shrinkPolygon(openPoly, marginM, mPerDegLat, mPerDegLng)
    : openPoly;

  for (const rangée of rangées) {
    for (let row = 0; row < rangée.rows; row++) {
      for (let col = 0; col < rangée.cols; col++) {
        if (panelsPlaced >= totalPanels) break;

        const pLng = startLng + col * cellW + pw / 2;
        const pLat = currentLat - row * cellH - ph / 2;

        // 4 corners relative to center
        const hw = pw / 2;
        const hh = ph / 2;
        const corners: [number, number][] = [
          [-hw, hh],
          [hw, hh],
          [hw, -hh],
          [-hw, -hh],
        ];

        // Rotate around zone centroid
        const rotatedCorners = corners.map(([dx, dy]) => {
          const dxM = dx * mPerDegLng;
          const dyM = dy * mPerDegLat;
          const rx = dxM * Math.cos(rotRad) - dyM * Math.sin(rotRad);
          const ry = dxM * Math.sin(rotRad) + dyM * Math.cos(rotRad);
          return [
            pLng + rx / mPerDegLng,
            pLat + ry / mPerDegLat,
          ] as [number, number];
        });

        // Only keep panels entirely inside the shrunk zone polygon
        if (panelInsideZone(rotatedCorners, testPoly)) {
          const ring = [...rotatedCorners, rotatedCorners[0]];
          features.push({
            type: "Feature",
            properties: { index: idx, rotation_deg: orientationDeg },
            geometry: { type: "Polygon", coordinates: [ring] },
          });
          idx++;
        }
        panelsPlaced++;
      }
      if (panelsPlaced >= totalPanels) break;
    }

    // Move down for next rangée
    currentLat -= rangée.rows * cellH - spY + gapR;
  }

  return features;
}
