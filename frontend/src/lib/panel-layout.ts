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
}

/**
 * Generate panel rectangles arranged as rangées (tables) stacked top→bottom.
 *
 * Each rangée is a grid of (colsPerRangée × rowsPerRangée) panels.
 * Rangées are separated by `gapRangéeM`.
 *
 * Orientation controls whether each panel is placed landscape (H) or portrait (V).
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

        const ring = [...rotatedCorners, rotatedCorners[0]];
        features.push({
          type: "Feature",
          properties: { index: idx, rotation_deg: orientationDeg },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
        idx++;
        panelsPlaced++;
      }
      if (panelsPlaced >= totalPanels) break;
    }

    // Move down for next rangée
    currentLat -= rangée.rows * cellH - spY + gapR;
  }

  return features;
}
