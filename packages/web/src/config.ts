export const env = {
  apiUrl: (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, ''),
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
};
