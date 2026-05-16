"use client";

import { useState, useTransition } from "react";
import { addCustomerNote, deleteCustomerNote } from "@/server/actions/customer-notes";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Note = {
  id: string;
  content: string;
  createdAt: Date;
  author: { firstName: string; lastName: string };
  isOwn: boolean;
};

type Props = {
  customerId: string;
  initialNotes: Note[];
};

export function CustomerNotes({ customerId, initialNotes }: Props) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!text.trim()) return;
    startTransition(async () => {
      const result = await addCustomerNote(customerId, text.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        setText("");
      }
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteCustomerNote(noteId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing notes */}
      {initialNotes.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Notizen vorhanden.</p>
      )}
      <ul className="space-y-2">
        {initialNotes.map((note) => (
          <li key={note.id} className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 whitespace-pre-wrap leading-relaxed">{note.content}</p>
              {note.isOwn && (
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={isPending}
                  className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {note.author.firstName} {note.author.lastName} ·{" "}
              {formatDistanceToNow(note.createdAt, { addSuffix: true, locale: de })}
            </p>
          </li>
        ))}
      </ul>

      {/* Add note */}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
          }}
          placeholder="Notiz hinzufügen… (Cmd+Enter zum Speichern)"
          rows={2}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !text.trim()}
          className="inline-flex items-center gap-1 self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
