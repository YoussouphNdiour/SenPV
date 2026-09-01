export interface LineItem {
  description: string;
  quantity: number;
  unit_price_fcfa: number;
}

export interface Quote {
  id: string;
  project_id: string;
  installer_id: string;
  reference: string | null;
  line_items: LineItem[];
  subtotal_fcfa: number;
  margin_pct: number | null;
  tax_rate_pct: number;
  tax_amount_fcfa: number;
  total_fcfa: number;
  payment_terms: string | null;
  validity_days: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface QuoteCreateInput {
  line_items: LineItem[];
  margin_pct: number;
  tax_rate_pct: number;
  payment_terms?: string;
  validity_days: number;
}
