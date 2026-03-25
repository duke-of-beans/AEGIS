// Minimal type shim for better-sqlite3
declare module 'better-sqlite3' {
  namespace Database {
    interface RunResult {
      changes: number
      lastInsertRowid: number | bigint
    }
    interface Statement<BindParameters extends unknown[] | {} = unknown[]> {
      run(...params: unknown[]): RunResult
      get(...params: unknown[]): unknown
      all(...params: unknown[]): unknown[]
    }
    interface Transaction<T extends unknown[] = unknown[]> {
      (...args: T): unknown
    }
    interface Database {
      prepare(sql: string): Statement
      exec(sql: string): this
      pragma(pragma: string, options?: { simple?: boolean }): unknown
      transaction<T extends unknown[]>(fn: (...args: T) => unknown): Transaction<T>
      close(): void
    }
    interface Options {
      readonly?: boolean
      fileMustExist?: boolean
      timeout?: number
    }
  }
  interface DatabaseConstructor {
    new (filename: string, options?: Database.Options): Database.Database
    (filename: string, options?: Database.Options): Database.Database
  }
  const Database: DatabaseConstructor
  export = Database
}
