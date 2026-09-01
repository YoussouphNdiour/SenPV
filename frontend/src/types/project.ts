export type ProjectStatus = "draft" | "study" | "quote" | "signed" | "installed";

export interface Project {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  panel_count?: number;
}

export interface CreateProject {
  name: string;
  address?: string;
  lat: number;
  lon: number;
  client_id?: string;
  notes?: string;
}

export interface UpdateProject {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  status?: ProjectStatus;
  client_id?: string | null;
  notes?: string;
}
