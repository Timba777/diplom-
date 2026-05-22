import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeftRight,
  ShoppingCart,
  Gauge,
  Target,
} from "lucide-react";
import {
  getAnalyticsSummary,
  getOperations,
  getLimits,
  getGoals,
  type AnalyticsSummary,
  type Operation,
  type BudgetLimit,
  type FinancialGoal,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentOps, setRecentOps] = useState<Operation[]>([]);
  const [limits, setLimits] = useState<BudgetLimit[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getAnalyticsSummary(),
      getOperations(),
      getLimits(),
      getGoals(),
    ]).then(([s, o, l, g]) => {
      if (s.status === "fulfilled") setSummary(s.value);
      if (o.status === "fulfilled") setRecentOps(o.value.slice(0, 5));
      if (l.status === "fulfilled") setLimits(l.value);
      if (g.status === "fulfilled") setGoals(g.value);
      setLoading(false);
    });
  }, []);

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const nearestGoal = [...activeGoals]
    .filter((g) => g.deadline)
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    )[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const cards = [
    {
      title: "Доходы",
      value: summary ? toNum(summary.totalIncome) : 0,
      icon: TrendingUp,
      color: "text-income",
      prefix: "+",
    },
    {
      title: "Расходы",
      value: summary ? toNum(summary.totalExpense) : 0,
      icon: TrendingDown,
      color: "text-destructive",
      prefix: "−",
    },
    {
      title: "Баланс",
      value: summary ? toNum(summary.balance) : 0,
      icon: Wallet,
      color: "",
      prefix: "",
    },
    {
      title: "Операций",
      value: summary?.operationsCount ?? 0,
      icon: ArrowLeftRight,
      isCount: true,
    },
    {
      title: "Незаплан.",
      value: summary?.unplannedExpensesCount ?? 0,
      icon: ShoppingCart,
      isCount: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  {c.title}
                </span>
                <c.icon
                  className={cn("h-4 w-4 text-muted-foreground", c.color)}
                />
              </div>
              <span
                className={cn(
                  "text-xl font-semibold font-mono-nums tracking-tight",
                  c.color,
                )}
              >
                {c.isCount
                  ? c.value
                  : `${c.prefix}${fmt(c.value as number)} ₽`}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary && toNum(summary.unplannedExpensesTotal) > 0 && (
        <p className="text-sm text-muted-foreground">
          Сумма незапланированных расходов:{" "}
          <span className="font-mono-nums font-medium text-foreground">
            {fmt(toNum(summary.unplannedExpensesTotal))} ₽
          </span>
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Финансовые цели
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Активных целей</span>
              <span className="font-mono-nums font-semibold">
                {activeGoals.length}
              </span>
            </div>
            {nearestGoal ? (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium truncate">
                  {nearestGoal.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Дедлайн:{" "}
                  {new Date(nearestGoal.deadline!).toLocaleDateString("ru-RU")}
                </p>
                <div className="flex justify-between text-xs">
                  <span>
                    {fmt(nearestGoal.currentAmount)} /{" "}
                    {fmt(nearestGoal.targetAmount)} ₽
                  </span>
                  <span className="font-medium">
                    {Math.round(nearestGoal.progressPercent)}%
                  </span>
                </div>
                <div className="budget-bar">
                  <div
                    className="budget-bar-fill"
                    style={{
                      width: `${Math.min(nearestGoal.progressPercent, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {activeGoals.length === 0 ? (
                  <>
                    Целей нет.{" "}
                    <Link to="/goals" className="text-primary hover:underline">
                      Создать
                    </Link>
                  </>
                ) : (
                  "Нет целей с дедлайном"
                )}
              </p>
            )}
            <Link
              to="/goals"
              className="text-xs text-primary hover:underline block text-center"
            >
              Все цели →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Последние операции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0">
            {recentOps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Нет операций
              </p>
            ) : (
              recentOps.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between py-2.5 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {op.description || op.category?.name || "Операция"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(op.date).toLocaleDateString("ru-RU")}
                      {op.category && ` · ${op.category.name}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-mono-nums text-sm font-medium ml-3 whitespace-nowrap",
                      op.type === "INCOME" ? "text-income" : "",
                    )}
                  >
                    {op.type === "INCOME" ? "+" : "−"}
                    {fmt(toNum(op.amount))} ₽
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Активные лимиты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {limits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Лимиты не заданы.{" "}
                <Link to="/limits" className="text-primary hover:underline">
                  Создать
                </Link>
              </p>
            ) : (
              limits.slice(0, 6).map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg p-3 border border-border flex justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.scope === "CATEGORY"
                        ? l.category?.name || "Категория"
                        : "Общий"}{" "}
                      · {l.period === "WEEKLY" ? "Неделя" : "Месяц"}
                      {l.isBlocking ? " · блокирующий" : ""}
                    </p>
                  </div>
                  <span className="font-mono-nums text-xs shrink-0">
                    {fmt(toNum(l.amount))} ₽
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
