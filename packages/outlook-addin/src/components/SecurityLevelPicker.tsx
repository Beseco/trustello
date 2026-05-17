import { RadioGroup, Radio, Label, Text } from "@fluentui/react-components";

export type SecurityLevel = "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";

const LEVELS: Array<{ value: SecurityLevel; label: string; description: string }> = [
  {
    value: "LEVEL_1",
    label: "Stufe 1 — Standard",
    description: "Text als normale E-Mail, Anhänge als Trustello-Links",
  },
  {
    value: "LEVEL_2",
    label: "Stufe 2 — Vertraulich",
    description: "Empfänger erhält nur Benachrichtigungs-E-Mail + Link, Text verschlüsselt",
  },
  {
    value: "LEVEL_3",
    label: "Stufe 3 — Passwortgeschützt",
    description: "Wie Stufe 2 + Passwortschutz, Passwort per SMS",
  },
  {
    value: "LEVEL_4",
    label: "Stufe 4 — Maximale Sicherheit",
    description: "Höchste Verschlüsselung + Trust-Level-Anforderung",
  },
];

type Props = {
  value: SecurityLevel;
  onChange: (level: SecurityLevel) => void;
};

export function SecurityLevelPicker({ value, onChange }: Props) {
  return (
    <div>
      <Label weight="semibold">Sicherheitsstufe</Label>
      <RadioGroup
        value={value}
        onChange={(_, d) => onChange(d.value as SecurityLevel)}
        style={{ marginTop: 4 }}
      >
        {LEVELS.map((l) => (
          <Radio
            key={l.value}
            value={l.value}
            label={
              <div>
                <Text weight={value === l.value ? "semibold" : "regular"}>{l.label}</Text>
                <br />
                <Text size={100} style={{ color: "#6b7280" }}>
                  {l.description}
                </Text>
              </div>
            }
          />
        ))}
      </RadioGroup>
    </div>
  );
}
