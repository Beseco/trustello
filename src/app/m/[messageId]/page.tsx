type PageProps = {
  params: Promise<{ messageId: string }>;
};

export default async function CitizenMessagePage({ params }: PageProps) {
  const { messageId } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-8 text-card-foreground shadow">
        <h1 className="text-xl font-semibold">Sichere Nachricht</h1>
        <p className="text-sm text-muted-foreground">
          Nachrichten-ID: <code className="font-mono text-xs">{messageId}</code>
        </p>
        <p className="text-sm text-muted-foreground">
          Das Bürger-Portal mit Nachrichten-Abruf wird in Phase 2 implementiert.
        </p>
      </div>
    </div>
  );
}
