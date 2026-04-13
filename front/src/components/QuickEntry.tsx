import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";

const categories = ["groceries", "dining", "housing", "transport", "utilities", "health", "education", "travel", "entertainment"];

export function QuickEntry({ onAdd }: { onAdd?: (tx: { merchant: string; amount: number; category: string; isShared: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("groceries");
  const [isShared, setIsShared] = useState(true);
  const [isIncome, setIsIncome] = useState(false);

  const submit = () => {
    if (!amount || !merchant) return;
    onAdd?.({
      merchant,
      amount: (isIncome ? 1 : -1) * parseFloat(amount),
      category,
      isShared,
    });
    setAmount("");
    setMerchant("");
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-data font-medium hover:opacity-90 transition-opacity"
      >
        <Plus className="w-3.5 h-3.5" />
        Добавить
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-lg p-5 w-full max-w-sm shadow-modal space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Новая операция</h3>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsIncome(false)}
                  className={`flex-1 py-1.5 rounded text-data font-medium transition-colors ${!isIncome ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                >
                  Расход
                </button>
                <button
                  onClick={() => setIsIncome(true)}
                  className={`flex-1 py-1.5 rounded text-data font-medium transition-colors ${isIncome ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                >
                  Доход
                </button>
              </div>

              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-display font-mono-nums text-center outline-none focus:ring-1 focus:ring-ring"
              />

              <input
                type="text"
                placeholder="Описание"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-data outline-none focus:ring-1 focus:ring-ring"
              />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-data outline-none focus:ring-1 focus:ring-ring capitalize"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-data cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="rounded border-input"
                />
                Общий расход
              </label>

              <button
                onClick={submit}
                className="w-full py-2 rounded-md bg-primary text-primary-foreground text-data font-medium hover:opacity-90 transition-opacity"
              >
                Сохранить
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
