"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateUserProfileAdmin } from "@/server/actions/admin-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, "Pflichtfeld"),
  lastName: z.string().min(1, "Pflichtfeld"),
  phone: z.string().optional(),
  position: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  userId: string;
  defaultValues: FormValues;
};

export function EditProfileForm({ userId, defaultValues }: Props) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const salutation = watch("salutation");

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await updateUserProfileAdmin(userId, values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profil gespeichert");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Anrede</Label>
          <Select value={salutation ?? ""} onValueChange={(v) => setValue("salutation", (v ?? "") || undefined)}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">—</SelectItem>
              <SelectItem value="Herr">Herr</SelectItem>
              <SelectItem value="Frau">Frau</SelectItem>
              <SelectItem value="Divers">Divers</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
        <Input
          id="position"
          placeholder="z. B. Sachbearbeiterin Baurecht"
          {...register("position")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefonnummer</Label>
        <Input id="phone" placeholder="z. B. +49 8161 12345" {...register("phone")} />
      </div>

      <Button type="submit" disabled={isPending} size="sm">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </form>
  );
}
