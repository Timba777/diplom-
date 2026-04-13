import { useEffect, useMemo, useState } from "react";
import {
  getAnalyticsSummary,
  getAnalyticsByCategory,
  getAnalyticsByPeriod,
  getAnalyticsUnplanned,
  getFamilies,
  getFamilyAnalytics,
  getErrorMessage,
  type AnalyticsSummary,
  type CategoryAnalyticsRow,
  type Family,
  type FamilyAnalyticsResponse,
  type UnplannedAnalytics,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function toNum(v: string | number): number {
  if (typeof v === "number") return v;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

const FAMILY_NONE = "__none__";

type PeriodChartRow = {
  period: string;
  income: number;
  expense: number;
};

function mergePeriodCharts(
  income: { period: string; totalAmount: string; operationsCount: number }[],
  expense: { period: string; totalAmount: string; operationsCount: number }[],
): PeriodChartRow[] {
  const map = new Map<string, PeriodChartRow>();
  for (const p of income) {
    map.set(p.period, {
      period: p.period,
      income: toNum(p.totalAmount),
      expense: 0,
    });
  }
  for (const p of expense) {
    const cur = map.get(p.period) ?? {
      period: p.period,
      income: 0,
      expense: 0,
    };
    cur.expense = toNum(p.totalAmount);
    map.set(p.period, cur);
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function categoryPieData(rows: CategoryAnalyticsRow[]) {
  const total = rows.reduce((s, c) => s + toNum(c.totalAmount), 0);
  return rows.map((c) => ({
    categoryName: c.categoryName ?? "Без категории",
    totalAmount: toNum(c.totalAmount),
    operationsCount: c.operationsCount,
    percentage: total > 0 ? (toNum(c.totalAmount) / total) * 100 : 0,
  }));
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [byCategory, setByCategory] = useState<CategoryAnalyticsRow[]>([]);
  const [byPeriod, setByPeriod] = useState<PeriodChartRow[]>([]);
  const [unplanned, setUnplanned] = useState<UnplannedAnalytics | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyAnalytics, setFamilyAnalytics] =
    useState<FamilyAnalyticsResponse | null>(null);
  const [selectedFamily, setSelectedFamily] = useState(FAMILY_NONE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, c, u, f, inc, exp] = await Promise.all([
          getAnalyticsSummary(),
          getAnalyticsByCategory({ type: "EXPENSE" }),
          getAnalyticsUnplanned(),
          getFamilies(),
          getAnalyticsByPeriod({
            groupBy: "month",
            type: "INCOME",
          }),
          getAnalyticsByPeriod({
            groupBy: "month",
            type: "EXPENSE",
          }),
        ]);
        if (cancelled) return;
        setSummary(s);
        setByCategory(c);
        setUnplanned(u);
        setFamilies(f);
        setByPeriod(mergePeriodCharts(inc.periods, exp.periods));
      } catch (e) {
        if (!cancelled) toast.error(getErrorMessage(e, "Не удалось загрузить аналитику"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedFamily || selectedFamily === FAMILY_NONE) {
      setFamilyAnalytics(null);
      return;
    }
    getFamilyAnalytics(selectedFamily)
      .then(setFamilyAnalytics)
      .catch((e) => {
        setFamilyAnalytics(null);
        toast.error(getErrorMessage(e));
      });
  }, [selectedFamily]);

  const pieData = useMemo(() => categoryPieData(byCategory), [byCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Доходы",
            value: summary ? toNum(summary.totalIncome) : 0,
            icon: TrendingUp,
            color: "text-income",
            prefix: "+",
          },
          {
            label: "Расходы",
            value: summary ? toNum(summary.totalExpense) : 0,
            icon: TrendingDown,
            color: "text-destructive",
            prefix: "−",
          },
          {
            label: "Баланс",
            value: summary ? toNum(summary.balance) : 0,
            icon: Wallet,
            color: "",
            prefix: "",
          },
          {
            label: "Незаплан.",
            value: unplanned?.totalUnplannedCount ?? 0,
            icon: ShoppingCart,
            isCount: true,
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon
                  className={cn("h-4 w-4 text-muted-foreground", c.color)}
                />
              </div>
              <span
                className={cn("text-lg font-semibold font-mono-nums", c.color)}
              >
                {c.isCount
                  ? c.value
                  : `${c.prefix}${fmt(c.value as number)} ₽`}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Расходы по категориям</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет данных
              </p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="totalAmount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                      label={({ categoryName, percentage }) =>
                        `${categoryName} ${percentage.toFixed(0)}%`
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${fmt(value)} ₽`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {pieData.map((c, i) => (
                    <Badge
                      key={`${c.categoryName}-${i}`}
                      variant="secondary"
                      className="text-xs"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      {c.categoryName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Доходы и расходы по месяцам
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byPeriod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет данных
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byPeriod}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(240 5% 90%)"
                  />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => `${fmt(value)} ₽`}
                  />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name="Доходы"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    name="Расходы"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {unplanned && unplanned.totalUnplannedCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Незапланированные покупки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Всего:{" "}
              <span className="font-mono-nums font-medium">
                {fmt(toNum(unplanned.totalUnplannedAmount))} ₽
              </span>{" "}
              ({unplanned.totalUnplannedCount} шт.)
            </p>
            <div className="space-y-1">
              {unplanned.recentUnplanned.slice(0, 10).map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm">{op.description || "Операция"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(op.date).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <span className="font-mono-nums text-sm font-medium">
                    −{fmt(toNum(op.amount))} ₽
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {families.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Семейная аналитика</CardTitle>
              <Select
                value={selectedFamily}
                onValueChange={setSelectedFamily}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Выберите семью" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FAMILY_NONE}>—</SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {selectedFamily === FAMILY_NONE ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Выберите семью для просмотра статистики
              </p>
            ) : familyAnalytics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Доходы
                    </span>
                    <p className="font-mono-nums font-medium text-income">
                      +{fmt(toNum(familyAnalytics.totalIncome))} ₽
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Расходы
                    </span>
                    <p className="font-mono-nums font-medium">
                      −{fmt(toNum(familyAnalytics.totalExpense))} ₽
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Баланс
                    </span>
                    <p className="font-mono-nums font-medium">
                      {fmt(toNum(familyAnalytics.balance))} ₽
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Операций
                    </span>
                    <p className="font-mono-nums font-medium">
                      {familyAnalytics.operationsCount}
                    </p>
                  </div>
                </div>
                {familyAnalytics.expensesByCategory?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Расходы семьи по категориям
                    </p>
                    <ul className="space-y-1 text-sm">
                      {familyAnalytics.expensesByCategory.map((row) => (
                        <li
                          key={`${row.categoryId}-${row.categoryName}`}
                          className="flex justify-between gap-2"
                        >
                          <span className="truncate">
                            {row.categoryName ?? "Без категории"}
                          </span>
                          <span className="font-mono-nums shrink-0">
                            {fmt(toNum(row.totalAmount))} ₽ ({row.operationsCount})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Загрузка...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
