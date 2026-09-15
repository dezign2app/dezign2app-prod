declare module "node:sqlite" {
  export type SqliteBindValue =
    | string
    | number
    | bigint
    | boolean
    | null
    | Uint8Array;

  export interface SqliteRunResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    all(...params: SqliteBindValue[]): Record<string, SqliteBindValue>[];
    get(...params: SqliteBindValue[]): Record<string, SqliteBindValue> | undefined;
    run(...params: SqliteBindValue[]): SqliteRunResult;
    iterate(
      ...params: SqliteBindValue[]
    ): IterableIterator<Record<string, SqliteBindValue>>;
  }

  export interface DatabaseSyncOptions {
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
    enableDoubleQuotedStringLiterals?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
