import { Pool, type PoolClient, type QueryResultRow } from "pg";

type GlobalPool = typeof globalThis & {
  __menaraKasPool?: Pool;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL belum diisi. Salin .env.example ke .env.local lalu isi koneksi PostgreSQL.",
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 10,
  });
}

const globalPool = globalThis as GlobalPool;

export const pool: Pool = globalPool.__menaraKasPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalPool.__menaraKasPool = pool;
}

export type Queryable = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
