"use client";

import { useTranslations } from "next-intl";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from "recharts";
import type { CashflowEntry } from "@/types/financial";

interface CashflowChartProps {
  data: CashflowEntry[];
  paybackYear: number | null;
  locale?: string;
}

export function CashflowChart({
  data,
  paybackYear,
  locale = "fr",
}: CashflowChartProps) {
  const t = useTranslations("financial");

  const formatFcfa = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const formatFcfaFull = (value: number) =>
    `${value.toLocaleString(locale === "en" ? "en-US" : "fr-FR")} FCFA`;

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-4">{t("cashflow")}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="year"
            className="text-xs"
            label={{ value: t("year"), position: "insideBottom", offset: -2 }}
          />
          <YAxis
            className="text-xs"
            tickFormatter={formatFcfa}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatFcfaFull(value),
              name === "net_cashflow_fcfa" ? t("netCashflow") : t("cumulative"),
            ]}
            labelFormatter={(label) => `${t("year")} ${label}`}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
          />
          <Legend
            formatter={(value: string) =>
              value === "net_cashflow_fcfa" ? t("netCashflow") : t("cumulative")
            }
          />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />

          {/* Payback year marker */}
          {paybackYear && (
            <ReferenceLine
              x={Math.ceil(paybackYear)}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
            >
              <Label
                value={`${t("breakeven")} ~${paybackYear} ${locale === "fr" ? "ans" : "yrs"}`}
                position="top"
                fill="#f59e0b"
                fontSize={12}
              />
            </ReferenceLine>
          )}

          {/* Net cashflow bars */}
          <Bar
            dataKey="net_cashflow_fcfa"
            fill="#22c55e"
            radius={[2, 2, 0, 0]}
            // Color negative bars red via shape
            shape={(props: Record<string, unknown>) => {
              const { x, y, width, height, payload } = props as {
                x: number;
                y: number;
                width: number;
                height: number;
                payload: CashflowEntry;
              };
              const fill = payload.net_cashflow_fcfa < 0 ? "#ef4444" : "#22c55e";
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={fill}
                  rx={2}
                  ry={2}
                />
              );
            }}
          />

          {/* Cumulative line */}
          <Line
            type="monotone"
            dataKey="cumulative_fcfa"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
