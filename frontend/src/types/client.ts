export interface Client {
  id: string;
  installer_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  monthly_kwh: number | null;
  senelec_tariff_tier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  project_count?: number;
}

export interface CreateClient {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  monthly_kwh?: number;
  senelec_tariff_tier?: string;
  notes?: string;
}

export interface UpdateClient {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  monthly_kwh?: number;
  senelec_tariff_tier?: string;
  notes?: string;
}
