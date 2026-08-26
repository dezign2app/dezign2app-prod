export type RedisDataStructure =
  | "hash"
  | "string"
  | "json"
  | "set"
  | "list"
  | "zset"
  | "geo"
  | "stream"
  | "bitmap"
  | "bitfield"
  | "hyperloglog"
  | "bloom";

export type RedisDurationUnit = "s" | "m" | "h" | "d" | "never";

export interface RedisDuration {
  value: number;
  unit: RedisDurationUnit;
}

export interface RedisHashField {
  name: string;
  type: "string" | "number" | "boolean" | "json" | "datetime" | "binary";
  required?: boolean;
  defaultValue?: string;
  description?: string;
  ttl?: RedisDuration; // Redis 7.4+ per-field TTL (HEXPIRE)
}

export interface RedisGeoConfig {
  longitudeField: string;
  latitudeField: string;
  memberType: "string" | "number" | "uuid";
  distanceUnit?: "m" | "km" | "mi" | "ft";
}

export interface RedisBitfieldSubfield {
  name: string;
  type: "u" | "i";
  bits: number;
  offset: number;
  overflow?: "WRAP" | "SAT" | "FAIL";
  description?: string;
}

export interface RedisBitfieldConfig {
  fields: RedisBitfieldSubfield[];
}

export interface RedisStreamConsumerGroup {
  name: string;
  description?: string;
  startId?: string;
}

export interface RedisStreamConfig {
  fields: Array<{ name: string; type: string }>;
  maxLen?: number;
  approximateTrim?: boolean;
  consumerGroups?: RedisStreamConsumerGroup[];
}

export interface RedisListConfig {
  elementType: string;
  maxLength?: number;
  trimStrategy?: "LTRIM" | "NONE";
  orientation?: "FIFO" | "LIFO";
}

export interface RedisSetConfig {
  memberType: string;
  description?: string;
}

export interface RedisZSetConfig {
  memberType: string;
  scoreType: "number" | "timestamp" | "float";
  sortOrder?: "asc" | "desc";
}

export interface RedisBitmapConfig {
  bitDescriptions?: Array<{ offset: number; name: string; description?: string }>;
}

export interface RedisHyperLogLogConfig {
  memberType?: string;
  precision?: string;
}

export type CacheStrategy =
  | "Cache Aside"
  | "Read Through"
  | "Write Through"
  | "Write Behind"
  | "Refresh Ahead";

export type SerializationFormat =
  | "JSON"
  | "String"
  | "Binary"
  | "MessagePack"
  | "ProtoBuf";

export type CompressionFormat =
  | "None"
  | "gzip"
  | "brotli"
  | "lz4";

export function isCacheStrategy(val: string): val is CacheStrategy {
  return (
    val === "Cache Aside" ||
    val === "Read Through" ||
    val === "Write Through" ||
    val === "Write Behind" ||
    val === "Refresh Ahead"
  );
}

export function isSerializationFormat(val: string): val is SerializationFormat {
  return (
    val === "JSON" ||
    val === "MessagePack" ||
    val === "ProtoBuf" ||
    val === "String" ||
    val === "Binary"
  );
}

export function isCompressionFormat(val: string): val is CompressionFormat {
  return (
    val === "None" ||
    val === "gzip" ||
    val === "brotli" ||
    val === "lz4"
  );
}

export function isRedisHashFieldType(val: string): val is RedisHashField["type"] {
  return (
    val === "string" ||
    val === "number" ||
    val === "boolean" ||
    val === "json" ||
    val === "datetime" ||
    val === "binary"
  );
}

export function isGeoMemberType(val: string): val is "string" | "number" | "uuid" {
  return val === "string" || val === "number" || val === "uuid";
}

export function isGeoDistanceUnit(val: string): val is "m" | "km" | "mi" | "ft" {
  return val === "m" || val === "km" || val === "mi" || val === "ft";
}

export function isBitfieldOverflow(val: string): val is "WRAP" | "SAT" | "FAIL" {
  return val === "WRAP" || val === "SAT" || val === "FAIL";
}

export function isZSetScoreType(val: string): val is "number" | "timestamp" | "float" {
  return val === "number" || val === "timestamp" || val === "float";
}

export function isSortOrder(val: string): val is "asc" | "desc" {
  return val === "asc" || val === "desc";
}

export function isListOrientation(val: string): val is "FIFO" | "LIFO" {
  return val === "FIFO" || val === "LIFO";
}

export function isRedisDurationUnit(val: string): val is RedisDurationUnit {
  return (
    val === "s" ||
    val === "m" ||
    val === "h" ||
    val === "d" ||
    val === "never"
  );
}
