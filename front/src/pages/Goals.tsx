import { useEffect, useMemo, useState } from "react";
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addGoalContribution,
  getFamilies,
  getErrorMessage,
  type FinancialGoal,
  type Family,
  type GoalStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Plus,
  Pencil,
  Trash2,
  Target,
  PiggyBank,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FAMILY_NONE = "__none__";

function fmt(n: number) {
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const STATUS_LABELS: Record<GoalStatus, string> = {
  ACTIVE: "Активна",
  COMPLETED: "Выполнена",
  PAUSED: "На паузе",
};

interface GoalForm {
  title: string;
  description: string;
  targetAmount: number;
  deadline: string;
  goalKind: "PERSONAL" | "FAMILY";
  familyId: string;
  status: GoalStatus;
}

const emptyGoalForm: GoalForm = {
  title: "",
  description: "",
  targetAmount: 0,
  deadline: "",
  goalKind: "PERSONAL",
  familyId: FAMILY_NONE,
  status: "ACTIVE",
};

interface ContributeForm {
  amount: number;
  type: "ADD" | "REMOVE";
  comment: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PERSONAL" | "FAMILY">("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);

  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [contributing, setContributing] = useState<FinancialGoal | null>(null);
  const [form, setForm] = useState<GoalForm>(emptyGoalForm);
  const [contribForm, setContribForm] = useState<ContributeForm>({
    amount: 0,
    type: "ADD",
    comment: "",
  });

  const load = () => {
    Promise.allSettled([getGoals(), getFamilies()]).then(([g, f]) => {
      if (g.status === "fulfilled") setGoals(g.value);
      if (f.status === "fulfilled") setFamilies(f.value);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return goals;
    return goals.filter((g) => g.scope === filter);
  }, [goals, filter]);

  const openCreate = () => {
    setForm(emptyGoalForm);
    setCreateOpen(true);
  };

  const openEdit = (g: FinancialGoal) => {
    setEditing(g);
    setForm({
      title: g.title,
      description: g.description ?? "",
      targetAmount: g.targetAmount,
      deadline: g.deadline ? g.deadline.slice(0, 10) : "",
      goalKind: g.scope,
      familyId: g.familyId != null ? String(g.familyId) : FAMILY_NONE,
      status: g.status,
    });
    setEditOpen(true);
  };

  const openContribute = (g: FinancialGoal) => {
    setContributing(g);
    setContribForm({ amount: 0, type: "ADD", comment: "" });
    setContributeOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.goalKind === "FAMILY" && form.familyId === FAMILY_NONE) {
      toast.error("Выберите семью");
      return;
    }
    try {
      await createGoal({
        title: form.title.trim(),
        description: form.description || undefined,
        targetAmount: Number(form.targetAmount),
        deadline: form.deadline || null,
        familyId:
          form.goalKind === "FAMILY" ? Number(form.familyId) : undefined,
      });
      toast.success("Цель создана");
      setCreateOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateGoal(editing.id, {
        title: form.title.trim(),
        description: form.description || null,
        targetAmount: Number(form.targetAmount),
        deadline: form.deadline || null,
        status: form.status,
      });
      toast.success("Цель обновлена");
      setEditOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (g: FinancialGoal) => {
    if (!confirm(`Удалить цель «${g.title}»?`)) return;
    try {
      await deleteGoal(g.id);
      toast.success("Цель удалена");
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributing) return;
    try {
      await addGoalContribution(contributing.id, {
        amount: Number(contribForm.amount),
        type: contribForm.type,
        comment: contribForm.comment || undefined,
      });
      toast.success(
        contribForm.type === "ADD" ? "Сумма добавлена" : "Сумма списана",
      );
      setContributeOpen(false);
      load();
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

  const goalFormFields = (isEdit: boolean) => (
    <>
      {!isEdit && (
        <>
          <div className="space-y-1.5">
            <Label>Тип цели</Label>
            <Select
              value={form.goalKind}
              onValueChange={(v: "PERSONAL" | "FAMILY") =>
                setForm((p) => ({
                  ...p,
                  goalKind: v,
                  familyId: FAMILY_NONE,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSONAL">Личная</SelectItem>
                <SelectItem value="FAMILY">Семейная</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.goalKind === "FAMILY" && (
            <div className="space-y-1.5">
              <Label>Семья</Label>
              <Select
                value={form.familyId}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, familyId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите семью" />
                </SelectTrigger>
                <SelectContent>
                  {families.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
      <div className="space-y-1.5">
        <Label>Название</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Описание</Label>
        <Textarea
          value={form.description}
          onChange={(e) =>
            setForm((p) => ({ ...p, description: e.target.value }))
          }
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Целевая сумма (₽)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.targetAmount || ""}
            onChange={(e) =>
              setForm((p) => ({ ...p, targetAmount: +e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Дедлайн</Label>
          <Input
            type="date"
            value={form.deadline}
            onChange={(e) =>
              setForm((p) => ({ ...p, deadline: e.target.value }))
            }
          />
        </div>
      </div>
      {isEdit && (
        <div className="space-y-1.5">
          <Label>Статус</Label>
          <Select
            value={form.status}
            onValueChange={(v: GoalStatus) =>
              setForm((p) => ({ ...p, status: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Активна</SelectItem>
              <SelectItem value="COMPLETED">Выполнена</SelectItem>
              <SelectItem value="PAUSED">На паузе</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={filter}
          onValueChange={(v: "ALL" | "PERSONAL" | "FAMILY") => setFilter(v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все цели</SelectItem>
            <SelectItem value="PERSONAL">Личные</SelectItem>
            <SelectItem value="FAMILY">Семейные</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Добавить цель
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Новая финансовая цель</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {goalFormFields(false)}
              <Button type="submit" className="w-full">
                Создать
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать цель</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {goalFormFields(true)}
            <Button type="submit" className="w-full">
              Сохранить
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Пополнить: {contributing?.title}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContribute} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Сумма (₽)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={contribForm.amount || ""}
                onChange={(e) =>
                  setContribForm((p) => ({
                    ...p,
                    amount: +e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Тип</Label>
              <Select
                value={contribForm.type}
                onValueChange={(v: "ADD" | "REMOVE") =>
                  setContribForm((p) => ({ ...p, type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD">Пополнение</SelectItem>
                  <SelectItem value="REMOVE">Списание</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Input
                value={contribForm.comment}
                onChange={(e) =>
                  setContribForm((p) => ({ ...p, comment: e.target.value }))
                }
              />
            </div>
            <Button type="submit" className="w-full">
              Применить
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-full text-center py-8">
            Нет целей
          </p>
        ) : (
          filtered.map((g) => {
            const barWidth = Math.min(g.progressPercent, 100);
            const completed = g.isCompleted || g.status === "COMPLETED";

            return (
              <Card
                key={g.id}
                className={cn(
                  "group flex flex-col",
                  completed && "border-income/40 bg-income/5",
                )}
              >
                <CardContent className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {g.title}
                        </span>
                      </div>
                      {g.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {g.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Badge
                          variant={
                            g.scope === "PERSONAL" ? "outline" : "default"
                          }
                          className="text-[10px]"
                        >
                          {g.scope === "PERSONAL" ? "Личная" : "Семейная"}
                        </Badge>
                        {g.scope === "FAMILY" && g.familyName && (
                          <Badge variant="secondary" className="text-[10px]">
                            {g.familyName}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {STATUS_LABELS[g.status]}
                        </Badge>
                      </div>
                    </div>
                    {g.canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(g)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(g)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-sm flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Цель</span>
                      <span className="font-mono-nums font-medium">
                        {fmt(g.targetAmount)} ₽
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Накоплено</span>
                      <span className="font-mono-nums font-medium text-income">
                        {fmt(g.currentAmount)} ₽
                      </span>
                    </div>
                    {!completed && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Осталось</span>
                        <span className="font-mono-nums font-medium">
                          {fmt(g.remainingAmount)} ₽
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Использовано</span>
                      <span className="font-mono-nums font-medium">
                        {Math.round(g.progressPercent)}%
                      </span>
                    </div>
                    {g.deadline && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Дедлайн:{" "}
                        {new Date(g.deadline).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>

                  <div className="budget-bar">
                    <div
                      className={
                        completed ? "budget-bar-fill" : "budget-bar-fill"
                      }
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {g.canContribute && g.status !== "PAUSED" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full mt-auto"
                      onClick={() => openContribute(g)}
                    >
                      <PiggyBank className="h-4 w-4 mr-1" />
                      Пополнить
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
