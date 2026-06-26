import React, { createContext, useContext, useState } from "react";

interface SettingsValue {
  showClock: boolean;
  setShowClock: (v: boolean) => void;
  autoCheck: boolean;
  setAutoCheck: (v: boolean) => void;
  autoPlaceXs: boolean;
  setAutoPlaceXs: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsValue>({
  showClock: true,
  setShowClock: () => {},
  autoCheck: true,
  setAutoCheck: () => {},
  autoPlaceXs: true,
  setAutoPlaceXs: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

function usePersistentToggle(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? saved === "true" : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const set = (v: boolean) => {
    setValue(v);
    try { localStorage.setItem(key, String(v)); } catch {}
  };
  return [value, set];
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [showClock, setShowClock] = usePersistentToggle("queens-setting-clock", true);
  const [autoCheck, setAutoCheck] = usePersistentToggle("queens-setting-autocheck", true);
  const [autoPlaceXs, setAutoPlaceXs] = usePersistentToggle("queens-setting-autoxs", true);

  return (
    <SettingsContext.Provider value={{ showClock, setShowClock, autoCheck, setAutoCheck, autoPlaceXs, setAutoPlaceXs }}>
      {children}
    </SettingsContext.Provider>
  );
}
