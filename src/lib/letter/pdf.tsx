/**
 * PIN-Brief PDF-Generierung
 * Verwendet @react-pdf/renderer für professionelles DIN-A4-Layout.
 * Muss serverseitig ausgeführt werden (Node.js).
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

export type PinLetterProps = {
  recipientName: string;
  recipientStreet: string;
  recipientZip: string;
  recipientCity: string;
  tenantName: string;
  tenantLogoDataUrl?: string;
  tenantStreet?: string;
  tenantZip?: string;
  tenantCity?: string;
  primaryColor?: string;
  pin: string;
  qrCodeDataUrl: string;
  verifyUrl: string;
  expiresAt: Date;
};

function formatPin(pin: string): string {
  return pin.slice(0, 3) + "  " + pin.slice(3);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const FONT_COLOR = "#1a1a2e";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

function createStyles(color: string) {
  return StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      fontSize: 9.5,
      color: FONT_COLOR,
      paddingTop: 40,
      paddingBottom: 48,
      paddingLeft: 58,
      paddingRight: 58,
      lineHeight: 1.4,
    },
    // ── Header ────────────────────────────────────────────────────────────────
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
    },
    logo: { width: 100, height: 32, objectFit: "contain" },
    logoPlaceholder: {
      width: 100,
      height: 32,
      backgroundColor: color,
      borderRadius: 3,
      justifyContent: "center",
      alignItems: "center",
    },
    logoPlaceholderText: { color: "#fff", fontSize: 13, fontFamily: "Helvetica-Bold" },
    senderBlock: { textAlign: "right", color: MUTED, fontSize: 8.5 },
    senderName: { fontFamily: "Helvetica-Bold", color: FONT_COLOR, fontSize: 9.5, marginBottom: 1 },
    // ── Empfänger ─────────────────────────────────────────────────────────────
    recipientBlock: { marginBottom: 18 },
    returnAddress: {
      fontSize: 6.5,
      color: MUTED,
      marginBottom: 5,
      borderBottomWidth: 0.5,
      borderBottomColor: BORDER,
      paddingBottom: 3,
    },
    recipientName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 1 },
    // ── Datum & Betreff ───────────────────────────────────────────────────────
    date: { textAlign: "right", color: MUTED, fontSize: 8.5, marginBottom: 16 },
    subject: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 57, marginBottom: 12, color: FONT_COLOR },
    // ── Fließtext ─────────────────────────────────────────────────────────────
    para: { marginBottom: 8, fontSize: 9.5 },
    // ── PIN-Box ───────────────────────────────────────────────────────────────
    pinBox: {
      borderRadius: 6,
      backgroundColor: "#f8fafc",
      borderWidth: 1.5,
      borderColor: color,
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: 16,
      paddingRight: 16,
      marginTop: 4,
      marginBottom: 14,
      alignItems: "center",
    },
    pinLabel: {
      fontSize: 7.5,
      color: MUTED,
      marginBottom: 5,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    pinValue: {
      fontFamily: "Helvetica-Bold",
      fontSize: 32,
      color: color,
    },
    pinExpiryRow: {
      marginTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: BORDER,
      paddingTop: 6,
      alignItems: "center",
    },
    pinExpiry: {
      fontSize: 8,
      color: MUTED,
    },
    // ── QR-Bereich ────────────────────────────────────────────────────────────
    qrSection: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
      backgroundColor: "#f9fafb",
      borderRadius: 5,
      padding: 12,
    },
    qrCode: { width: 78, height: 78, marginRight: 14 },
    qrTextBlock: { flex: 1 },
    qrTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 },
    qrText: { fontSize: 8.5, color: MUTED, marginBottom: 3 },
    qrUrl: { fontSize: 7.5, color: color, fontFamily: "Helvetica-Bold" },
    // ── Sicherheitshinweis ────────────────────────────────────────────────────
    warning: {
      backgroundColor: "#fffbeb",
      borderRadius: 4,
      paddingTop: 7,
      paddingBottom: 7,
      paddingLeft: 10,
      paddingRight: 10,
      borderLeftWidth: 3,
      borderLeftColor: "#f59e0b",
      marginBottom: 14,
    },
    warningText: { fontSize: 8.5, color: "#92400e" },
    // ── Grußformel ────────────────────────────────────────────────────────────
    footer: { marginTop: 4 },
    footerText: { fontSize: 9.5, marginBottom: 2 },
    footerName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    // ── Farbbalken ────────────────────────────────────────────────────────────
    bottomBar: {
      position: "absolute",
      bottom: 22,
      left: 58,
      right: 58,
      height: 2.5,
      backgroundColor: color,
      borderRadius: 2,
    },
  });
}

function PinLetterDocument(props: PinLetterProps) {
  const color = props.primaryColor ?? "#1e3a8a";
  const styles = createStyles(color);

  const senderLine = [
    props.tenantStreet,
    [props.tenantZip, props.tenantCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document
      title={`Zugangscode – ${props.tenantName}`}
      author={props.tenantName}
      creator="Trustello"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {props.tenantLogoDataUrl ? (
            <Image style={styles.logo} src={props.tenantLogoDataUrl} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>
                {props.tenantName.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.senderBlock}>
            <Text style={styles.senderName}>{props.tenantName}</Text>
            {senderLine ? <Text>{senderLine}</Text> : null}
          </View>
        </View>

        {/* Datum */}
        <Text style={styles.date}>{formatDate(new Date())}</Text>

        {/* Empfänger */}
        <View style={styles.recipientBlock}>
          <Text style={styles.returnAddress}>
            {props.tenantName}
            {senderLine ? ` · ${senderLine}` : ""}
          </Text>
          <Text style={styles.recipientName}>{props.recipientName}</Text>
          <Text>{props.recipientStreet}</Text>
          <Text>
            {props.recipientZip} {props.recipientCity}
          </Text>
        </View>

        {/* Betreff */}
        <Text style={styles.subject}>Ihr persönlicher Zugangscode</Text>

        {/* Anschreiben */}
        <Text style={styles.para}>Sehr geehrte/r {props.recipientName},</Text>
        <Text style={styles.para}>
          hiermit erhalten Sie Ihren Zugangscode für Ihr sicheres Bürger-Konto bei{" "}
          {props.tenantName}. Geben Sie diesen Code unter der unten genannten Adresse ein,
          um Ihre Identität zu bestätigen — oder scannen Sie einfach den QR-Code.
        </Text>

        {/* PIN-Box */}
        <View style={styles.pinBox}>
          <Text style={styles.pinLabel}>Ihr Zugangscode</Text>
          <Text style={styles.pinValue}>{formatPin(props.pin)}</Text>
          <View style={styles.pinExpiryRow}>
            <Text style={styles.pinExpiry}>Gültig bis: {formatDate(props.expiresAt)}</Text>
          </View>
        </View>

        {/* QR + URL */}
        <View style={styles.qrSection}>
          <Image style={styles.qrCode} src={props.qrCodeDataUrl} />
          <View style={styles.qrTextBlock}>
            <Text style={styles.qrTitle}>QR-Code scannen — schnellster Weg</Text>
            <Text style={styles.qrText}>
              Scannen Sie den QR-Code mit Ihrem Smartphone. Ihr Konto wird sofort
              verifiziert, ohne Code-Eingabe.
            </Text>
            <Text style={styles.qrText}>
              Oder öffnen Sie manuell:
            </Text>
            <Text style={styles.qrUrl}>{props.verifyUrl}</Text>
            <Text style={[styles.qrText, { marginTop: 6 }]}>
              {"1.  "}Seite öffnen{"   "}
              {"2.  "}E-Mail + Code eingeben{"   "}
              {"3.  "}Konto ist verifiziert ✓
            </Text>
          </View>
        </View>

        {/* Sicherheitshinweis */}
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠  Dieses Schreiben sicher aufbewahren. Den Zugangscode niemals telefonisch
            weitergeben — {props.tenantName} wird danach nie fragen.
          </Text>
        </View>

        {/* Grußformel */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Mit freundlichen Grüßen</Text>
          <Text style={styles.footerName}>{props.tenantName}</Text>
        </View>

        {/* Farbbalken */}
        <View style={styles.bottomBar} />
      </Page>
    </Document>
  );
}

export async function generatePinLetterPdf(props: PinLetterProps): Promise<Buffer> {
  const buffer = await renderToBuffer(<PinLetterDocument {...props} />);
  return Buffer.from(buffer);
}
