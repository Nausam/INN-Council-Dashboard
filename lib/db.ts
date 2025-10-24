import Database from "better-sqlite3";
import path from "node:path";

let _db: Database.Database | null = null;

export function getDb() {
  if (_db) return _db;
  const dbPath = path.join(process.cwd(), "data", "salat.db"); // <— path you showed
  _db = new Database(dbPath, { readonly: true, fileMustExist: true });
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  return _db;
}
