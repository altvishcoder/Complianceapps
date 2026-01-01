import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/betterauth",
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
} = authClient;
