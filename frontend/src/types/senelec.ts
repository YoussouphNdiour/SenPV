export interface TierBreakdown {
  tier: string;
  kwh: number;
  rate: number;
  amount: number;
}

export interface BillResult {
  monthly_kwh: number;
  tariff_tier: string;
  breakdown: TierBreakdown[];
  subtotal_fcfa: number;
  redevance_fcfa: number;
  tva_pct: number;
  tva_amount_fcfa: number;
  total_monthly_fcfa: number;
  total_annual_fcfa: number;
}

export interface SavingsResult {
  bill_without_pv: BillResult;
  bill_with_pv: BillResult;
  monthly_savings_fcfa: number;
  annual_savings_fcfa: number;
  self_consumption_pct: number;
  grid_reduction_pct: number;
}

export interface TariffInfo {
  tier: string;
  description: string;
  max_kwh: number | null;
  price_per_kwh: number;
}

export interface TariffData {
  currency: string;
  tariffs: TariffInfo[];
  taxes: {
    tva_pct: number;
    redevance_mensuelle_fcfa: number;
  };
}
