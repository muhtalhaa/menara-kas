import { readdir, readFile } from "fs/promises";
import path from "path";
import net from "net";
import { config } from "dotenv";

// #region agent log
function dbg(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
  runId = "migrate-pre",
) {
  fetch("http://127.0.0.1:7781/ingest/d35a0775-6e2e-4a93-8aff-902f1fd6c803", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "cb7416",
    },
    body: JSON.stringify({
      sessionId: "cb7416",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function parseDbUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, ""),
      username: u.username,
      hasPassword: Boolean(u.password),
    };
  } catch {
    return null;
  }
}

function probeTcp(host: string, port: number, timeoutMs = 1500) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "TIMEOUT" });
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve({ ok: true });
    });
    socket.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.code || err.message });
    });
  });
}
// #endregion

// dotenv default tidak menimpa env yang sudah ada; .env.local harus menang
const preexistingPort = process.env.DATABASE_URL
  ? parseDbUrl(process.env.DATABASE_URL)?.port ?? null
  : null;
config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

async function migrate() {
  // #region agent log
  const parsedAfter = process.env.DATABASE_URL
    ? parseDbUrl(process.env.DATABASE_URL)
    : null;
  dbg(
    "B",
    "db-migrate.ts:env",
    "DATABASE_URL after override",
    {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      preexistingPort,
      afterOverridePort: parsedAfter?.port ?? null,
      afterOverrideHost: parsedAfter?.hostname ?? null,
      overridden: preexistingPort !== (parsedAfter?.port ?? null),
    },
    "post-fix",
  );
  // #endregion

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL belum diisi. Salin .env.example ke .env.local lalu isi koneksi PostgreSQL.",
    );
  }

  const parsed = parseDbUrl(process.env.DATABASE_URL);
  if (!parsed) {
    throw new Error(
      "DATABASE_URL tidak valid. Contoh: postgresql://postgres:postgres@127.0.0.1:5432/menara_kas",
    );
  }

  if (parsed.port === "3000") {
    throw new Error(
      "DATABASE_URL mengarah ke port 3000 (biasanya Next.js), bukan PostgreSQL. Perbaiki ke port 5432 di .env.local.",
    );
  }

  // #region agent log
  const probeLocalhost = await probeTcp(parsed.hostname, Number(parsed.port));
  const probeIpv4 = await probeTcp("127.0.0.1", Number(parsed.port));
  dbg(
    "A",
    "db-migrate.ts:probe-localhost",
    "TCP probe to DATABASE_URL host",
    {
      host: parsed.hostname,
      port: parsed.port,
      ...probeLocalhost,
    },
    "post-fix",
  );
  dbg(
    "D",
    "db-migrate.ts:probe-127",
    "TCP probe to 127.0.0.1 (IPv4)",
    {
      host: "127.0.0.1",
      port: parsed.port,
      ...probeIpv4,
    },
    "post-fix",
  );
  // #endregion

  if (!probeLocalhost.ok && !probeIpv4.ok) {
    throw new Error(
      `PostgreSQL tidak menerima koneksi di ${parsed.hostname}:${parsed.port} (${probeLocalhost.error || probeIpv4.error}). Pasang PostgreSQL lalu buat database menara_kas. Contoh: winget install PostgreSQL.PostgreSQL.16`,
    );
  }

  const { pool } = await import("../lib/db/client");

  const dir = path.join(process.cwd(), "lib", "db", "migrations");
  const files = (await readdir(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  // #region agent log
  dbg(
    "B",
    "db-migrate.ts:before-connect",
    "About to pool.connect()",
    {
      migrationFileCount: files.length,
      files,
      port: parsed.port,
    },
    "post-fix",
  );
  // #endregion

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const file of files) {
      const already = await client.query<{ id: string }>(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [file],
      );
      if (already.rows.length > 0) {
        continue;
      }

      const sql = await readFile(path.join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        process.stdout.write(`Migrasi diterapkan: ${file}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    // #region agent log
    dbg(
      "A",
      "db-migrate.ts:success",
      "Migrations applied successfully",
      { ok: true, port: parsed.port },
      "post-fix",
    );
    // #endregion

    process.stdout.write("Migrasi selesai.\n");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  // #region agent log
  const errObj =
    error && typeof error === "object"
      ? (error as {
          message?: string;
          code?: string;
          errno?: string;
          address?: string;
          port?: number;
          syscall?: string;
        })
      : {};
  dbg(
    "A",
    "db-migrate.ts:catch",
    "migrate() failed",
    {
      message: errObj.message || String(error),
      code: errObj.code ?? null,
      errno: errObj.errno ?? null,
      address: errObj.address ?? null,
      port: errObj.port ?? null,
      syscall: errObj.syscall ?? null,
    },
    "post-fix",
  );
  // #endregion

  const message =
    error instanceof Error
      ? error.message ||
        ("code" in error
          ? `Koneksi PostgreSQL gagal (${String((error as { code?: string }).code)}). Pastikan PostgreSQL berjalan dan DATABASE_URL benar.`
          : String(error))
      : String(error);
  const finalMessage =
    message.trim().length > 0
      ? message
      : "Koneksi PostgreSQL gagal. Pastikan PostgreSQL berjalan di localhost:5432 dan DATABASE_URL di .env.local benar.";
  process.stderr.write(`Migrasi gagal: ${finalMessage}\n`);
  process.exitCode = 1;
});
