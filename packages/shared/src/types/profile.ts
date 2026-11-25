import type { SearchPackage } from './search.ts';

export interface UserProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  imageUrl: string;
  createdAt: string;
  packages: SearchPackage[];
  total: number;
}
