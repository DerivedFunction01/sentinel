/**
 * SentinelPrompt — Client-side persistent store.
 *
 * Currently minimal — auth is handled by NextAuth + Prisma. Reserved for
 * future client-only UI preferences.
 */
import { create } from "zustand";

interface AppState {
  /** Reserved for future client-only preferences. */
  _placeholder: boolean;
}

export const useAppStore = create<AppState>()(() => ({
  _placeholder: false,
}));
