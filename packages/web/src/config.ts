export const env = {
  apiUrl: (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, ''),
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  GTProjectId: import.meta.env.VITE_GT_PROJECT_ID,
  GTDevApiKey: import.meta.env.DEV ? import.meta.env.VITE_GT_DEV_API_KEY : undefined
};
