"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignUserToOU, removeUserFromOU } from "@/server/actions/admin-users";
import { X, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Assignment = { ouId: string; ouName: string; role: "MEMBER" | "ADMIN" };
type OUOption = { id: string; name: string; parentId: string | null };

type Props = {
  userId: string;
  assignments: Assignment[];
  availableOUs: OUOption[];
};

export function OUManager({ userId, assignments: initial, availableOUs: initialAvailable }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>(initial);
  const [available, setAvailable] = useState<OUOption[]>(initialAvailable);
  const [selectedOUId, setSelectedOUId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!selectedOUId) return;
    const ou = available.find((o) => o.id === selectedOUId);
    if (!ou) return;

    startTransition(async () => {
      const result = await assignUserToOU(userId, selectedOUId, selectedRole);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAssignments((prev) => [
          ...prev,
          { ouId: ou.id, ouName: ou.name, role: selectedRole },
        ]);
        setAvailable((prev) => prev.filter((o) => o.id !== selectedOUId));
        setSelectedOUId("");
        setShowAdd(false);
        toast.success(`Zugewiesen zu ${ou.name}`);
      }
    });
  }

  function handleRemove(ouId: string, ouName: string) {
    startTransition(async () => {
      const result = await removeUserFromOU(userId, ouId);
      if (result.error) {
        toast.error(result.error);
      } else {
        const removed = assignments.find((a) => a.ouId === ouId);
        setAssignments((prev) => prev.filter((a) => a.ouId !== ouId));
        if (removed) {
          setAvailable((prev) =>
            [...prev, { id: ouId, name: ouName, parentId: null }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
        }
        toast.success(`Aus ${ouName} entfernt`);
      }
    });
  }

  function handleRoleChange(ouId: string, newRole: "MEMBER" | "ADMIN") {
    startTransition(async () => {
      const result = await assignUserToOU(userId, ouId, newRole);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAssignments((prev) =>
          prev.map((a) => (a.ouId === ouId ? { ...a, role: newRole } : a)),
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      {assignments.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          Noch keiner Organisationseinheit zugewiesen.
        </div>
      )}

      {assignments.map((a) => (
        <div
          key={a.ouId}
          className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">{a.ouName}</span>
          <Select
            value={a.role}
            onValueChange={(v) => handleRoleChange(a.ouId, v as "MEMBER" | "ADMIN")}
            disabled={pending}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">Mitglied</SelectItem>
              <SelectItem value="ADMIN">OU-Admin</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => handleRemove(a.ouId, a.ouName)}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
          <Select value={selectedOUId} onValueChange={(v) => setSelectedOUId(v ?? "")} disabled={pending}>
            <SelectTrigger className="flex-1 text-sm">
              <SelectValue placeholder="Einheit auswählen…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((ou) => (
                <SelectItem key={ou.id} value={ou.id}>
                  {ou.parentId && <span className="text-muted-foreground">↳ </span>}
                  {ou.name}
                </SelectItem>
              ))}
              {available.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Alle Einheiten bereits zugewiesen
                </div>
              )}
            </SelectContent>
          </Select>
          <Select
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as "MEMBER" | "ADMIN")}
            disabled={pending}
          >
            <SelectTrigger className="w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">Mitglied</SelectItem>
              <SelectItem value="ADMIN">OU-Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!selectedOUId || pending}
          >
            Hinzufügen
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdd(false)}
          >
            Abbrechen
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Organisationseinheit hinzufügen
        </button>
      )}
    </div>
  );
}
