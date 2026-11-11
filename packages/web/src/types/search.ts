export interface SearchPackage {
  name: string;
  description: string;
  version: string;
  publishedAt: string;
  versions: number;
}

export interface SearchResponse {
  packages: SearchPackage[];
  total: number;
}
