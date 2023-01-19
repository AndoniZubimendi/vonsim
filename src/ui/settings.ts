import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Language, LANGUAGES } from "@/config";
import type { MemoryRepresentation } from "@/helpers";
import type { MemoryConfig } from "@/simulator/program";
import type { RunnerDevices } from "@/simulator/runner";

export type SettingsStore = {
  language: Language;
  setLanguage: (lang: Language) => void;

  memoryRepresentation: MemoryRepresentation;
  setMemoryRepresentation: (representation: MemoryRepresentation) => void;

  memoryOnReset: MemoryConfig;
  setMemoryOnReset: (mode: MemoryConfig) => void;

  devicesConfiguration: RunnerDevices;
  setDevicesConfiguration: (config: RunnerDevices) => void;

  cpuSpeed: string;
  setCPUSpeed: (speed: string) => void;

  printerSpeed: string;
  setPrinterSpeed: (speed: string) => void;
};

export const useSettings = create<SettingsStore>()(
  persist(
    set => ({
      language: getDefaultLanguage(),
      setLanguage: lang => set({ language: lang }),

      memoryRepresentation: "hex",
      setMemoryRepresentation: representation => set({ memoryRepresentation: representation }),

      memoryOnReset: "random",
      setMemoryOnReset: mode => set({ memoryOnReset: mode }),

      devicesConfiguration: "switches-leds",
      setDevicesConfiguration: config => set({ devicesConfiguration: config }),

      cpuSpeed: "1",
      setCPUSpeed: speed => set({ cpuSpeed: speed }),

      printerSpeed: "0.125",
      setPrinterSpeed: speed => set({ printerSpeed: speed }),
    }),
    { name: "settings", version: 0 },
  ),
);

function getDefaultLanguage(): Language {
  const lang = navigator.language.toLowerCase();
  for (const l of LANGUAGES) {
    if (lang.startsWith(l)) return l;
  }
  return "en";
}
