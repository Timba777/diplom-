import { useEffect, useState } from "react";
import {
  getOperations,
  createOperation,
  deleteOperation,
  getCategories,
  getFamilies,
  ApiError,
  getErrorMessage,
  type Operation,
  type Category,
  type Family,
  type CreateOperationPayload,
  type CreateOperationResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NONE_CATEGORY = "__none_cat__";
const PERSONAL_FAMILY = "__personal__";

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

function limitDetailFromData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.currentSpent === "string" || typeof d.currentSpent === "number")
    parts.push(`Уже потрачено: ${fmt(toNum(d.currentSpent as string | number))} ₽`);
  if (typeof d.allowedRemaining === "string" || typeof d.allowedRemaining === "number")
    parts.push(`Остаток по лимиту: ${fmt(toNum(d.allowedRemaining as string | number))} ₽`);
  if (typeof d.attemptedAmount === "string" || typeof d.attemptedAmount === "number")
    parts.push(`Сумма операции: ${fmt(toNum(d.attemptedAmount as string | number))} ₽`);
  return parts.length ? `\n${parts.join(". ")}` : "";
}

export default function OperationsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState<CreateOperationPayload>({
    amount: 0,
    type: "EXPENSE",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    categoryId: NONE_CATEGORY,
    planned: true,
    familyId: PERSONAL_FAMILY,
    force: false,
  });
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    Promise.allSettled([getOperations(), getCategories(), getFamilies()]).then(
      ([o, c, f]) => {
        if (o.status === "fulfilled") setOperations(o.value);
        if (c.status === "fulfilled") setCategories(c.value);
        if (f.status === "fulfilled") setFamilies(f.value);
        setLoading(false);
      },
    );
  };

  useEffect(loadData, []);

  const handleDeleteOperation = async (id: string | number) => {
    if (!confirm("Удалить операцию?")) return;
    try {
      await deleteOperation(id);
      toast.success("Операция удалена");
      loadData();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    }
  };

  const filtered =
    filterType === "ALL"
      ? operations
      : operations.filter((o) => o.type === filterType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormWarning("");
    setSubmitting(true);
    try {
      const categoryId =
        form.categoryId && form.categoryId !== NONE_CATEGORY
          ? form.categoryId
          : undefined;
      const familyId =
        form.familyId && form.familyId !== PERSONAL_FAMILY
          ? form.familyId
          : undefined;

      const payload: CreateOperationPayload = {
        ...form,
        amount: Number(form.amount),
        categoryId,
        familyId,
        force: !!form.force,
      };

      const res: CreateOperationResponse = await createOperation(payload);

      if (res.blockedByLimit && !form.force) {
        setFormWarning(
          (res.warning ||
            "Операция заблокирована лимитом. Отметьте «Подтвердить несмотря на лимит» и повторите отправку.") +
            limitDetailFromData(res),
        );
        setSubmitting(false);
        return;
      }
      if (res.limitExceeded) {
        toast.warning(res.warning || "Превышение лимита");
      } else if (res.warning) {
        toast.warning(res.warning);
      }
      if (res.unplannedPurchase) {
        toast.info("Незапланированная покупка зафиксирована");
      }

      setDialogOpen(false);
      setForm({
        amount: 0,
        type: "EXPENSE",
        description: "",
        date: new Date().toISOString().slice(0, 10),
        categoryId: NONE_CATEGORY,
        planned: true,
        familyId: PERSONAL_FAMILY,
        force: false,
      });
      loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const base = err.message || "Лимит не позволяет выполнить операцию";
        setFormWarning(
          base +
            (form.force ? "" : " Отметьте «Подтвердить несмотря на лимит», если хотите принудительно провести операцию.") +
            limitDetailFromData(err.data),
        );
        if (form.force) {
          setFormError(
            "Принудительное проведение отклонено сервером. Проверьте настройки лимитов.",
          );
        }
      } else {
        setFormError(getErrorMessage(err, "Ошибка создания операции"));
      }
    } finally {
      setSubmitting(false);
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все</SelectItem>
              <SelectItem value="INCOME">Доходы</SelectItem>
              <SelectItem value="EXPENSE">Расходы</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Новая операция</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 whitespace-pre-line">
                  {formError}
                </div>
              )}
              {formWarning && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg p-3 flex items-start gap-2 whitespace-pre-line">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{formWarning}</p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <Checkbox
                        checked={!!form.force}
                        onCheckedChange={(v) =>
                          setForm((p) => ({ ...p, force: !!v }))
                        }
                      />
                      <span className="text-xs font-medium">
                        Подтвердить несмотря на лимит (force)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Сумма</Label>
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
                  <Label>Тип</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v: "INCOME" | "EXPENSE") =>
                      setForm((p) => ({
                        ...p,
                        type: v,
                        categoryId: NONE_CATEGORY,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Доход</SelectItem>
                      <SelectItem value="EXPENSE">Расход</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Описание</Label>
                <Input
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Дата</Label>
                  <Input
                    type="date"
                    value={form.date ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, date: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Категория</Label>
                  <Select
                    value={
                      form.categoryId === "" || form.categoryId === undefined
                        ? NONE_CATEGORY
                        : String(form.categoryId)
                    }
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, categoryId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_CATEGORY}>Не выбрана</SelectItem>
                      {categories
                        .filter((c) => c.type === form.type)
                        .map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Семья</Label>
                  <Select
                    value={
                      !form.familyId || form.familyId === ""
                        ? PERSONAL_FAMILY
                        : String(form.familyId)
                    }
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, familyId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Личная" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PERSONAL_FAMILY}>Личная</SelectItem>
                      {families.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!!form.planned}
                      onCheckedChange={(v) =>
                        setForm((p) => ({ ...p, planned: !!v }))
                      }
                    />
                    <span className="text-sm">Запланирована</span>
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Сохранение..." : "Сохранить"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Дата
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Описание
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Категория
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Тип
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Сумма
                  </th>
                  <th className="text-center p-3 font-medium text-muted-foreground">
                    Стат.
                  </th>
                  <th className="p-3 w-[52px]" aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Нет операций
                    </td>
                  </tr>
                ) : (
                  filtered.map((op) => (
                    <tr
                      key={op.id}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3 font-mono-nums text-xs whitespace-nowrap">
                        {new Date(op.date).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        {op.description || "—"}
                      </td>
                      <td className="p-3">
                        {op.category ? (
                          <Badge variant="secondary" className="text-xs">
                            {op.category.name}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            op.type === "INCOME" ? "default" : "outline"
                          }
                          className="text-xs"
                        >
                          {op.type === "INCOME" ? "Доход" : "Расход"}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "p-3 text-right font-mono-nums font-medium whitespace-nowrap",
                          op.type === "INCOME" ? "text-income" : "",
                        )}
                      >
                        {op.type === "INCOME" ? "+" : "−"}
                        {fmt(toNum(op.amount))} ₽
                      </td>
                      <td className="p-3 text-center">
                        {!op.planned && (
                          <AlertTriangle className="h-3.5 w-3.5 text-alert inline" />
                        )}
                        {op.familyId && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] ml-1"
                          >
                            Семья
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteOperation(op.id)}
                          aria-label="Удалить операцию"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
