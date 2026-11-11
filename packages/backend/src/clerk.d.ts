import type { Request, RequestHandler } from 'express';

export function clerkMiddleware(): RequestHandler;

export function getAuth(request: Request): {
  isAuthenticated: boolean;
};
