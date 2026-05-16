"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeCitizenPassword } from "@/server/actions/citizen-account";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [showNew, setShowNew] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await changeCitizenPassword(data);
      setResult(r);
      if (r.ok) (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className="mt-1" required />
      </div>
      <div>
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <div className="relative mt-1">
          <Input id="newPassword" name="newPassword" type={showNew ? "text" : "password"} autoComplete="new-password" placeholder="Mind. 10 Zeichen" required />
          <button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Mind. 10 Zeichen · 1 Großbuchstabe · 1 Ziffer · 1 Sonderzeichen</p>
      </div>
      <div>
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className="mt-1" required />
      </div>
      {result && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {result.ok ? "Passwort erfolgreich geändert." : result.error}
        </div>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Passwort ändern
      </Button>
    </form>
  );
}
