import { BackendNode, RedisDuration, RedisHashField } from "@/types/canvas";

export const TTL_PRESETS: Array<{ label: string; duration: RedisDuration }> = [
  { label: "60s", duration: { value: 60, unit: "s" } },
  { label: "5m", duration: { value: 5, unit: "m" } },
  { label: "15m", duration: { value: 15, unit: "m" } },
  { label: "1h", duration: { value: 1, unit: "h" } },
  { label: "24h", duration: { value: 24, unit: "h" } },
  { label: "7d", duration: { value: 7, unit: "d" } },
  { label: "Persistent", duration: { value: 0, unit: "never" } },
];

export function syncColumnsFromFields(fields: RedisHashField[]) {
  return fields.map((f) => ({
    name: f.name,
    type:
      f.type === "number"
        ? "INTEGER"
        : f.type === "boolean"
          ? "BOOLEAN"
          : f.type === "json"
            ? "JSON"
            : "TEXT",
    isNotNull: f.required,
  }));
}

export const SCHEMA_PRESET_MAP: Record<string, Partial<BackendNode["data"]>> = {
  user_profile: {
    label: "User_Profile_Cache",
    redisDataStructure: "hash",
    keyTemplate: "user:{id}:profile",
    clusterHashTagParam: "id",
    ttl: { value: 1, unit: "h" },
    cacheStrategy: "Cache Aside",
    negativeCaching: { enabled: true, ttl: { value: 60, unit: "s" } },
    hashConfig: {
      fields: [
        { name: "id", type: "string", required: true },
        { name: "username", type: "string", required: true },
        { name: "email", type: "string", required: true },
        { name: "avatarUrl", type: "string", required: false },
        { name: "role", type: "string", defaultValue: "member" },
        { name: "lastActive", type: "datetime", ttl: { value: 300, unit: "s" } },
      ],
    },
    columns: [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "username", type: "TEXT" },
      { name: "email", type: "TEXT" },
      { name: "avatarUrl", type: "TEXT" },
    ],
  },
  session_store: {
    label: "User_Session_Store",
    redisDataStructure: "string",
    keyTemplate: "session:{token}",
    clusterHashTagParam: "token",
    ttl: { value: 24, unit: "h" },
    cacheStrategy: "Read Through",
    serialization: "JSON",
    staleWhileRevalidate: { enabled: true, refreshInterval: { value: 15, unit: "m" } },
  },
  leaderboard: {
    label: "Game_Leaderboard",
    redisDataStructure: "zset",
    keyTemplate: "leaderboard:{gameId}:daily",
    clusterHashTagParam: "gameId",
    ttl: { value: 24, unit: "h" },
    cacheStrategy: "Cache Aside",
    zsetConfig: {
      memberType: "uuid",
      scoreType: "number",
      sortOrder: "desc",
    },
  },
  geo_locations: {
    label: "Driver_Locations_Geo",
    redisDataStructure: "geo",
    keyTemplate: "geo:drivers:{cityId}",
    clusterHashTagParam: "cityId",
    ttl: { value: 15, unit: "m" },
    geoConfig: {
      longitudeField: "lon",
      latitudeField: "lat",
      memberType: "string",
      distanceUnit: "km",
    },
  },
  activity_stream: {
    label: "Activity_Stream",
    redisDataStructure: "stream",
    keyTemplate: "stream:events:{tenantId}",
    clusterHashTagParam: "tenantId",
    ttl: { value: 7, unit: "d" },
    streamConfig: {
      fields: [
        { name: "eventType", type: "string" },
        { name: "userId", type: "string" },
        { name: "payload", type: "json" },
      ],
      maxLen: 10000,
      approximateTrim: true,
      consumerGroups: [
        { name: "notification-workers", description: "Processes user notifications" },
        { name: "analytics-pipeline", description: "Aggregates clickstream events" },
      ],
    },
  },
  bitfield_counters: {
    label: "User_Feature_Bitfield",
    redisDataStructure: "bitfield",
    keyTemplate: "flags:user:{id}",
    clusterHashTagParam: "id",
    ttl: { value: 30, unit: "d" },
    bitfieldConfig: {
      fields: [
        { name: "loginCount", type: "u", bits: 16, offset: 0, overflow: "SAT" },
        { name: "tierLevel", type: "u", bits: 4, offset: 16 },
        { name: "flags", type: "u", bits: 8, offset: 20 },
      ],
    },
  },
};
