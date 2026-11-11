import { Pool } from 'pg';
import { maxSatisfying, rcompare } from 'semver';
import { env } from '../config.ts';
import type { PackageDistribution, PackageVersion } from '../types.ts';
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
        dist JSONB NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (name, version)
      );
    `);
  }
  async listPackages(
    query: {
      q: string;
      sort: 'relevance' | 'name' | 'recent';
      limit: number;
      offset: number;
    }
  ) {
    const result = await this.pool.query<{
      packages: {
        name: string;
        version: string;
        description: string;
        publishedAt: string;
        versions: number;
      }[];
      total: number;
    }>(`
      WITH summaries AS (
        SELECT DISTINCT ON (name)
          name, version, description, published_at AS "publishedAt",
          COUNT(*) OVER (PARTITION BY name)::INTEGER AS versions
        FROM package_versions
        ORDER BY name, published_at DESC, version DESC
      ), matches AS (
        SELECT * FROM summaries
        WHERE STRPOS(LOWER(name), LOWER($1)) > 0
          OR STRPOS(LOWER(description), LOWER($1)) > 0
      )
      SELECT
        (SELECT COUNT(*)::INTEGER FROM matches) AS total,
        COALESCE((
          SELECT JSON_AGG(page) FROM (
            SELECT * FROM matches
            ORDER BY
              CASE WHEN $4 = 'relevance' AND $1 <> '' THEN
                CASE
                  WHEN LOWER(name) = LOWER($1) THEN 0
                  WHEN STRPOS(LOWER(name), LOWER($1)) = 1 THEN 1
                  WHEN STRPOS(LOWER(name), LOWER($1)) > 0 THEN 2
                  ELSE 3
                END
              END,
              CASE WHEN $4 = 'recent' THEN "publishedAt" END DESC,
              name
            LIMIT $2 OFFSET $3
          ) page
        ), '[]'::JSON) AS packages
    `, [query.q, query.limit, query.offset, query.sort]);

    return result.rows[0];
  }

  async getStats() {
    const result = await this.pool.query<{
      packages: number;
      versions: number;
      lastPublishedAt: Date | null;
    }>(`
      SELECT COUNT(DISTINCT name)::INTEGER AS packages,
        COUNT(*)::INTEGER AS versions,
        MAX(published_at) AS "lastPublishedAt"
      FROM package_versions
    `);

    return result.rows[0];
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

    const result = await this.pool.query<PackageVersion>(`
      SELECT name, version, description, main, dist,
        published_at AS "publishedAt"
      FROM package_versions
      WHERE name = $1 AND version = $2
    `, [name, version]);

    return result.rows[0];
  }

  async publishPackage(
    body: PublishBody,
    dist: PackageDistribution
  ): Promise<PackageVersion | undefined> {
    const result = await this.pool.query<PackageVersion>(`
      INSERT INTO package_versions (name, version, description, main, dist)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name, version) DO NOTHING
      RETURNING name, version, description, main, dist,
        published_at AS "publishedAt"
    `, [
      body.name,
      body.version,
      body.description,
      body.main,
      JSON.stringify(dist)
    ]);

    return result.rows[0];
  }

  async close() {
    await this.pool.end();
  }

}

export default new DatabaseManager();
