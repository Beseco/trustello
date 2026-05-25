"use client";

import { useState, useTransition, useRef, useEffect, useId, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  X,
  Paperclip,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  ChevronDown,
  Mail,
  Shield,
  Lock,
  ShieldCheck,
  UserPlus,
  Info,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";

import { sendMessage } from "@/server/actions/messages";
import {
  searchCustomers,
  quickCreateCustomer,
  type CustomerSearchResult,
} from "@/server/actions/customers";
import { getMessageTemplates } from "@/server/actions/message-templates";
import { sendMessageSchema, type SendMessageInput } from "@/lib/validation/messages";
import { formatPhoneDisplay } from "@/lib/sms/phone";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SECURITY_LEVELS = [
  {
    value: "LEVEL_1",
    label: "Standard",
    badge: "Stufe 1",
    icon: Mail,
    color: "slate",
    description:
      "Transportverschlüsselt (TLS). Für allgemeine Informationen ohne besondere Schutzanforderung.",
  },
  {
    value: "LEVEL_2",
    label: "Verschlüsselt",
    badge: "Stufe 2 · Empfohlen",
    icon: Shield,
    color: "blue",
    description:
      "Ende-zu-Ende-verschlüsselt. Nur der Empfänger kann den Inhalt lesen — geeignet für behördliche Korrespondenz.",
  },
  {
    value: "LEVEL_3",
    label: "Passwortgeschützt",
    badge: "Stufe 3",
    icon: Lock,
    color: "amber",
    description:
      "Verschlüsselt + Passwortschutz. Der Empfänger benötigt ein Passwort — für besonders sensible Inhalte.",
  },
  {
    value: "LEVEL_4",
    label: "Höchste Sicherheit",
    badge: "Stufe 4",
    icon: ShieldCheck,
    color: "rose",
    description:
      "Passwortschutz mit verschärften Zugangsanforderungen. Für hochsensible Dokumente und kritische Informationen.",
  },
] as const;

type SecurityLevelValue = (typeof SECURITY_LEVELS)[number]["value"];
type SecurityLevelColor = (typeof SECURITY_LEVELS)[number]["color"];

const COLOR_STYLES: Record<SecurityLevelColor, { card: string; icon: string; badge: string }> = {
  slate: {
    card: "border-slate-200 bg-slate-50 ring-slate-400",
    icon: "bg-slate-100 text-slate-500",
    badge: "bg-slate-100 text-slate-600",
  },
  blue: {
    card: "border-blue-200 bg-blue-50 ring-blue-500",
    icon: "bg-blue-100 text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  amber: {
    card: "border-amber-200 bg-amber-50 ring-amber-500",
    icon: "bg-amber-100 text-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
  rose: {
    card: "border-rose-200 bg-rose-50 ring-rose-500",
    icon: "bg-rose-100 text-rose-600",
    badge: "bg-rose-100 text-rose-700",
  },
};

function SecurityLevelSelector({
  value,
  onChange,
}: {
  value: SecurityLevelValue;
  onChange: (v: SecurityLevelValue) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SECURITY_LEVELS.map((level) => {
        const isSelected = value === level.value;
        const styles = COLOR_STYLES[level.color];
        const Icon = level.icon;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={[
              "relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
              isSelected
                ? `${styles.card} ring-2`
                : "border-border bg-background hover:border-slate-300 hover:bg-slate-50",
            ].join(" ")}
          >
            {isSelected && (
              <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-current opacity-70" />
            )}
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles.icon}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <span
                className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${styles.badge}`}
              >
                {level.badge}
              </span>
              <p className="text-sm font-medium leading-tight">{level.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {level.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type StagedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: "uploading" | "done" | "error";
  progress: number;
  stagingKey?: string;
  error?: string;
};

const DRAFT_KEY = "trustello:compose-draft";

type DraftData = {
  subject: string;
  body: string;
  securityLevel: string;
  recipient?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    citizenAccountId: string | null;
    mobilePhone: string | null;
  };
};

type Template = { id: string; name: string; subject: string | null; body: string };
type GroupedTemplates = { global: Template[]; ou: Template[]; user: Template[] };
type MyOU = { id: string; name: string };
type ComposeFormProps = {
  signature?: string | null;
  templates?: GroupedTemplates | Template[];
  myOUs?: MyOU[];
};

function TemplateItem({
  tpl,
  onApply,
  defaultSignatureBody,
}: {
  tpl: Template;
  onApply: (body: string) => void;
  defaultSignatureBody: string;
}) {
  return (
    <DropdownMenuItem
      onClick={() => onApply(defaultSignatureBody ? tpl.body + defaultSignatureBody : tpl.body)}
    >
      {tpl.name}
    </DropdownMenuItem>
  );
}

function normalizeTemplates(templates: GroupedTemplates | Template[]): GroupedTemplates {
  if (Array.isArray(templates)) return { global: templates, ou: [], user: [] };
  return templates;
}

export function ComposeForm({
  signature,
  templates: rawTemplates = [],
  myOUs = [],
}: ComposeFormProps) {
  const templates = normalizeTemplates(rawTemplates as GroupedTemplates | Template[]);
  const router = useRouter();
  const [selectedRecipient, setSelectedRecipient] = useState<CustomerSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [attachments, setAttachments] = useState<StagedFile[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [isCreating, startCreate] = useTransition();
  const idGen = useId();
  const [isSending, startSend] = useTransition();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFormError, setNewFormError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultSignatureBody = signature
    ? `<p></p><hr><p>${signature.replace(/\n/g, "<br>")}</p>`
    : "";

  // Restore draft on mount
  const restoredDraft = useRef<DraftData | null>(null);
  if (typeof window !== "undefined" && restoredDraft.current === null) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) restoredDraft.current = JSON.parse(raw) as DraftData;
    } catch {
      /* ignore */
    }
  }
  const draft = restoredDraft.current;

  const form = useForm<SendMessageInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(sendMessageSchema) as any,
    defaultValues: {
      recipientId: draft?.recipient?.id ?? "",
      subject: draft?.subject ?? "",
      body: draft?.body ?? defaultSignatureBody,
      securityLevel: (draft?.securityLevel as SendMessageInput["securityLevel"]) ?? "LEVEL_2",
      minTrustLevel: "EMAIL",
      allowReply: true,
      encryptSubject: false,
      password: "",
      passwordHint: "",
      ouId: "",
      senderIsAnonymous: false,
    },
  });

  // Restore recipient state from draft
  useEffect(() => {
    if (draft?.recipient) {
      setSelectedRecipient(draft.recipient as CustomerSearchResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const securityLevel = form.watch("securityLevel");
  const isPasswordLevel = securityLevel === "LEVEL_3" || securityLevel === "LEVEL_4";

  // Auto-save draft with 1s debounce
  const saveDraft = useCallback(
    (values: Partial<SendMessageInput>, recipient: CustomerSearchResult | null) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          const data: DraftData = {
            subject: values.subject ?? "",
            body: values.body ?? "",
            securityLevel: values.securityLevel ?? "LEVEL_2",
            recipient: recipient
              ? {
                  id: recipient.id,
                  firstName: recipient.firstName,
                  lastName: recipient.lastName,
                  email: recipient.email,
                  citizenAccountId: recipient.citizenAccountId,
                  mobilePhone: recipient.mobilePhone,
                }
              : undefined,
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
          setDraftSavedAt(new Date());
        } catch {
          /* ignore */
        }
      }, 1000);
    },
    [],
  );

  // Watch form and auto-save on change
  useEffect(() => {
    const sub = form.watch((values) => {
      saveDraft(values, selectedRecipient);
    });
    return () => sub.unsubscribe();
  }, [form, saveDraft, selectedRecipient]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setShowDropdown(true);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    startSearch(async () => {
      const results = await searchCustomers(q);
      setSearchResults(results);
    });
  };

  const selectRecipient = (customer: CustomerSearchResult) => {
    setSelectedRecipient(customer);
    form.setValue("recipientId", customer.id, { shouldValidate: true });
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    saveDraft(form.getValues(), customer);
  };

  const clearRecipient = () => {
    setSelectedRecipient(null);
    form.setValue("recipientId", "", { shouldValidate: false });
    saveDraft(form.getValues(), null);
  };

  // Vorausfüllen aus E-Mail-Adresse (max.mustermann@ → Max, Mustermann)
  const openNewCustomerForm = () => {
    const q = searchQuery.trim();
    const isEmail = q.includes("@");
    const pre = { firstName: "", lastName: "", email: "" };
    if (isEmail) {
      pre.email = q;
      const local = q.split("@")[0] ?? "";
      const parts = local.split(/[._-]/).filter(Boolean);
      if (parts.length >= 2) {
        pre.firstName = parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1);
        pre.lastName = parts
          .slice(1)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ");
      }
    } else {
      const parts = q.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        pre.firstName = parts[0]!;
        pre.lastName = parts.slice(1).join(" ");
      } else {
        pre.firstName = q;
      }
    }
    setNewFirstName(pre.firstName);
    setNewLastName(pre.lastName);
    setNewEmail(pre.email);
    setNewFormError(null);
    setShowNewForm(true);
    setShowDropdown(false);
  };

  const handleCreateCustomer = () => {
    setNewFormError(null);
    startCreate(async () => {
      const result = await quickCreateCustomer({
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
      });
      if (result.error || !result.customer) {
        setNewFormError(result.error ?? "Fehler beim Anlegen");
        return;
      }
      setShowNewForm(false);
      selectRecipient(result.customer);
    });
  };

  const uploadFile = (file: File, fileId: string) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/upload/stage");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-file-size", String(file.size));
    xhr.setRequestHeader("x-file-mime", file.type || "application/octet-stream");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 95); // reserve 5% for scan
        setAttachments((prev) => prev.map((a) => (a.id === fileId ? { ...a, progress: pct } : a)));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const { stagingKey } = JSON.parse(xhr.responseText) as { stagingKey: string };
        // Trigger ClamAV scan (separate step)
        fetch("/api/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stagingKey }),
        })
          .then((r) => r.json())
          .then((data: { scanStatus?: string; error?: string }) => {
            if (data.error) {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === fileId ? { ...a, status: "error", error: data.error } : a,
                ),
              );
            } else {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === fileId ? { ...a, status: "done", progress: 100, stagingKey } : a,
                ),
              );
            }
          })
          .catch(() => {
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === fileId
                  ? { ...a, status: "error", error: "Virenprüfung fehlgeschlagen" }
                  : a,
              ),
            );
          });
      } else {
        const msg = (() => {
          try {
            return (JSON.parse(xhr.responseText) as { error: string }).error;
          } catch {
            return "Upload fehlgeschlagen";
          }
        })();
        setAttachments((prev) =>
          prev.map((a) => (a.id === fileId ? { ...a, status: "error", error: msg } : a)),
        );
      }
    };

    xhr.onerror = () => {
      setAttachments((prev) =>
        prev.map((a) => (a.id === fileId ? { ...a, status: "error", error: "Netzwerkfehler" } : a)),
      );
    };

    xhr.send(file); // raw binary — no FormData wrapper
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    const existingNames = new Set(attachments.map((a) => a.name + a.size));

    for (const file of newFiles) {
      if (existingNames.has(file.name + file.size)) continue;
      const fileId = `${idGen}-${Date.now()}-${Math.random()}`;
      const staged: StagedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        status: "uploading",
        progress: 0,
      };
      setAttachments((prev) => [...prev, staged]);
      uploadFile(file, fileId);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const onSubmit = (values: SendMessageInput) => {
    if (!selectedRecipient) {
      form.setError("recipientId", { message: "Bitte Empfänger auswählen" });
      return;
    }
    const uploading = attachments.filter((a) => a.status === "uploading");
    if (uploading.length > 0) {
      toast.error("Bitte warten Sie, bis alle Anhänge hochgeladen sind.");
      return;
    }
    const failed = attachments.filter((a) => a.status === "error");
    if (failed.length > 0) {
      toast.error(
        "Einige Anhänge konnten nicht hochgeladen werden. Bitte entfernen und erneut versuchen.",
      );
      return;
    }
    startSend(async () => {
      const fd = new FormData();
      fd.append("recipientId", values.recipientId);
      fd.append("subject", values.subject);
      fd.append("body", values.body);
      fd.append("securityLevel", values.securityLevel);
      fd.append("minTrustLevel", values.minTrustLevel);
      fd.append("allowReply", String(values.allowReply));
      fd.append("encryptSubject", String(values.encryptSubject));
      if (values.password) fd.append("password", values.password);
      if (values.passwordHint) fd.append("passwordHint", values.passwordHint);
      if (values.ouId) fd.append("ouId", values.ouId);
      fd.append("senderIsAnonymous", String(values.senderIsAnonymous ?? false));
      const stagingKeys = attachments
        .filter((a) => a.status === "done" && a.stagingKey)
        .map(({ stagingKey, name, size, mimeType }) => ({ stagingKey, name, size, mimeType }));
      fd.append("stagingKeys", JSON.stringify(stagingKeys));

      const result = await sendMessage(fd);
      if (result.error) {
        toast.error(result.error);
      } else {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        toast.success("Nachricht erfolgreich gesendet");
        router.push("/inbox");
      }
    });
  };

  const recipientError = form.formState.errors.recipientId?.message;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Recipient */}
        <div className="space-y-2" ref={searchRef}>
          <Label>Empfänger</Label>
          {selectedRecipient ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                <span className="flex-1">
                  {selectedRecipient.firstName} {selectedRecipient.lastName}
                  <span className="ml-2 text-muted-foreground">({selectedRecipient.email})</span>
                </span>
                <button
                  type="button"
                  onClick={clearRecipient}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!selectedRecipient.citizenAccountId && (
                <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Dieser Kontakt hat noch kein Postfach-Konto. Mit dem Versand erhält er
                    automatisch eine Einladung zur Registrierung.
                  </span>
                </div>
              )}
              {isPasswordLevel &&
                (selectedRecipient.mobilePhone ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Passwort wird automatisch per SMS gesendet (
                      {formatPhoneDisplay(selectedRecipient.mobilePhone)})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Kein Mobiltelefon hinterlegt — Passwort muss manuell übermittelt werden.
                    </span>
                  </div>
                ))}
            </div>
          ) : showNewForm ? (
            <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-medium text-blue-800">
                <UserPlus className="h-4 w-4" />
                Neuen Empfänger anlegen
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Vorname *</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Vorname"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Nachname *</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Nachname"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">E-Mail-Adresse *</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@beispiel.de"
                />
              </div>
              {newFormError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {newFormError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateCustomer}
                  disabled={
                    isCreating || !newFirstName.trim() || !newLastName.trim() || !newEmail.trim()
                  }
                >
                  {isCreating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Anlegen &amp; auswählen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewForm(false)}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Name oder E-Mail eingeben…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
                autoComplete="off"
              />
              {showDropdown && (searchResults.length > 0 || isSearching) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Suchen…
                    </div>
                  ) : (
                    searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => selectRecipient(c)}
                      >
                        <div className="flex-1">
                          <span className="font-medium">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
                        </div>
                        {!c.citizenAccountId && (
                          <span className="mt-0.5 shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Kein Konto
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
              {showDropdown &&
                !isSearching &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Kein Kontakt gefunden.
                    </p>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                      onClick={openNewCustomerForm}
                    >
                      <UserPlus className="h-4 w-4" />
                      Neuen Kontakt anlegen und einladen
                    </button>
                  </div>
                )}
            </div>
          )}
          {recipientError && <p className="text-sm text-destructive">{recipientError}</p>}
        </div>

        {/* Subject */}
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Betreff</FormLabel>
              <FormControl>
                <Input placeholder="Betreff der Nachricht" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Body */}
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Nachricht</FormLabel>
                {(templates.user.length > 0 ||
                  templates.ou.length > 0 ||
                  templates.global.length > 0) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Vorlage laden
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-64">
                      {templates.user.length > 0 && (
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                            Persönlich
                          </DropdownMenuLabel>
                          {templates.user.map((tpl) => (
                            <TemplateItem
                              key={tpl.id}
                              tpl={tpl}
                              onApply={(body) => {
                                field.onChange(body);
                                if (tpl.subject)
                                  form.setValue("subject", tpl.subject, { shouldValidate: true });
                              }}
                              defaultSignatureBody={defaultSignatureBody}
                            />
                          ))}
                        </DropdownMenuGroup>
                      )}
                      {templates.ou.length > 0 && (
                        <>
                          {templates.user.length > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                              Meine Einheit
                            </DropdownMenuLabel>
                            {templates.ou.map((tpl) => (
                              <TemplateItem
                                key={tpl.id}
                                tpl={tpl}
                                onApply={(body) => {
                                  field.onChange(body);
                                  if (tpl.subject)
                                    form.setValue("subject", tpl.subject, { shouldValidate: true });
                                }}
                                defaultSignatureBody={defaultSignatureBody}
                              />
                            ))}
                          </DropdownMenuGroup>
                        </>
                      )}
                      {templates.global.length > 0 && (
                        <>
                          {(templates.user.length > 0 || templates.ou.length > 0) && (
                            <DropdownMenuSeparator />
                          )}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                              Global
                            </DropdownMenuLabel>
                            {templates.global.map((tpl) => (
                              <TemplateItem
                                key={tpl.id}
                                tpl={tpl}
                                onApply={(body) => {
                                  field.onChange(body);
                                  if (tpl.subject)
                                    form.setValue("subject", tpl.subject, { shouldValidate: true });
                                }}
                                defaultSignatureBody={defaultSignatureBody}
                              />
                            ))}
                          </DropdownMenuGroup>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <FormControl>
                <RichTextEditor value={field.value} onChange={field.onChange} minHeight={280} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Attachments */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <Label>Anhänge</Label>
            {attachments.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatBytes(attachments.reduce((s, f) => s + f.size, 0))} gesamt
              </span>
            )}
          </div>
          {attachments.length > 0 && (
            <ul className="space-y-1.5">
              {attachments.map((file) => (
                <li key={file.id} className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {file.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : file.status === "error" ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {file.status === "uploading" && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#1e40af] transition-all duration-200"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                  {file.status === "error" && (
                    <p className="mt-1 text-xs text-destructive">{file.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
            Datei hinzufügen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Security Level */}
        <FormField
          control={form.control}
          name="securityLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sicherheitsstufe</FormLabel>
              <FormControl>
                <SecurityLevelSelector
                  value={field.value as SecurityLevelValue}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password (LEVEL_3/4) */}
        {isPasswordLevel && (
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="text-sm font-medium">Passwortschutz</p>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Passwort für den Empfänger" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passwordHint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort-Hinweis (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Ihr Geburtsdatum" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Sender metadata */}
        {myOUs.length > 0 && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-slate-700">Absender-Angaben</p>
            <FormField
              control={form.control}
              name="ouId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-slate-600">
                    Organisationseinheit (optional)
                  </FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Keine Einheit angeben" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Keine Einheit angeben</SelectItem>
                      {myOUs.map((ou) => (
                        <SelectItem key={ou.id} value={ou.id}>
                          {ou.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="senderIsAnonymous"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="cursor-pointer font-normal text-sm">
                      Meinen Namen nicht anzeigen
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Empfänger sieht nur Behörde/Einheit, nicht Ihren Namen.
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap gap-6">
          <FormField
            control={form.control}
            name="allowReply"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-input"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">Antwort erlauben</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="encryptSubject"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-input"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">Betreff verschlüsseln</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {(() => {
              const done = attachments.filter((a) => a.status === "done").length;
              const uploading = attachments.filter((a) => a.status === "uploading").length;
              if (uploading > 0) return `${uploading} Anhang wird hochgeladen…`;
              if (done > 0) return `Senden mit ${done} Anhang${done > 1 ? "en" : ""}`;
              return "Nachricht senden";
            })()}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const hasDraft = !!localStorage.getItem(DRAFT_KEY);
              if (hasDraft) {
                if (confirm("Entwurf verwerfen und zurück zum Posteingang?")) {
                  localStorage.removeItem(DRAFT_KEY);
                  router.push("/inbox");
                }
              } else {
                router.push("/inbox");
              }
            }}
            disabled={isSending}
          >
            Abbrechen
          </Button>
          {draftSavedAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Save className="h-3 w-3" />
              Entwurf gespeichert{" "}
              {draftSavedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </form>
    </Form>
  );
}
