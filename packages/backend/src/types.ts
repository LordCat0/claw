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
  dist: PackageDistribution;
  publishedAt: Date;
}
