import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  /** Reserved for future client-only preferences. */
  _placeholder: boolean;
  openrouterApiKey: string;
  openrouterConnected: boolean;
  setOpenrouterApiKey: (key: string) => void;
  setOpenrouterConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      _placeholder: false,
      openrouterApiKey: "",
      openrouterConnected: false,
      setOpenrouterApiKey: (key) => set({ openrouterApiKey: key }),
      setOpenrouterConnected: (connected) =>
        set({ openrouterConnected: connected }),
    }),
    {
      name: "sentinelprompt-store",
    },
  ),
);
