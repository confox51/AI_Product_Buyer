import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

export async function query(
  sqlText: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> {
  return getSql().query(sqlText, params) as Promise<Record<string, unknown>[]>;
}

export async function initializeSchema() {
  const schemaPath = path.join(process.cwd(), "src", "lib", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await getSql().query(statement);
  }
}
