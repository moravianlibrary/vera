// Browser configuration, parsed once from Vite's public environment. Never holds secrets.

import { z } from "zod";

// Emulated identities for the mock API; `make frontend-user` switches between them.
export const mockUserProfiles = [
  "admin",
  "curator",
  "digitization",
  "staff",
  "reader",
  "no-access",
  "project-user",
] as const;
export type MockUserProfile = (typeof mockUserProfiles)[number];

// What the mock does wrong on purpose, to see the error pages and states.
export const mockFaults = ["none", "unavailable", "data", "slow"] as const;
export type MockFault = (typeof mockFaults)[number];

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default("/api"),
  VITE_API_MODE: z.enum(["mock", "live"]).default("mock"),
  VITE_DEFAULT_LOCALE: z.string().default("cs"),
  VITE_MOCK_USER: z.enum(mockUserProfiles).default("curator"),
  VITE_MOCK_FAULT: z.enum(mockFaults).default("none"),
  // How many times the mock repeats its fixture documents, to try lists at volume.
  VITE_MOCK_DOCUMENT_COPIES: z.coerce.number().int().min(1).max(500).default(1),
});

export const env = envSchema.parse(import.meta.env);
