// Clerk's types are broken so we provide our own.

import type { Request, RequestHandler } from 'express';

export function clerkMiddleware(): RequestHandler;

export function getAuth(request: Request): {
  isAuthenticated: boolean;
  userId: string | null;
};

export const clerkClient: {
  users: {
    getUserList(params?: {
      userId?: string[];
      limit?: number;
    }): Promise<{
      data: {
        id: string;
        username: string | null;
        fullName: string | null;
        imageUrl: string;
      }[];
      totalCount: number;
    }>;
  };
};
