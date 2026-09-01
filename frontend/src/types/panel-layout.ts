export interface PanelPosition {
  type: "Feature";
  properties: {
    index: number;
    rotation_deg: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

export interface PanelLayoutGeoJSON {
  type: "FeatureCollection";
  features: PanelPosition[];
}

export interface PanelLayout {
  id: string;
  roof_zone_id: string;
  panel_model_id: string;
  inverter_model_id: string | null;
  num_panels: number;
  num_strings: number;
  panels_per_string: number;
  spacing_x: number;
  spacing_y: number;
  layout_geojson: PanelLayoutGeoJSON | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePanelLayout {
  roof_zone_id: string;
  panel_model_id: string;
  inverter_model_id?: string;
  spacing_x?: number;
  spacing_y?: number;
}

export interface UpdatePanelLayout {
  panel_model_id?: string;
  inverter_model_id?: string;
  num_panels?: number;
  num_strings?: number;
  panels_per_string?: number;
  spacing_x?: number;
  spacing_y?: number;
  layout_geojson?: PanelLayoutGeoJSON;
}

export interface AddPanelRequest {
  lat: number;
  lon: number;
}
