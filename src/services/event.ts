import { EventEmitter } from "node:events";

export const webhookEvents = new EventEmitter();

export const EVENT_TYPES = [
  "expense.created",
  "expense.settled",
  "settlement.completed",
  "settlement.failed",
  "treasury.proposal.created",
  "treasury.proposal.signed",
  "treasury.proposal.submitted",
] as const;

export type WebhookEventType = (typeof EVENT_TYPES)[number];

export interface WebhookEvent {
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  groupId?: string;
  userId?: string;
}

export function emitWebhookEvent(event: WebhookEvent): void {
  webhookEvents.emit("event", event);
}
