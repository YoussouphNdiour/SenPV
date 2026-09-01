export interface PanelSpecs {
  pmax_w: number;
  voc_v: number;
  vmp_v: number;
  isc_a: number;
  imp_a: number;
  efficiency_pct: number;
  temp_coeff_pmax_pct_per_c: number;
  temp_coeff_voc_pct_per_c: number;
  temp_coeff_isc_pct_per_c: number;
  noct_c: number;
  cells: number;
  cell_type: string;
  dimensions_mm: { length: number; width: number; height: number };
  weight_kg: number;
  warranty_years: number;
}

export interface InverterSpecs {
  max_pv_power_kw: number;
  max_pv_voltage_v: number;
  startup_voltage_v: number;
  mppt_voltage_range_v: string;
  rated_pv_voltage_v: number;
  max_input_current_a: number;
  max_short_circuit_current_a: number;
  num_mppt: number;
  strings_per_mppt: number;
  rated_ac_power_kw: number;
  max_ac_apparent_kva: number;
  rated_ac_current_a: number;
  max_ac_current_a: number;
  rated_output_voltage_v: number;
  rated_output_freq_hz: number;
  output_freq_range_hz: string;
  power_factor_range: string;
  thdi_pct: number;
  dc_injection_ma: number;
  max_efficiency_pct: number;
  euro_efficiency_pct: number;
  mppt_efficiency_pct: number;
  protection?: Record<string, boolean>;
  dimensions_mm: { width: number; height: number; depth: number };
  weight_kg: number;
  ip_rating: string;
  warranty_years: number;
}

export interface Equipment {
  id: string;
  owner_id: string | null;
  type: "panel" | "inverter";
  manufacturer: string;
  model: string;
  specs: PanelSpecs | InverterSpecs;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipment {
  type: "panel" | "inverter";
  manufacturer: string;
  model: string;
  specs: PanelSpecs | InverterSpecs;
  is_global?: boolean;
}

export interface UpdateEquipment {
  type?: "panel" | "inverter";
  manufacturer?: string;
  model?: string;
  specs?: PanelSpecs | InverterSpecs;
  is_global?: boolean;
}

export interface PaginatedEquipment {
  items: Equipment[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
