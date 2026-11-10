export interface PackageFile {
  path: string;
  size: number;
  sha256: string;
}

export interface PackageVersion {
  name: string;
  version: string;
  description: string;
  main: string;
  files: PackageFile[];
  publishedAt: Date;
}
