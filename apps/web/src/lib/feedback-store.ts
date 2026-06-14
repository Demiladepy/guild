type FeedbackRecord = Record<string, unknown>;

const store = new Map<string, FeedbackRecord>();

export function putFeedback(id: string, payload: FeedbackRecord) {
  store.set(id, payload);
}

export function getFeedback(id: string): FeedbackRecord | undefined {
  return store.get(id);
}
