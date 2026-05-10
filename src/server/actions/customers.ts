"use server";

// Phase 2: Kundenverwaltung wird hier implementiert

export type CreateCustomerResult = {
  customerId?: string;
  error?: string;
};

export async function createCustomer(_data: unknown): Promise<CreateCustomerResult> {
  return { error: "Noch nicht implementiert (Phase 2)" };
}
