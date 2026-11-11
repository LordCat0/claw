import { Pool } from 'pg';
import { maxSatisfying, rcompare } from 'semver';
import { env } from '../config.ts';
import type {
  PackageDistribution,
  PackageDownloads,
  PackageVersion
} from '../types.ts';
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

      CREATE TABLE IF NOT EXISTS package_downloads (
        name TEXT NOT NULL,
        day DATE NOT NULL,
        downloads BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (name, day)
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

    const page = result.rows[0];
    const downloads = await this.getDownloads(page.packages.map(pkg => pkg.name));

    return {
      ...page,
      packages: page.packages.map(pkg => ({
        ...pkg,
        downloads: downloads[pkg.name]
      }))
    };
  }

  async recordDownload(name: string) {
    await this.pool.query(`
      INSERT INTO package_downloads (name, day, downloads)
      VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE, 1)
      ON CONFLICT (name, day)
      DO UPDATE SET downloads = package_downloads.downloads + 1
    `, [name]);
  }

  async getDownloads(names: string[]): Promise<Record<string, PackageDownloads>> {
    const result = await this.pool.query<{
      name: string;
      downloads: PackageDownloads;
    }>(`
      WITH days AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE - days_ago AS day
        FROM GENERATE_SERIES(1, 7) AS series(days_ago)
      )
      SELECT package.name, JSON_BUILD_OBJECT(
        'start', TO_CHAR(MIN(days.day), 'YYYY-MM-DD'),
        'end', TO_CHAR(MAX(days.day), 'YYYY-MM-DD'),
        'total', SUM(COALESCE(counts.downloads, 0))::DOUBLE PRECISION,
        'daily', JSON_AGG(JSON_BUILD_OBJECT(
          'date', TO_CHAR(days.day, 'YYYY-MM-DD'),
          'downloads', COALESCE(counts.downloads, 0)::DOUBLE PRECISION
        ) ORDER BY days.day)
      ) AS downloads
      FROM UNNEST($1::TEXT[]) AS package(name)
      CROSS JOIN days
      LEFT JOIN package_downloads counts
        ON counts.name = package.name AND counts.day = days.day
      GROUP BY package.name
    `, [names]);

    return Object.fromEntries(result.rows.map(row => [row.name, row.downloads]));
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
