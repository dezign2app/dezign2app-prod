import { RedisDuration } from "../types/redis";

export const DEFAULT_CONVERSATION_SCHEMA = `[
  {
    "id": "msg_1",
    "role": "user",
    "message": "Hello AI!",
    "sender": {
      "userId": "u_99",
      "name": "Alice"
    },
    "tags": ["support", "urgent"]
  }
]`;

export const DEFAULT_OBJECT_SCHEMA = `{
  "id": "conv_123",
  "title": "Support Request",
  "metadata": {
    "model": "gpt-4o",
    "tokens": 256
  },
  "isActive": true
}`;

export const DEFAULT_REDIS_TTL_PRESETS: Array<{ label: string; duration: RedisDuration }> = [
  { label: "60s", duration: { value: 60, unit: "s" } },
  { label: "5m", duration: { value: 5, unit: "m" } },
  { label: "15m", duration: { value: 15, unit: "m" } },
  { label: "1h", duration: { value: 1, unit: "h" } },
  { label: "24h", duration: { value: 24, unit: "h" } },
  { label: "7d", duration: { value: 7, unit: "d" } },
  { label: "Persistent", duration: { value: 0, unit: "never" } },
];
