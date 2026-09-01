export type RoofType = "flat" | "gable" | "hip" | "shed";

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface RoofZone {
  id: string;
  project_id: string;
  polygon: GeoJSONPolygon | null;
  orientation_deg: number | null;
  tilt_deg: number | null;
  roof_type: RoofType | null;
  area_m2: number | null;
  zone_index: number;
  created_at: string;
}

export interface CreateRoofZone {
  polygon: GeoJSONPolygon;
  orientation_deg?: number;
  tilt_deg?: number;
  roof_type?: RoofType;
}

export interface UpdateRoofZone {
  polygon?: GeoJSONPolygon;
  orientation_deg?: number;
  tilt_deg?: number;
  roof_type?: RoofType;
}
