import { useState, useCallback } from "react";
import { Input, Spinner, Text, Button } from "@fluentui/react-components";
import { Person20Regular, Warning20Regular } from "@fluentui/react-icons";
import type { CustomerResult } from "@/api/trustello";

type Props = {
  client: import("@/api/trustello").TrustelloClient;
  selected: CustomerResult | null;
  onSelect: (customer: CustomerResult | null) => void;
  prefilledEmail?: string;
};

export function RecipientSearch({ client, selected, onSelect, prefilledEmail }: Props) {
  const [query, setQuery] = useState(prefilledEmail ?? "");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) return;
      setSearching(true);
      try {
        const res = await client.searchCustomers(q.trim());
        setResults(res);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    },
    [client],
  );

  if (selected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Person20Regular />
        <div style={{ flex: 1 }}>
          <Text weight="semibold">
            {selected.firstName} {selected.lastName}
          </Text>
          <br />
          <Text size={200}>{selected.email}</Text>
        </div>
        <Button size="small" onClick={() => onSelect(null)}>
          Ändern
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          style={{ flex: 1 }}
          placeholder="Name oder E-Mail suchen..."
          value={query}
          onChange={(_, d) => setQuery(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search(query);
          }}
        />
        <Button onClick={() => void search(query)} disabled={searching}>
          {searching ? <Spinner size="tiny" /> : "Suchen"}
        </Button>
      </div>

      {searched && results.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Warning20Regular color="#d97706" />
          <Text size={200}>Kein Tresor-Konto gefunden — Bürger kann noch nicht verifiziert werden.</Text>
        </div>
      )}

      {results.map((r) => (
        <Button
          key={r.id}
          appearance="subtle"
          style={{ justifyContent: "flex-start", height: "auto", padding: "8px 12px" }}
          onClick={() => onSelect(r)}
        >
          <div style={{ textAlign: "left" }}>
            <Text weight="semibold">
              {r.firstName} {r.lastName}
            </Text>
            <br />
            <Text size={200}>{r.email}</Text>
          </div>
        </Button>
      ))}
    </div>
  );
}
