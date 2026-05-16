/**
 * DEV-ONLY: Vorschau des PIN-Brief-PDFs mit Beispieldaten.
 * Nur in development verfügbar.
 */

import { NextResponse } from "next/server";
import { generatePinLetterPdf } from "@/lib/letter/pdf";
import { addDays } from "date-fns";
import qrcode from "qrcode";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const qrUrl = "https://app.trustello.de/pin-verify?token=preview-demo-token";
  const qrCodeDataUrl = await qrcode.toDataURL(qrUrl, { width: 300, margin: 2 });

  const pdfBuffer = await generatePinLetterPdf({
    recipientName: "Max Mustermann",
    recipientStreet: "Musterstraße 42",
    recipientZip: "85354",
    recipientCity: "Freising",
    tenantName: "Stadt Freising",
    tenantStreet: "Marienplatz 1",
    tenantZip: "85354",
    tenantCity: "Freising",
    primaryColor: "#1e3a8a",
    pin: "482917",
    qrCodeDataUrl,
    verifyUrl: "https://app.trustello.de/pin-verify/manual",
    expiresAt: addDays(new Date(), 30),
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pin-brief-vorschau.pdf"',
    },
  });
}
