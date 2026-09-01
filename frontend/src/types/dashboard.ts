export interface ParticularStats {
  nb_projects: number;
  total_kwc: number;
  total_savings: number;
}

export interface InstallerStats {
  nb_clients: number;
  nb_projects: number;
  total_kwc: number;
  ca_devis_accepted: number;
  active_projects: number;
}

export interface AdminStats {
  total_users: number;
  total_projects: number;
  total_kwc: number;
  nb_installers: number;
}

export type DashboardStats = ParticularStats | InstallerStats | AdminStats;

export interface RecentProject {
  id: string;
  name: string;
  address: string | null;
  status: string;
  created_at: string | null;
  peak_power_kwc: number | null;
  quote_total_fcfa: number | null;
  client_name: string | null;
}

export interface PipelineProject {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  peak_power_kwc: number | null;
  quote_total_fcfa: number | null;
}

export interface PipelineData {
  draft: PipelineProject[];
  study: PipelineProject[];
  quote: PipelineProject[];
  signed: PipelineProject[];
  installed: PipelineProject[];
}

export interface MonthCount {
  year: number;
  month: number;
  count: number;
}

export interface ChartData {
  projects_by_month: MonthCount[];
  registrations_by_month?: MonthCount[];
}
