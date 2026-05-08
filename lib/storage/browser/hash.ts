import type { Message } from "../../types";

export async function hashMessagesAsync(messages: Message[]): Promise<string> {
  const enc = new TextEncoder();
  const parts: string[] = [];
  for (const m of messages) {
    parts.push(m.uuid, " ", m.role, " ", m.timestamp, "");
  }
  const buf = enc.encode(parts.join(""));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}
