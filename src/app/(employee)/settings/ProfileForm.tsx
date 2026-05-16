"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateProfile } from "@/server/actions/profile";
import { RichTextPreview } from "@/components/RichTextPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  firstName: z.string().min(1, "Pflichtfeld"),
  lastName: z.string().min(1, "Pflichtfeld"),
  phone: z.string().optional(),
  position: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  defaultValues: FormValues;
  signaturePreview: string | null;
};

export function ProfileForm({ defaultValues, signaturePreview }: Props) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState(signaturePreview);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profil gespeichert");
        // Reload to refresh signature preview
        window.location.reload();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Vorname</Label>
          <Input id="firstName" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Nachname</Label>
          <Input id="lastName" {...register("lastName")} />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="position">Position / Funktion</Label>
        <Input id="position" placeholder="z. B. Sachbearbeiterin Baurecht" {...register("position")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefonnummer</Label>
        <Input id="phone" placeholder="z. B. +49 8161 12345" {...register("phone")} />
      </div>

      {preview !== null && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Signatur-Vorschau
          </p>
          <RichTextPreview
            html={`<p>${preview.replace(/\n/g, "<br>")}</p>`}
          />
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </form>
  );
}
