import type { Config } from "./config.js";

export type TrustelloUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  entraId: string | null;
  roles: string[];
};

export class TrustelloSyncClient {
  constructor(private readonly config: Config) {}

  private async req<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.config.trustello.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.trustello.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Trustello API ${res.status}: ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  getUsers(): Promise<TrustelloUser[]> {
    return this.req<TrustelloUser[]>("/api/v1/users");
  }

  createUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    roles: string[];
    entraId?: string;
  }): Promise<TrustelloUser> {
    return this.req<TrustelloUser>("/api/v1/users", "POST", data);
  }

  updateUser(
    id: string,
    data: { firstName?: string; lastName?: string; isActive?: boolean; entraId?: string },
  ): Promise<TrustelloUser> {
    return this.req<TrustelloUser>(`/api/v1/users/${id}`, "PUT", data);
  }
}
