import type { RelayerStatusResponse } from "@guild/core/relayer";

export type RelayerWebhookEnvelope = {
  apiVersion: number;
  type: 0 | 1 | 4;
  data: RelayerStatusResponse;
  timestamp: number;
  keyId: string;
  signature: string;
};

export type RelayerLiveEvent = {
  taskId: string;
  webhookType: 0 | 1 | 4;
  status: RelayerStatusResponse["status"];
  label: string;
  hash?: string;
  transactionHash?: string;
  receivedAt: number;
};

const eventsByTask = new Map<string, RelayerLiveEvent[]>();
const listenersByTask = new Map<string, Set<(event: RelayerLiveEvent) => void>>();

function statusLabel(status: RelayerStatusResponse["status"]): string {
  switch (status) {
    case 100:
      return "Pending";
    case 110:
      return "Submitted";
    case 200:
      return "Confirmed";
    case 400:
      return "Rejected";
    case 500:
      return "Reverted";
    default:
      return `Status ${status}`;
  }
}

function webhookTypeLabel(type: 0 | 1 | 4): string {
  switch (type) {
    case 4:
      return "Submitted";
    case 0:
      return "Confirmed";
    case 1:
      return "Failed";
    default:
      return `Webhook ${type}`;
  }
}

export function pushRelayerEvent(
  envelope: Omit<RelayerWebhookEnvelope, "signature">,
): RelayerLiveEvent {
  const taskId = envelope.data.id;
  const event: RelayerLiveEvent = {
    taskId,
    webhookType: envelope.type,
    status: envelope.data.status,
    label: `${webhookTypeLabel(envelope.type)} · ${statusLabel(envelope.data.status)}`,
    hash: envelope.data.hash,
    transactionHash: envelope.data.receipt?.transactionHash ?? envelope.data.hash,
    receivedAt: Date.now(),
  };

  const history = eventsByTask.get(taskId) ?? [];
  history.push(event);
  eventsByTask.set(taskId, history);

  const listeners = listenersByTask.get(taskId);
  if (listeners) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  return event;
}

export function getRelayerEvents(taskId: string): RelayerLiveEvent[] {
  return eventsByTask.get(taskId) ?? [];
}

export function subscribeRelayerEvents(
  taskId: string,
  listener: (event: RelayerLiveEvent) => void,
): () => void {
  const listeners = listenersByTask.get(taskId) ?? new Set();
  listeners.add(listener);
  listenersByTask.set(taskId, listeners);

  return () => {
    const current = listenersByTask.get(taskId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenersByTask.delete(taskId);
  };
}
