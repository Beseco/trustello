import { describe, it, expect } from "vitest";

// Test the CSV parser in isolation by extracting and testing the logic directly
function parseCSV(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const header = lines[0]!.split(";").map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const cols = line.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = cols[idx] ?? ""; });

    rows.push({
      firstName: obj["vorname"] ?? obj["firstname"] ?? obj["first_name"] ?? "",
      lastName: obj["nachname"] ?? obj["lastname"] ?? obj["last_name"] ?? obj["name"] ?? "",
      email: obj["email"] ?? obj["e-mail"] ?? "",
      salutation: obj["anrede"] ?? obj["salutation"] ?? undefined,
      mobilePhone: obj["mobil"] ?? obj["mobile"] ?? obj["telefon"] ?? obj["phone"] ?? undefined,
      street: obj["strasse"] ?? obj["straße"] ?? obj["street"] ?? undefined,
      zipCode: obj["plz"] ?? obj["zipcode"] ?? obj["zip_code"] ?? undefined,
      city: obj["ort"] ?? obj["stadt"] ?? obj["city"] ?? undefined,
    });
  }
  return rows;
}

describe("CSV Import Parser", () => {
  it("parst deutsche Spaltennamen korrekt", () => {
    const csv = "Anrede;Vorname;Nachname;Email;Mobil\nHerr;Max;Mustermann;max@test.de;0171234";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      firstName: "Max",
      lastName: "Mustermann",
      email: "max@test.de",
      salutation: "Herr",
      mobilePhone: "0171234",
    });
  });

  it("parst englische Spaltennamen korrekt", () => {
    const csv = "firstname;lastname;email\nJane;Doe;jane@example.com";
    const rows = parseCSV(csv);
    expect(rows[0]).toMatchObject({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" });
  });

  it("ignoriert leere Zeilen", () => {
    const csv = "Vorname;Nachname;Email\nMax;Muster;max@test.de\n\n";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
  });

  it("entfernt Anführungszeichen aus Zellen", () => {
    const csv = "Vorname;Nachname;Email\n\"Max\";\"Muster\";\"max@test.de\"";
    const rows = parseCSV(csv);
    expect(rows[0]?.firstName).toBe("Max");
    expect(rows[0]?.email).toBe("max@test.de");
  });

  it("gibt leeres Array zurück wenn keine Datenzeilen vorhanden", () => {
    const csv = "Vorname;Nachname;Email";
    expect(parseCSV(csv)).toHaveLength(0);
  });

  it("gibt leeres Array zurück wenn nur eine Zeile vorhanden", () => {
    expect(parseCSV("")).toHaveLength(0);
  });

  it("normalisiert Windows-Zeilenumbrüche", () => {
    const csv = "Vorname;Nachname;Email\r\nMax;Muster;max@test.de\r\n";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstName).toBe("Max");
  });

  it("parst mehrere Zeilen korrekt", () => {
    const csv = [
      "Vorname;Nachname;Email;PLZ;Ort",
      "Anna;Schmidt;anna@test.de;80331;München",
      "Peter;Müller;peter@test.de;10115;Berlin",
    ].join("\n");
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.zipCode).toBe("80331");
    expect(rows[1]?.city).toBe("Berlin");
  });
});
