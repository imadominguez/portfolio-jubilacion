"use client";

import type { Auth } from "@/lib/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Sin NEXT_PUBLIC_APP_URL, Better Auth usa window.location.origin. Un fallback
// fijo a :3000 mandaba el login a otro proyecto cuando el dev server corría en
// otro puerto.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
