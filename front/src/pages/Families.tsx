import { useEffect, useState } from "react";
import {
  getFamilies,
  getFamily,
  createFamily,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  deleteFamily,
  getErrorMessage,
  type Family,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
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
import { Plus, UserPlus, Trash2, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MEMBER: "Участник",
  VIEWER: "Наблюдатель",
};

export default function FamiliesPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"MEMBER" | "VIEWER">("MEMBER");
  const [addingMember, setAddingMember] = useState(false);

  const load = () => {
    getFamilies().then(setFamilies).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const selectFamily = async (f: Family) => {
    try {
      const full = await getFamily(f.id);
      setSelectedFamily(full);
    } catch {
      setSelectedFamily(f);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFamily({ name: newName });
      toast.success("Семья создана");
      setCreateOpen(false);
      setNewName("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamily) return;
    setAddingMember(true);
    try {
      await addFamilyMember(selectedFamily.id, {
        email: memberEmail,
        role: memberRole,
      });
      toast.success("Участник добавлен");
      setMemberEmail("");
      selectFamily(selectedFamily);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRoleChange = async (
    memberId: string,
    role: "OWNER" | "MEMBER" | "VIEWER",
  ) => {
    if (!selectedFamily) return;
    try {
      await updateFamilyMember(selectedFamily.id, memberId, { role });
      toast.success("Роль обновлена");
      selectFamily(selectedFamily);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedFamily) return;
    try {
      await removeFamilyMember(selectedFamily.id, memberId);
      toast.success("Участник удалён");
      selectFamily(selectedFamily);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isOwner =
    !!selectedFamily?.members?.some(
      (m) => String(m.userId) === String(user?.id) && m.role === "OWNER",
    );

  const handleDeleteFamily = async () => {
    if (!selectedFamily) return;
    if (!confirm("Удалить семью?")) return;
    try {
      await deleteFamily(selectedFamily.id);
      toast.success("Семья удалена");
      setSelectedFamily(null);
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Создать семью</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Новая семья</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Моя семья" />
              </div>
              <Button type="submit" className="w-full">Создать</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Family list */}
        <div className="space-y-2 lg:col-span-1">
          {families.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Нет семей</p>
          ) : (
            families.map((f) => (
              <Card
                key={f.id}
                className={`cursor-pointer transition-colors ${selectedFamily?.id === f.id ? "border-primary" : "hover:bg-muted/30"}`}
                onClick={() => selectFamily(f)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm flex-1">{f.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Family detail */}
        <div className="lg:col-span-2">
          {selectedFamily ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base">{selectedFamily.name}</CardTitle>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFamily();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Удалить семью
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add member */}
                <form onSubmit={handleAddMember} className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Email участника"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="flex-1 min-w-[200px]"
                    required
                  />
                  <Select value={memberRole} onValueChange={setMemberRole}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Участник</SelectItem>
                      <SelectItem value="VIEWER">Наблюдатель</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" disabled={addingMember}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </form>

                {/* Members list */}
                <div className="space-y-1">
                  {(selectedFamily.members ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Нет участников
                    </p>
                  ) : (
                    selectedFamily.members!.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 py-2.5 border-b last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                          {(m.user?.name || m.user?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.user?.name || m.user?.email || "Пользователь"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.user?.email}
                          </p>
                        </div>
                        <Select
                          value={m.role}
                          onValueChange={(v) => handleRoleChange(m.id, v)}
                          disabled={m.role === "OWNER"}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OWNER">Владелец</SelectItem>
                            <SelectItem value="MEMBER">Участник</SelectItem>
                            <SelectItem value="VIEWER">Наблюдатель</SelectItem>
                          </SelectContent>
                        </Select>
                        {m.role !== "OWNER" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRemoveMember(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Выберите семью для просмотра
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
