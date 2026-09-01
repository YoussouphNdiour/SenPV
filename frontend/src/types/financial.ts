export interface CashflowEntry {
  year: number;
  production_kwh: number;
  savings_fcfa: number;
  maintenance_fcfa: number;
  net_cashflow_fcfa: number;
  cumulative_fcfa: number;
}

export interface FinancialResult {
  id: string;
  simulation_id: string;
  total_cost_fcfa: number;
  annual_savings_year1_fcfa: number;
  payback_years: number | null;
  npv_fcfa: number;
  irr_pct: number | null;
  roi_pct: number;
  lcoe_fcfa_per_kwh: number;
  cashflow_25y: CashflowEntry[];
}

export interface FinancialRequest {
  total_cost_fcfa: number;
  annual_savings_fcfa: number;
  maintenance_annual_fcfa?: number;
  degradation_rate_pct?: number;
  discount_rate_pct?: number;
  inflation_rate_pct?: number;
}
