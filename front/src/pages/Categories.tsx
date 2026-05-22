import { useEffect, useMemo, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getFamilies,
  getErrorMessage,
  type Category,
  type Family,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#78716c",
];

const ICONS = [
  "🛒", "🍽️", "🏠", "🚗", "💡", "❤️", "🎓",
  "✈️", "🎵", "💰", "📱", "🎮", "👕", "🎁",
];

const FAMILY_NONE = "__none__";

interface CategoryForm {
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
  icon: string;
  ownership: "PERSONAL" | "FAMILY";
  familyId: string;
}

const emptyForm: CategoryForm = {
  name: "",
  type: "EXPENSE",
  color: COLORS[0],
  icon: ICONS[0],
  ownership: "PERSONAL",
  familyId: FAMILY_NONE,
};

function CategoryCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Category;
  onEdit: (c: Category) => void;
  onDelete: (id: string | number) => void;
}) {
  return (
    <Card className="group">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: (c.color || "#6366f1") + "18" }}
        >
          {c.icon || "📁"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{c.name}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            <Badge variant="secondary" className="text-[10px]">
              {c.type === "INCOME" ? "Доход" : "Расход"}
            </Badge>
            <Badge
              variant={c.scope === "PERSONAL" ? "outline" : "default"}
              className="text-[10px]"
            >
              {c.scope === "PERSONAL" ? "Личная" : "Семейная"}
            </Badge>
            {c.scope === "FAMILY" && c.familyName && (
              <Badge variant="secondary" className="text-[10px]">
                {c.familyName}
              </Badge>
            )}
          </div>
        </div>
        {c.canManage && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(c)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDelete(c.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const load = () => {
    Promise.allSettled([getCategories(), getFamilies()]).then(([c, f]) => {
      if (c.status === "fulfilled") setCategories(c.value);
      if (f.status === "fulfilled") setFamilies(f.value);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const personal = useMemo(
    () => categories.filter((c) => c.scope === "PERSONAL"),
    [categories],
  );
  const family = useMemo(
    () => categories.filter((c) => c.scope === "FAMILY"),
    [categories],
  );

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name,
      type: c.type,
      color: c.color || COLORS[0],
      icon: c.icon || ICONS[0],
      ownership: c.scope,
      familyId:
        c.familyId != null ? String(c.familyId) : FAMILY_NONE,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.ownership === "FAMILY" && form.familyId === FAMILY_NONE) {
      toast.error("Выберите семью для семейной категории");
      return;
    }
    try {
      const payload = {
        name: form.name,
        type: form.type,
        color: form.color,
        icon: form.icon,
        familyId:
          form.ownership === "FAMILY" ? Number(form.familyId) : undefined,
      };
      if (editing) {
        await updateCategory(editing.id, {
          name: payload.name,
          type: payload.type,
          color: payload.color,
          icon: payload.icon,
        });
        toast.success("Категория обновлена");
      } else {
        await createCategory(payload);
        toast.success("Категория создана");
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Удалить категорию?")) return;
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
      toast.success("Категория удалена");
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
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Категория
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Редактировать" : "Новая категория"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <>
                  <div className="space-y-1.5">
                    <Label>Принадлежность</Label>
                    <Select
                      value={form.ownership}
                      onValueChange={(v: "PERSONAL" | "FAMILY") =>
                        setForm((p) => ({
                          ...p,
                          ownership: v,
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
                  {form.ownership === "FAMILY" && (
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
              {editing && (
                <p className="text-xs text-muted-foreground">
                  Тип принадлежности:{" "}
                  {editing.scope === "PERSONAL"
                    ? "личная"
                    : `семейная${editing.familyName ? ` · ${editing.familyName}` : ""}`}
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Тип</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: "INCOME" | "EXPENSE") =>
                    setForm((p) => ({ ...p, type: v }))
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
              <div className="space-y-1.5">
                <Label>Иконка</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, icon }))}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border-2 transition-colors ${form.icon === icon ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Цвет</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-primary scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full">
                Сохранить
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Личные категории</CardTitle>
          </CardHeader>
          <CardContent>
            {personal.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Нет личных категорий
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {personal.map((c) => (
                  <CategoryCard
                    key={c.id}
                    c={c}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Семейные категории</CardTitle>
          </CardHeader>
          <CardContent>
            {family.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Нет семейных категорий
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {family.map((c) => (
                  <CategoryCard
                    key={c.id}
                    c={c}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
