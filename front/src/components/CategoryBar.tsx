interface CategoryData {
  name: string;
  amount: number;
  color: string;
}

export function CategoryBar({ categories }: { categories: CategoryData[] }) {
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-3">
      <h4 className="text-data font-semibold">Категории</h4>
      <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
        {categories.map((c) => (
          <div
            key={c.name}
            className="h-full transition-all duration-300"
            style={{
              width: `${(c.amount / total) * 100}%`,
              backgroundColor: c.color,
            }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {categories.map((c) => (
          <div key={c.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-data capitalize">{c.name}</span>
            </div>
            <span className="font-mono-nums text-data text-muted-foreground">
              ${c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
