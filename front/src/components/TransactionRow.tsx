import { motion } from "framer-motion";
import { ShoppingCart, Utensils, Home, Car, Zap, Heart, GraduationCap, Plane, Lock, Music } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  groceries: ShoppingCart,
  dining: Utensils,
  housing: Home,
  transport: Car,
  utilities: Zap,
  health: Heart,
  education: GraduationCap,
  travel: Plane,
  entertainment: Music,
};

export interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  isShared: boolean;
  memberAvatar?: string;
  memberInitials?: string;
  date: string;
}

export function TransactionRow({ tx }: { tx: Transaction }) {
  const Icon = categoryIcons[tx.category] || ShoppingCart;
  const isIncome = tx.amount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      whileHover={{ backgroundColor: "hsl(240 5% 95%)" }}
      className="ledger-row cursor-default transition-colors duration-150"
    >
      <div className="flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <span className="text-data font-medium truncate">{tx.merchant}</span>
      <div className="flex items-center justify-center">
        {tx.isShared ? (
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium text-secondary-foreground">
            {tx.memberInitials || "FM"}
          </div>
        ) : (
          <Lock className="w-3.5 h-3.5 opacity-40" />
        )}
      </div>
      <span
        className={`text-right font-mono-nums text-data font-medium ${
          isIncome ? "text-income" : ""
        }`}
      >
        {isIncome ? "+" : "−"}${Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </motion.div>
  );
}
