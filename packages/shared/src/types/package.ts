export interface PackageDistribution {
  tarball: string;
  integrity: string;
  size: number;
}

export interface PackageVersion {
  name: string;
  version: string;
  description: string;
  main: string;
  readme: string;
  license: string;
  repository: string;
  homepage: string;
  keywords: string[];
  dependencies: Record<string, string>;
  publisherId: string | null;
  dist: PackageDistribution;
  publishedAt: Date;
}

export interface PackageDownloads {
  start: string;
  end: string;
  total: number;
  daily: {
    date: string;
    downloads: number;
  }[];
}

export interface PackageMetadata {
  name: string;
  version: string;
  latest: string;
  description: string;
  readme: string;
  license: string;
  repository: string;
  homepage: string;
  keywords: string[];
  dependencies: Record<string, string>;
  dependencyCount: number;
  dependentCount: number;
  versionCount: number;
  visibility: string;
  publishedAt: string;
  lastPublishedAt: string;
  releases: {
    version: string;
    publishedAt: string;
  }[];
  collaborators: {
    id: string;
    username: string | null;
    fullName: string | null;
    imageUrl: string;
  }[];
  downloads: PackageDownloads;
}

export interface PackageFilesResponse {
  name: string;
  version: string;
  files: Record<string, string>;
}

export interface PackageDependentsResponse {
  total: number;
  packages: {
    name: string;
    version: string;
    description: string;
    publishedAt: string;
  }[];
}
