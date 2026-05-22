import { useEffect, useMemo, useState } from "react";
import {
  getLimits,
  createLimit,
  updateLimit,
  deleteLimit,
  getCategories,
  getFamilies,
  getFamily,
  getErrorMessage,
  type BudgetLimit,
  type Category,
  type Family,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ShieldAlert, Gauge, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NONE_FAMILY = "__personal__";
const CAT_NONE = "__none_cat__";

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

interface LimitForm {
  name: string;
  amount: number;
  period: "WEEKLY" | "MONTHLY";
  scope: "TOTAL" | "CATEGORY";
  limitKind: "PERSONAL" | "FAMILY";
  isBlocking: boolean;
  categoryId: string;
  familyId: string;
}

const emptyForm: LimitForm = {
  name: "",
  amount: 0,
  period: "MONTHLY",
  scope: "TOTAL",
  limitKind: "PERSONAL",
  isBlocking: false,
  categoryId: CAT_NONE,
  familyId: NONE_FAMILY,
};

export default function LimitsPage() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<BudgetLimit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [ownerFamilies, setOwnerFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLimit | null>(null);
  const [form, setForm] = useState<LimitForm>(emptyForm);

  const load = () => {
    Promise.allSettled([getLimits(), getCategories(), getFamilies()]).then(
      ([l, c, f]) => {
        if (l.status === "fulfilled") setLimits(l.value);
        if (c.status === "fulfilled") setCategories(c.value);
        if (f.status === "fulfilled") setFamilies(f.value);
        setLoading(false);
      },
    );
  };

  useEffect(load, []);

  useEffect(() => {
    if (!user || families.length === 0) {
      setOwnerFamilies([]);
      return;
    }
    Promise.all(
      families.map((f) =>
        getFamily(f.id)
          .then((full) => full)
          .catch(() => null),
      ),
    ).then((fullList) => {
      const owned = fullList.filter(
        (f): f is Family =>
          f != null &&
          f.members?.some(
            (m) =>
              String(m.userId) === String(user.id) && m.role === "OWNER",
          ),
      );
      setOwnerFamilies(owned);
    });
  }, [families, user]);

  const limitCategories = useMemo(() => {
    const isPersonal = form.limitKind === "PERSONAL";
    return categories.filter((c) => {
      if (c.type !== "EXPENSE") return false;
      if (isPersonal) return c.scope === "PERSONAL";
      if (form.familyId === NONE_FAMILY) return false;
      return (
        c.scope === "FAMILY" && String(c.familyId) === String(form.familyId)
      );
    });
  }, [categories, form.limitKind, form.familyId]);

  useEffect(() => {
    if (form.categoryId === CAT_NONE) return;
    const ok = limitCategories.some(
      (c) => String(c.id) === String(form.categoryId),
    );
    if (!ok) setForm((p) => ({ ...p, categoryId: CAT_NONE }));
  }, [limitCategories, form.categoryId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (l: BudgetLimit) => {
    setEditing(l);
    setForm({
      name: l.name,
      amount: toNum(l.amount),
      period: l.period,
      scope: l.scope,
      limitKind: l.limitScope,
      isBlocking: l.isBlocking,
      categoryId:
        l.categoryId != null ? String(l.categoryId) : CAT_NONE,
      familyId: l.familyId != null ? String(l.familyId) : NONE_FAMILY,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (
        form.scope === "CATEGORY" &&
        (!form.categoryId || form.categoryId === CAT_NONE)
      ) {
        toast.error("Выберите категорию");
        return;
      }
      if (form.limitKind === "FAMILY" && form.familyId === NONE_FAMILY) {
        toast.error("Выберите семью для семейного лимита");
        return;
      }

      const categoryIdNum =
        form.scope === "CATEGORY" && form.categoryId !== CAT_NONE
          ? Number(form.categoryId)
          : null;
      const familyIdResolved =
        form.limitKind === "FAMILY" && form.familyId !== NONE_FAMILY
          ? Number(form.familyId)
          : null;

      const payload = {
        name: form.name.trim(),
        amount: Number(form.amount),
        period: form.period,
        scope: form.scope,
        isBlocking: form.isBlocking,
        categoryId: form.scope === "CATEGORY" ? categoryIdNum : null,
        familyId: familyIdResolved,
      };

      if (!payload.name) {
        toast.error("Укажите название лимита");
        return;
      }

      if (editing) {
        await updateLimit(editing.id, {
          name: payload.name,
          amount: payload.amount,
          period: payload.period,
          scope: payload.scope,
          isBlocking: payload.isBlocking,
          categoryId: payload.categoryId,
        });
        toast.success("Лимит обновлён");
      } else {
        await createLimit({
          name: payload.name,
          amount: payload.amount,
          period: payload.period,
          scope: payload.scope,
          isBlocking: payload.isBlocking,
          categoryId: payload.categoryId ?? undefined,
          familyId: payload.familyId ?? undefined,
        });
        toast.success("Лимит создан");
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Удалить лимит?")) return;
    try {
      await deleteLimit(id);
      setLimits((prev) => prev.filter((l) => String(l.id) !== String(id)));
      toast.success("Лимит удалён");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Лимит
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Редактировать лимит" : "Новый лимит"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <div className="space-y-1.5">
                  <Label>Тип лимита</Label>
                  <Select
                    value={form.limitKind}
                    onValueChange={(v: "PERSONAL" | "FAMILY") =>
                      setForm((p) => ({
                        ...p,
                        limitKind: v,
                        familyId: NONE_FAMILY,
                        categoryId: CAT_NONE,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONAL">Личный</SelectItem>
                      <SelectItem value="FAMILY">Семейный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing && (
                <p className="text-xs text-muted-foreground">
                  Тип: {editing.limitScope === "PERSONAL" ? "личный" : "семейный"}
                  {editing.familyName ? ` · ${editing.familyName}` : ""}
                </p>
              )}
              {form.limitKind === "FAMILY" && !editing && (
                <div className="space-y-1.5">
                  <Label>Семья</Label>
                  <Select
                    value={form.familyId}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        familyId: v,
                        categoryId: CAT_NONE,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите семью" />
                    </SelectTrigger>
                    <SelectContent>
                      {ownerFamilies.length === 0 ? (
                        <SelectItem value={NONE_FAMILY} disabled>
                          Нет семей, где вы владелец
                        </SelectItem>
                      ) : (
                        ownerFamilies.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                  placeholder="Напр. Продукты на месяц"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Сумма (₽)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: +e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Период</Label>
                  <Select
                    value={form.period}
                    onValueChange={(v: "WEEKLY" | "MONTHLY") =>
                      setForm((p) => ({ ...p, period: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Неделя</SelectItem>
                      <SelectItem value="MONTHLY">Месяц</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Область</Label>
                  <Select
                    value={form.scope}
                    onValueChange={(v: "TOTAL" | "CATEGORY") =>
                      setForm((p) => ({ ...p, scope: v, categoryId: CAT_NONE }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOTAL">Общий</SelectItem>
                      <SelectItem value="CATEGORY">По категории</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.scope === "CATEGORY" && (
                  <div className="space-y-1.5">
                    <Label>Категория</Label>
                    <Select
                      value={
                        form.categoryId && form.categoryId !== CAT_NONE
                          ? form.categoryId
                          : CAT_NONE
                      }
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, categoryId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выбрать" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CAT_NONE}>Не выбрано</SelectItem>
                        {limitCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.isBlocking}
                  onCheckedChange={(v) =>
                    setForm((p) => ({ ...p, isBlocking: !!v }))
                  }
                />
                <span className="text-sm">Блокирующий лимит</span>
              </label>
              <Button type="submit" className="w-full">
                Сохранить
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {limits.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-full text-center py-8">
            Нет лимитов
          </p>
        ) : (
          limits.map((l) => {
            const limitAmount = toNum(l.amount);
            const used = l.usedAmount ?? 0;
            const remaining = l.remainingAmount ?? Math.max(limitAmount - used, 0);
            const percent = l.percentUsed ?? 0;
            const exceeded = l.isExceeded ?? false;
            const exceededBy = l.exceededBy ?? 0;
            const barWidth = Math.min(percent, 100);

            return (
              <Card
                key={l.id}
                className={cn(
                  "group",
                  exceeded && "border-destructive/40 bg-destructive/5",
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {l.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge
                          variant={
                            l.limitScope === "PERSONAL" ? "outline" : "default"
                          }
                          className="text-[10px]"
                        >
                          {l.limitScope === "PERSONAL" ? "Личный" : "Семейный"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {l.scope === "CATEGORY"
                            ? l.category?.name || "По категории"
                            : "Общий"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {l.period === "WEEKLY" ? "Неделя" : "Месяц"}
                        </Badge>
                        {l.limitScope === "FAMILY" &&
                          (l.familyName || l.family) && (
                            <Badge variant="secondary" className="text-[10px]">
                              {l.familyName ?? l.family?.name}
                            </Badge>
                          )}
                        {l.isBlocking ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <ShieldAlert className="h-3 w-3 mr-0.5" />
                            Блокирующий
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Предупреждающий
                          </Badge>
                        )}
                      </div>
                    </div>
                    {l.canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(l)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(l.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Лимит</span>
                      <span className="font-mono-nums font-medium">
                        {fmt(limitAmount)} ₽
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Потрачено</span>
                      <span className="font-mono-nums font-medium">
                        {fmt(used)} ₽
                      </span>
                    </div>
                    {exceeded ? (
                      <div className="flex justify-between gap-2 text-destructive">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Превышено на
                        </span>
                        <span className="font-mono-nums font-semibold">
                          {fmt(exceededBy)} ₽
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Осталось</span>
                        <span className="font-mono-nums font-medium text-income">
                          {fmt(remaining)} ₽
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>Использовано</span>
                      <span
                        className={cn(
                          "font-mono-nums font-medium",
                          exceeded && "text-destructive",
                        )}
                      >
                        {Math.round(percent)}%
                      </span>
                    </div>
                  </div>

                  <div className="budget-bar">
                    <div
                      className={
                        exceeded ? "budget-bar-fill-alert" : "budget-bar-fill"
                      }
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
