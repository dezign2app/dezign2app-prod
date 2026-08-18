/** Convert a label like "Order Events Broker" → "order-events-broker" */
export function toFolderName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Convert a topic name to a safe const key: "order-created" → "ORDER_CREATED" */
export function toTopicKey(name: string): string {
  if (!name) return "TOPIC";
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return cleaned || "TOPIC";
}
