"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyProduction } from "@/types/simulation";

const MONTH_KEYS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

const MONTH_KEYS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface ProductionChartProps {
  data: MonthlyProduction[];
  locale?: string;
}

export function ProductionChart({ data, locale = "fr" }: ProductionChartProps) {
  const t = useTranslations("simulation");
  const monthNames = locale === "en" ? MONTH_KEYS_EN : MONTH_KEYS_FR;

  const chartData = data.map((d) => ({
    name: monthNames[d.month - 1] ?? `M${d.month}`,
    kwh: d.kwh,
  }));

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-4">{t("monthlyProduction")}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" className="text-xs" />
          <YAxis unit=" kWh" className="text-xs" />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} kWh`, "Production"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
          />
          <Bar dataKey="kwh" fill="url(#solarGradient)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
