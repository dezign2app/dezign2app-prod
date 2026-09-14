import { RedisDuration, DirectRedisCommand } from "../types/redis";

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

export const DIRECT_REDIS_COMMANDS: DirectRedisCommand[] = [
  // Key-Value
  {
    id: "redis-get",
    name: "redis.get",
    category: "String / Key-Value",
    description: "Get value by key",
    signature: "get(key: string): Promise<string | null>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-set",
    name: "redis.set",
    category: "String / Key-Value",
    description: "Set key to hold the string value",
    signature: "set(key: string, value: string): Promise<'OK'>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-setex",
    name: "redis.setex",
    category: "String / Key-Value",
    description: "Set key with TTL expiration in seconds",
    signature: "setex(key: string, seconds: number, value: string): Promise<'OK'>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "seconds", type: "number", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-del",
    name: "redis.del",
    category: "String / Key-Value",
    description: "Delete key",
    signature: "del(key: string): Promise<number>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-exists",
    name: "redis.exists",
    category: "String / Key-Value",
    description: "Determine if key exists",
    signature: "exists(key: string): Promise<number>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-expire",
    name: "redis.expire",
    category: "String / Key-Value",
    description: "Set a key's time to live in seconds",
    signature: "expire(key: string, seconds: number): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "seconds", type: "number", required: true },
    ],
  },
  {
    id: "redis-ttl",
    name: "redis.ttl",
    category: "String / Key-Value",
    description: "Get the time to live for a key in seconds",
    signature: "ttl(key: string): Promise<number>",
    params: [{ name: "key", type: "string", required: true }],
  },
  // Hash
  {
    id: "redis-hget",
    name: "redis.hget",
    category: "Hash",
    description: "Get the value of a hash field",
    signature: "hget(key: string, field: string): Promise<string | null>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "field", type: "string", required: true },
    ],
  },
  {
    id: "redis-hset",
    name: "redis.hset",
    category: "Hash",
    description: "Set the value of a hash field",
    signature: "hset(key: string, field: string, value: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "field", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-hgetall",
    name: "redis.hgetall",
    category: "Hash",
    description: "Get all fields and values in a hash",
    signature: "hgetall(key: string): Promise<Record<string, string>>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-hdel",
    name: "redis.hdel",
    category: "Hash",
    description: "Delete one or more hash fields",
    signature: "hdel(key: string, field: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "field", type: "string", required: true },
    ],
  },
  // List
  {
    id: "redis-lpush",
    name: "redis.lpush",
    category: "List",
    description: "Prepend value to a list",
    signature: "lpush(key: string, value: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-rpush",
    name: "redis.rpush",
    category: "List",
    description: "Append value to a list",
    signature: "rpush(key: string, value: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-lpop",
    name: "redis.lpop",
    category: "List",
    description: "Remove and get first element in a list",
    signature: "lpop(key: string): Promise<string | null>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-rpop",
    name: "redis.rpop",
    category: "List",
    description: "Remove and get last element in a list",
    signature: "rpop(key: string): Promise<string | null>",
    params: [{ name: "key", type: "string", required: true }],
  },
  // Set
  {
    id: "redis-sadd",
    name: "redis.sadd",
    category: "Set",
    description: "Add member to a set",
    signature: "sadd(key: string, member: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "member", type: "string", required: true },
    ],
  },
  {
    id: "redis-srem",
    name: "redis.srem",
    category: "Set",
    description: "Remove member from a set",
    signature: "srem(key: string, member: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "member", type: "string", required: true },
    ],
  },
  {
    id: "redis-smembers",
    name: "redis.smembers",
    category: "Set",
    description: "Get all members in a set",
    signature: "smembers(key: string): Promise<string[]>",
    params: [{ name: "key", type: "string", required: true }],
  },
  // PubSub & Streams
  {
    id: "redis-publish",
    name: "redis.publish",
    category: "PubSub & Streams",
    description: "Post a message to a Redis channel",
    signature: "publish(channel: string, message: string): Promise<number>",
    params: [
      { name: "channel", type: "string", required: true },
      { name: "message", type: "string", required: true },
    ],
  },
  {
    id: "redis-xadd",
    name: "redis.xadd",
    category: "PubSub & Streams",
    description: "Appends message to Redis stream",
    signature: "xadd(stream: string, fields: Record<string, string>): Promise<string>",
    params: [
      { name: "stream", type: "string", required: true },
      { name: "fields", type: "Record<string, string>", required: true },
    ],
  },
  // RedisJSON
  {
    id: "redis-json-get",
    name: "redis.json.get",
    category: "JSON",
    description: "Retrieve JSON document or path from Redis",
    signature: "json.get(key: string, options?: { path?: string }): Promise<unknown>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "path", type: "string", required: false, defaultValue: '"$"' },
    ],
  },
  {
    id: "redis-json-set",
    name: "redis.json.set",
    category: "JSON",
    description: "Set JSON document or path in Redis",
    signature: "json.set(key: string, path: string, value: unknown): Promise<string>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "path", type: "string", required: true, defaultValue: '"$"' },
      { name: "value", type: "unknown", required: true },
    ],
  },
  {
    id: "redis-json-arrappend",
    name: "redis.json.arrappend",
    category: "JSON",
    description: "Append one or more values to JSON array",
    signature: "json.arrappend(key: string, path: string, ...values: unknown[]): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "path", type: "string", required: true, defaultValue: '"$"' },
      { name: "value", type: "unknown", required: true },
    ],
  },
  {
    id: "redis-json-arrpop",
    name: "redis.json.arrpop",
    category: "JSON",
    description: "Pop and return an element from JSON array",
    signature: "json.arrpop(key: string, path?: string, index?: number): Promise<unknown>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "path", type: "string", required: false, defaultValue: '"$"' },
      { name: "index", type: "number", required: false, defaultValue: "-1" },
    ],
  },
  {
    id: "redis-json-arrlen",
    name: "redis.json.arrlen",
    category: "JSON",
    description: "Report the length of JSON array at path",
    signature: "json.arrlen(key: string, path?: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "path", type: "string", required: false, defaultValue: '"$"' },
    ],
  },
];

