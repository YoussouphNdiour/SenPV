"use client";

import { useTranslations } from "next-intl";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import type { LineItem } from "@/types/quote";

function formatFCFA(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

interface LineItemTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
}

export function LineItemTable({ items, onChange, readOnly }: LineItemTableProps) {
  const t = useTranslations("quote");

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { description: "", quantity: 1, unit_price_fcfa: 0 }]);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_fcfa,
    0,
  );

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead className="w-24 text-right">{t("quantity")}</TableHead>
            <TableHead className="w-40 text-right">{t("unitPrice")}</TableHead>
            <TableHead className="w-40 text-right">{t("total")}</TableHead>
            {!readOnly && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                {readOnly ? (
                  item.description
                ) : (
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    className="h-8"
                  />
                )}
              </TableCell>
              <TableCell className="text-right">
                {readOnly ? (
                  item.quantity
                ) : (
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(i, "quantity", parseInt(e.target.value) || 1)
                    }
                    className="h-8 w-20 text-right ml-auto"
                  />
                )}
              </TableCell>
              <TableCell className="text-right">
                {readOnly ? (
                  `${formatFCFA(item.unit_price_fcfa)} FCFA`
                ) : (
                  <Input
                    type="number"
                    min={0}
                    value={item.unit_price_fcfa}
                    onChange={(e) =>
                      updateItem(i, "unit_price_fcfa", parseInt(e.target.value) || 0)
                    }
                    className="h-8 w-36 text-right ml-auto"
                  />
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatFCFA(item.quantity * item.unit_price_fcfa)} FCFA
              </TableCell>
              {!readOnly && (
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveItem(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveItem(i, 1)}
                      disabled={i === items.length - 1}
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={readOnly ? 5 : 6}
                className="text-center text-muted-foreground py-8"
              >
                {t("lineItems")} — {t("create")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={readOnly ? 4 : 4} className="text-right font-medium">
              {t("subtotal")}
            </TableCell>
            <TableCell className="text-right font-bold">
              {formatFCFA(subtotal)} FCFA
            </TableCell>
            {!readOnly && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>

      {!readOnly && (
        <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>
          <Plus className="size-4 mr-1" />
          {t("lineItems")}
        </Button>
      )}
    </div>
  );
}
