import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";

// El registro público se cierra por defecto: la app es privada y los usuarios
// se crean por seed/script. Habilitarlo explícitamente con ALLOW_PUBLIC_SIGNUP=true.
export const allowPublicSignup = process.env.ALLOW_PUBLIC_SIGNUP === "true";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        required: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: !allowPublicSignup,
  },
});

export type Auth = typeof auth;
