import { createHmac } from "node:crypto";
import { prisma } from "../db";
import {
  EVENT_TYPES,
  webhookEvents,
  type WebhookEvent,
  type WebhookEventType,
} from "./event";

const MAX_PAYLOAD_SIZE = 1024 * 1024;
const MAX_ATTEMPTS = 5;
const DELIVERY_TIMEOUT = 5_000;

export { EVENT_TYPES };

interface WebhookRecord {
  id: string;
  groupId: string | null;
  userId: string | null;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

function eventPayload(
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Record<string, unknown> {
  return { eventType, data: payload, timestamp: new Date().toISOString() };
}

export async function deliverWebhook(
  webhook: WebhookRecord,
  eventType: WebhookEventType,
  payload: string
): Promise<void> {
  const delivery = await (prisma as any).webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType,
      payload,
      responseStatusCode: null,
      responseBody: null,
      success: false,
      attempts: 0,
    },
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let responseStatusCode: number | null = null;
    let responseBody = "";
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);
      try {
        const signature = createHmac("sha256", webhook.secret)
          .update(payload)
          .digest("hex");
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-mergepay-signature": signature,
          },
          body: payload,
          signal: controller.signal,
        });
        responseStatusCode = response.status;
        responseBody = (await response.text()).slice(0, MAX_PAYLOAD_SIZE);
        success = response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      responseBody = error instanceof Error ? error.message : "Delivery failed";
    }

    await (prisma as any).webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        responseStatusCode,
        responseBody,
        success,
        attempts: attempt,
      },
    });

    if (success) return;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, 2 ** (attempt - 1) * 1000)
      );
    }
  }
}

export async function dispatchEvent(
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  groupId?: string,
  userId?: string
): Promise<void> {
  const serialized = JSON.stringify(eventPayload(eventType, payload));
  if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_SIZE) return;

  const webhooks = (await (prisma as any).webhook.findMany({
    where: {
      enabled: true,
      events: { has: eventType },
      OR: [
        ...(groupId ? [{ groupId }] : []),
        ...(userId ? [{ userId }] : []),
        { groupId: null, userId: null },
      ],
    },
  })) as WebhookRecord[];

  await Promise.all(
    webhooks.map((webhook) => deliverWebhook(webhook, eventType, serialized))
  );
}

webhookEvents.on("event", (event: WebhookEvent) => {
  void dispatchEvent(event.eventType, event.payload, event.groupId, event.userId);
});

export function isWebhookEventType(value: string): value is WebhookEventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}
