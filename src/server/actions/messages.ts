"use server";

// Phase 2: Nachricht-Senden wird hier implementiert

export type SendMessageResult = {
  messageId?: string;
  error?: string;
};

export async function sendMessage(_data: unknown): Promise<SendMessageResult> {
  return { error: "Noch nicht implementiert (Phase 2)" };
}
