// What the fake mail, chat, webhook and push plugins "sent": kept for the tests and for
// GET /_engine/outbox to read, and emptied by a reset.

import type { Database } from "bun:sqlite";
import type { Clock } from "./clock";

export const outboxChannels = ["mail", "chat", "webhook", "push"] as const;
export type OutboxChannel = (typeof outboxChannels)[number];

export interface OutboxMessage {
  id: number;
  channel: OutboxChannel;
  recipient: string;
  payload: unknown;
  sentAt: string;
}

export interface Outbox {
  send(channel: OutboxChannel, recipient: string, payload: unknown): number;
  list(channel?: OutboxChannel): OutboxMessage[];
}

interface Row {
  id: number;
  channel: OutboxChannel;
  recipient: string;
  payload: string;
  sent_at: string;
}

export function createOutbox(db: Database, clock: Clock): Outbox {
  return {
    send(channel, recipient, payload) {
      const row = db
        .query<{ id: number }, [string, string, string, string]>(
          "INSERT INTO outbox (channel, recipient, payload, sent_at) VALUES (?, ?, ?, ?) RETURNING id",
        )
        .get(channel, recipient, JSON.stringify(payload), clock.now().toISOString());
      return row?.id ?? 0;
    },
    list(channel) {
      const rows =
        channel === undefined
          ? db.query<Row, []>("SELECT * FROM outbox ORDER BY id").all()
          : db
              .query<Row, [string]>("SELECT * FROM outbox WHERE channel = ? ORDER BY id")
              .all(channel);
      return rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        recipient: row.recipient,
        payload: JSON.parse(row.payload),
        sentAt: row.sent_at,
      }));
    },
  };
}
