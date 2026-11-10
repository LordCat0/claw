import { Pool } from 'pg';
import { maxSatisfying, rcompare } from 'semver';
import { env } from '../config.ts';
import type { PackageFile, PackageVersion } from '../types.ts';
import type { PublishBody } from '../validation.ts';

class DatabaseManager {
  pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000
    });

    this.pool.on('error', error => {
      console.error('PostgreSQL connection error', error);
    });
  }

  async initializeDatabase(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS package_versions (
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT NOT NULL,
        main TEXT NOT NULL,
        files JSONB NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (name, version)
      );
    `);
  }
  async listPackages(
    query: {
      q: string;
      limit: number;
      offset: number;
    }
  ) {
    const result = await this.pool.query<{
      name: string;
      versions: number;
    }>(`
      SELECT name, COUNT(*)::INTEGER AS versions
      FROM package_versions
      WHERE STRPOS(name, $1) > 0
      GROUP BY name
      ORDER BY name
      LIMIT $2 OFFSET $3
    `, [query.q, query.limit, query.offset]);

    return result.rows;
  }

  async getVersions(name: string) {
    const result = await this.pool.query<{ version: string }>(`
      SELECT version FROM package_versions WHERE name = $1
    `, [name]);
    const versions = result.rows.map(row => row.version).sort(rcompare);

    return {
      name,
      latest: maxSatisfying(versions, '*'),
      versions
    };
  }

  async getVersion(
    name: string,
    requestedVersion: string
  ): Promise<PackageVersion | undefined> {
    let version = requestedVersion;

    if (version === 'latest') {
      const metadata = await this.getVersions(name);

      if (!metadata.latest) {
        return undefined;
      }

      version = metadata.latest;
    }
  }

  async publishPackage(
    body: PublishBody,
    files: PackageFile[]
  ): Promise<PackageVersion | undefined> {
    const result = await this.pool.query<PackageVersion>(`
      INSERT INTO package_versions (name, version, description, main, files)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name, version) DO NOTHING
      RETURNING name, version, description, main, files,
        published_at AS "publishedAt"
    `, [
      body.name,
      body.version,
      body.description,
      body.main,
      JSON.stringify(files)
    ]);

    return result.rows[0];
  }

  async close() {
    await this.pool.end();
  }

}

export default new DatabaseManager();
