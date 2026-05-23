export type TenantInfo = {
  tenantId: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  scopes: string[];
};

export type CustomerResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  salutation: string | null;
  citizenAccountId: string | null;
  mobilePhone: string | null;
};

export type Template = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
};

export type SendMessagePayload = {
  recipientId: string;
  subject: string;
  body: string;
  securityLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";
  password?: string;
  allowReply?: boolean;
  attachmentStagingKeys?: string[];
};

export type SendMessageResult = {
  id: string;
  messageUrl: string;
};

export type StagedAttachment = {
  stagingKey: string;
};

export class TrustelloApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class TrustelloClient {
  constructor(
    private readonly serverUrl: string,
    private readonly apiKey: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.serverUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
        error?: string;
      };
      throw new TrustelloApiError(res.status, body.error ?? res.statusText);
    }

    return res.json() as Promise<T>;
  }

  getMe(): Promise<TenantInfo> {
    return this.request<TenantInfo>("/api/v1/me");
  }

  searchCustomers(q: string): Promise<CustomerResult[]> {
    return this.request<CustomerResult[]>(`/api/v1/customers?q=${encodeURIComponent(q)}&limit=10`);
  }

  getTemplates(): Promise<Template[]> {
    return this.request<Template[]>("/api/v1/templates");
  }

  sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    return this.request<SendMessageResult>("/api/v1/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async stageAttachment(
    base64Content: string,
    fileName: string,
    mimeType: string,
  ): Promise<StagedAttachment> {
    const binary = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    const res = await fetch(`${this.serverUrl}/api/upload/stage`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": mimeType,
        "x-file-name": encodeURIComponent(fileName),
        "x-file-size": String(binary.length),
      },
      body: binary,
    });

    if (!res.ok) {
      throw new TrustelloApiError(res.status, "Anhang-Upload fehlgeschlagen.");
    }

    return res.json() as Promise<StagedAttachment>;
  }
}
