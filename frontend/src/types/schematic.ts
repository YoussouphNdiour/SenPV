export interface SchematicNodeData {
  node_type: string;
  label: string;
  rating_a?: number;
  cable_type?: string;
  section_mm2?: number;
  specs?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SchematicEdgeData {
  cable_type: 'dc' | 'ac' | 'ground';
  section_mm2: number;
  [key: string]: unknown;
}

export interface ValidationError {
  type: string;
  severity: 'critical' | 'warning';
  message: string;
  nodes?: string[];
}

export interface SchematicResponse {
  id: string;
  project_id: string;
  nodes: SchematicNodeRaw[];
  edges: SchematicEdgeRaw[];
  validation_errors: ValidationError[];
  created_at: string;
  updated_at: string;
}

export interface SchematicNodeRaw {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SchematicNodeData;
}

export interface SchematicEdgeRaw {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: SchematicEdgeData;
}

export interface SchematicGenerateResponse {
  nodes: SchematicNodeRaw[];
  edges: SchematicEdgeRaw[];
  validation_errors: ValidationError[];
}

export interface SchematicValidateResponse {
  validation_errors: ValidationError[];
}
