import { useState } from "react";
import { LayoutDashboard, ArrowUpDown, PieChart, Users, Settings } from "lucide-react";
import { TransactionRow, type Transaction } from "@/components/TransactionRow";
import { BudgetCard, type Budget } from "@/components/BudgetCard";
import { QuickEntry } from "@/components/QuickEntry";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { CategoryBar } from "@/components/CategoryBar";
import { FamilyMember } from "@/components/FamilyMember";

const initialTransactions: Transaction[] = [
  { id: "1", merchant: "Перекрёсток", amount: -4250.00, category: "groceries", isShared: true, memberInitials: "АИ", date: "15 мар" },
  { id: "2", merchant: "Яндекс.Еда", amount: -1890.00, category: "dining", isShared: true, memberInitials: "МИ", date: "15 мар" },
  { id: "3", merchant: "Зарплата", amount: 120000.00, category: "income", isShared: true, memberInitials: "АИ", date: "14 мар" },
  { id: "4", merchant: "Аптека Ригла", amount: -760.00, category: "health", isShared: false, date: "14 мар" },
  { id: "5", merchant: "МосЭнерго", amount: -3200.00, category: "utilities", isShared: true, memberInitials: "АИ", date: "13 мар" },
  { id: "6", merchant: "Яндекс.Такси", amount: -450.00, category: "transport", isShared: false, date: "13 мар" },
  { id: "7", merchant: "Подписка Spotify", amount: -199.00, category: "entertainment", isShared: true, memberInitials: "МИ", date: "12 мар" },
  { id: "8", merchant: "ВкусВилл", amount: -2100.00, category: "groceries", isShared: true, memberInitials: "МИ", date: "12 мар" },
  { id: "9", merchant: "Фриланс проект", amount: 35000.00, category: "income", isShared: false, date: "11 мар" },
  { id: "10", merchant: "IKEA", amount: -8450.00, category: "housing", isShared: true, memberInitials: "АИ", date: "10 мар" },
];

const budgets: Budget[] = [
  { id: "1", category: "Продукты", limit: 25000, spent: 18200 },
  { id: "2", category: "Рестораны", limit: 10000, spent: 11890 },
  { id: "3", category: "Транспорт", limit: 8000, spent: 3450 },
  { id: "4", category: "Здоровье", limit: 5000, spent: 760 },
  { id: "5", category: "Развлечения", limit: 6000, spent: 4199 },
];

const spendingData = [
  { label: "1 мар", value: 3200 },
  { label: "5 мар", value: 5800 },
  { label: "8 мар", value: 2100 },
  { label: "10 мар", value: 12600 },
  { label: "12 мар", value: 4300 },
  { label: "14 мар", value: 6900 },
  { label: "15 мар", value: 6140 },
];

const categoryData = [
  { name: "Продукты", amount: 18200, color: "hsl(240 6% 25%)" },
  { name: "Рестораны", amount: 11890, color: "hsl(240 6% 40%)" },
  { name: "Жильё", amount: 8450, color: "hsl(240 6% 55%)" },
  { name: "Транспорт", amount: 3450, color: "hsl(240 6% 65%)" },
  { name: "Здоровье", amount: 760, color: "hsl(240 6% 75%)" },
  { name: "Развлечения", amount: 4199, color: "hsl(240 6% 85%)" },
];

const navItems = [
  { icon: LayoutDashboard, label: "Обзор" },
  { icon: ArrowUpDown, label: "Операции" },
  { icon: PieChart, label: "Аналитика" },
  { icon: Users, label: "Семья" },
  { icon: Settings, label: "Настройки" },
];

const familyMembers = [
  { initials: "АИ", name: "Алексей Иванов" },
  { initials: "МИ", name: "Мария Иванова" },
];

export default function Index() {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [activeNav, setActiveNav] = useState(0);
  const [activeMember, setActiveMember] = useState<string | null>(null);

  const totalBalance = 214204.50;
  const monthIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const monthExpense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const filteredTx = activeMember
    ? transactions.filter((t) => t.memberInitials === activeMember)
    : transactions;

  const handleAdd = (tx: { merchant: string; amount: number; category: string; isShared: boolean }) => {
    const newTx: Transaction = {
      id: Date.now().toString(),
      ...tx,
      memberInitials: "АИ",
      date: "Сегодня",
    };
    setTransactions([newTx, ...transactions]);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col shrink-0">
        <div className="px-4 py-5">
          <h1 className="text-sm font-bold tracking-tight">Ledger Flow</h1>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(i)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-data transition-colors duration-150 ${
                activeNav === i
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-2 pb-4">
          <div className="border-t pt-3 space-y-0.5">
            <p className="px-3 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Семья</p>
            <FamilyMember
              initials="Все"
              name="Все участники"
              isActive={activeMember === null}
              onClick={() => setActiveMember(null)}
            />
            {familyMembers.map((m) => (
              <FamilyMember
                key={m.initials}
                {...m}
                isActive={activeMember === m.initials}
                onClick={() => setActiveMember(m.initials)}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Баланс семьи</p>
            <h2 className="text-display">
              <span className="font-mono-nums">${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Доходы</p>
              <p className="font-mono-nums text-data font-medium text-income">
                +${monthIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Расходы</p>
              <p className="font-mono-nums text-data font-medium">
                −${monthExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <QuickEntry onAdd={handleAdd} />
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Transaction ledger */}
          <section className="flex-1 min-w-0 overflow-y-auto">
            <div className="px-6 py-3 flex items-center justify-between border-b">
              <h3 className="text-data font-semibold">Операции · Март 2026</h3>
              <span className="text-[11px] text-muted-foreground">{filteredTx.length} записей</span>
            </div>
            <div>
              {filteredTx.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
              {filteredTx.length === 0 && (
                <div className="px-6 py-12 text-center text-muted-foreground text-data">
                  Нет операций за этот период. Начните вести учёт.
                </div>
              )}
            </div>
          </section>

          {/* Right panel */}
          <aside className="w-72 border-l bg-card overflow-y-auto shrink-0">
            <div className="p-5 space-y-6">
              {/* Budgets */}
              <div>
                <h3 className="text-data font-semibold mb-1">Лимиты бюджетов</h3>
                <div className="divide-y">
                  {budgets.map((b) => (
                    <BudgetCard key={b.id} budget={b} />
                  ))}
                </div>
              </div>

              {/* Category breakdown */}
              <CategoryBar categories={categoryData} />

              {/* Spending chart */}
              <AnalyticsChart data={spendingData} title="Расходы за месяц" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
