import { useEffect, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getErrorMessage,
  type Category,
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<{ name: string; type: "INCOME" | "EXPENSE"; color: string; icon: string }>({ name: "", type: "EXPENSE", color: COLORS[0], icon: ICONS[0] });

  const load = () => {
    getCategories().then(setCategories).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, color: c.color || COLORS[0], icon: c.icon || ICONS[0] });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", type: "EXPENSE", color: COLORS[0], icon: ICONS[0] });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast.success("Категория обновлена");
      } else {
        await createCategory(form as Omit<Category, "id">);
        toast.success("Категория создана");
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
      toast.success("Категория удалена");
    } catch {
      toast.error("Не удалось удалить");
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
              <Plus className="h-4 w-4 mr-1" /> Категория
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editing ? "Редактировать" : "Новая категория"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Тип</Label>
                <Select value={form.type} onValueChange={(v: "INCOME" | "EXPENSE") => setForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Button type="submit" className="w-full">Сохранить</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-full text-center py-8">
            Нет категорий
          </p>
        ) : (
          categories.map((c) => (
            <Card key={c.id} className="group">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: (c.color || "#6366f1") + "18" }}
                >
                  {c.icon || "📁"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">
                    {c.type === "INCOME" ? "Доход" : "Расход"}
                  </Badge>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
