export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
}

export function BudgetCard({ budget }: { budget: Budget }) {
  const pct = Math.min((budget.spent / budget.limit) * 100, 120);
  const isOver = budget.spent > budget.limit;
  const remaining = budget.limit - budget.spent;
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const dailyAllowance = remaining > 0 ? remaining / Math.max(daysLeft, 1) : 0;

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-data font-medium capitalize">{budget.category}</span>
        <span className="font-mono-nums text-data text-muted-foreground">
          ${budget.spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          <span className="text-muted-foreground/60"> / ${budget.limit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        </span>
      </div>
      <div className="budget-bar">
        <div
          className={isOver ? "budget-bar-fill-alert" : "budget-bar-fill"}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {isOver ? (
        <p className="text-[11px] text-alert">
          Превышение на ${Math.abs(remaining).toFixed(2)}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          ${dailyAllowance.toFixed(2)}/день · {daysLeft} дн. осталось
        </p>
      )}
    </div>
  );
}
