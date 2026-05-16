"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, FileText, X } from "lucide-react";
import {
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
} from "@/server/actions/message-templates";
import type { TemplateScope } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/compose/RichTextEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().min(1, "Name erforderlich"),
  subject: z.string().optional(),
  body: z.string().min(1, "Inhalt erforderlich"),
});
type FormData = z.infer<typeof schema>;

type Template = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  createdByName: string;
};

type Props = { templates: Template[]; scope: TemplateScope; ouId?: string };

export function TemplateManager({ templates: initial, scope, ouId }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletePending, startDelete] = useTransition();

  function handleDelete(id: string, name: string) {
    if (!confirm(`Vorlage „${name}" wirklich löschen?`)) return;
    startDelete(async () => {
      const result = await deleteMessageTemplate(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Vorlage gelöscht");
      }
    });
  }

  return (
    <div className="space-y-4">
      {templates.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <FileText className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Noch keine Vorlagen vorhanden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Erstellen Sie wiederverwendbare Texte für häufige Nachrichten.
          </p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Erste Vorlage erstellen
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Neue Vorlage
            </Button>
          </div>

          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <h3 className="font-semibold">{t.name}</h3>
                    </div>
                    {t.subject && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Betreff: <span className="font-medium text-foreground">{t.subject}</span>
                      </p>
                    )}
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {t.body.replace(/<[^>]+>/g, " ").trim()}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground/60">
                      Erstellt von {t.createdByName}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditingId(t.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={deletePending}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <TemplateDialog
        open={showCreate}
        scope={scope}
        ouId={ouId}
        onClose={() => setShowCreate(false)}
        onSaved={(t) => {
          setTemplates((prev) => [...prev, { ...t, createdByName: "Sie" }].sort((a, b) => a.name.localeCompare(b.name)));
          setShowCreate(false);
        }}
      />

      {/* Edit Dialog */}
      {editingId && (
        <TemplateDialog
          open={!!editingId}
          scope={scope}
          ouId={ouId}
          initialData={templates.find((t) => t.id === editingId)}
          editId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={(updated) => {
            setTemplates((prev) =>
              prev.map((t) => (t.id === editingId ? { ...t, name: updated.name, subject: updated.subject, body: updated.body } : t)),
            );
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  open,
  onClose,
  onSaved,
  initialData,
  editId,
  scope,
  ouId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (t: Omit<Template, "createdByName">) => void;
  initialData?: Template;
  editId?: string;
  scope: TemplateScope;
  ouId?: string;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name ?? "",
      subject: initialData?.subject ?? "",
      body: initialData?.body ?? "",
    },
  });

  const [body, setBody] = useState(initialData?.body ?? "");

  function handleBodyChange(value: string) {
    setBody(value);
    form.setValue("body", value, { shouldValidate: form.formState.isSubmitted });
  }

  async function onSubmit(data: FormData) {
    const payload = { name: data.name, subject: data.subject, body: data.body, scope, ouId };
    if (editId) {
      const result = await updateMessageTemplate(editId, payload);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Vorlage gespeichert");
      onSaved({ id: editId, name: data.name, subject: data.subject ?? null, body });
    } else {
      const result = await createMessageTemplate(payload);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Vorlage erstellt");
      onSaved({ id: result.id!, name: data.name, subject: data.subject ?? null, body });
      form.reset();
      setBody("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editId ? "Vorlage bearbeiten" : "Neue Vorlage"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name *</Label>
            <Input id="tpl-name" placeholder="z. B. Bauanfrage bestätigen" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Betreff (optional)</Label>
            <Input id="tpl-subject" placeholder="Betreff vorausfüllen…" {...form.register("subject")} />
          </div>
          <div className="space-y-1.5">
            <Label>Nachrichtentext *</Label>
            <RichTextEditor value={body} onChange={handleBodyChange} minHeight={200} />
            {!body.trim() && form.formState.isSubmitted && (
              <p className="text-xs text-destructive">Inhalt erforderlich</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
