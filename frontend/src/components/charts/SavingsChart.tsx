"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MONTH_KEYS_FR = [
  "Jan", "Fev", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aou", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_KEYS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface SavingsChartProps {
  monthlyWithout: number;
  monthlyWith: number;
  locale?: string;
}

export function SavingsChart({
  monthlyWithout,
  monthlyWith,
  locale = "fr",
}: SavingsChartProps) {
  const t = useTranslations("senelec");
  const monthNames = locale === "en" ? MONTH_KEYS_EN : MONTH_KEYS_FR;

  const chartData = monthNames.map((name) => ({
    name,
    withoutPv: monthlyWithout,
    withPv: monthlyWith,
  }));

  const formatFcfa = (value: number) =>
    `${value.toLocaleString(locale === "en" ? "en-US" : "fr-FR")} FCFA`;

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-4">{t("comparisonChart")}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" className="text-xs" />
          <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value, name) => [
              formatFcfa(Number(value)),
              String(name) === "withoutPv" ? t("withoutPv") : t("withPv"),
            ]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
          />
          <Legend
            formatter={(value: string) =>
              value === "withoutPv" ? t("withoutPv") : t("withPv")
            }
          />
          <Bar dataKey="withoutPv" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="withPv" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
