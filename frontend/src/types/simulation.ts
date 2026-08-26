export interface MonthlyProduction {
  month: number;
  kwh: number;
}

export interface SimulationResult {
  id: string;
  project_id: string;
  panel_layout_id: string;
  params: Record<string, unknown>;
  monthly_production: MonthlyProduction[];
  annual_kwh: number;
  specific_yield: number | null;
  peak_power_kwc: number | null;
  performance_ratio: number | null;
  created_at: string;
}

export interface OptimizationResult {
  optimal_tilt: number;
  optimal_azimuth: number;
  annual_kwh: number;
}
