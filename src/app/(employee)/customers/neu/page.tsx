import { requireEmployee } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewCustomerForm } from "./NewCustomerForm";

export default async function NewCustomerPage() {
  await requireEmployee();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zur Übersicht
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Neuer Kunde</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Legen Sie einen neuen Kunden an, um ihm Nachrichten zu senden.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Kundendaten</CardTitle>
        </CardHeader>
        <CardContent>
          <NewCustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
