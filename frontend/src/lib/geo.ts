/**
 * Geographic coordinate utilities for SenPV.
 */

/**
 * Converts WGS84 coordinates to local 3D coordinates.
 * The center of the roof = origin (0, 0, 0).
 * X = east, Y = altitude, Z = south (Three.js convention).
 *
 * Uses equirectangular approximation — accurate enough for
 * building-scale distances (< 200m).
 */
export function wgs84ToLocal3D(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  tiltDeg: number
): { x: number; y: number; z: number } {
  const R = 6371000; // Earth radius in meters
  const toRad = Math.PI / 180;

  // Deltas in meters (equirectangular projection)
  const dLat = (lat - centerLat) * toRad * R;
  const dLon = (lon - centerLon) * toRad * R * Math.cos(centerLat * toRad);

  // X = east, Z = south (negate dLat because north is negative Z in Three.js)
  const x = dLon;
  const z = -dLat;

  // Y = height on the tilted roof surface
  // Tilt applies along the Z axis (south-facing tilt is typical in northern hemisphere)
  const tiltRad = tiltDeg * toRad;
  const y = -z * Math.tan(tiltRad);

  return { x, y, z };
}

/**
 * Computes the bounding box center of a GeoJSON polygon's coordinates.
 */
export function polygonCenter(
  coordinates: number[][][]
): { lat: number; lon: number } {
  const ring = coordinates[0]; // outer ring
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;

  for (const [lon, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };
}

/**
 * Computes the width (east-west) and depth (north-south) of a polygon in meters.
 */
export function polygonDimensions(
  coordinates: number[][][],
  centerLat: number
): { width: number; depth: number } {
  const ring = coordinates[0];
  const R = 6371000;
  const toRad = Math.PI / 180;

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  for (const [lon, lat] of ring) {
    const x =
      (lon - ring[0][0]) * toRad * R * Math.cos(centerLat * toRad);
    const z = (lat - ring[0][1]) * toRad * R;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return {
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}
