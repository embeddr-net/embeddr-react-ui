import { useEffect, useState } from "react";

const SETTINGS_STORE_KEY = "embeddr-client-settings";
const LEGACY_PLUGIN_SETTINGS_KEY = "zen-plugin-settings";

const readPluginSetting = <T>(
  pluginId: string,
  key: string,
  defaultValue: T,
): T => {
  try {
    const storeRaw = localStorage.getItem(SETTINGS_STORE_KEY);
    if (storeRaw) {
      const parsed = JSON.parse(storeRaw);
      const storePluginSettings = parsed?.state?.pluginSettings;
      const fromStore = storePluginSettings?.[pluginId]?.[key];
      if (fromStore !== undefined) return fromStore as T;
    }

    const legacyRaw = localStorage.getItem(LEGACY_PLUGIN_SETTINGS_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      const fromLegacy = legacyParsed?.[pluginId]?.[key];
      if (fromLegacy !== undefined) return fromLegacy as T;
    }

    return defaultValue;
  } catch {
    return defaultValue;
  }
};

// Helper hook to read plugin settings
export const usePluginSetting = <T>(
  pluginId: string,
  key: string,
  defaultValue: T,
): T => {
  const [value, setValue] = useState<T>(() =>
    readPluginSetting(pluginId, key, defaultValue),
  );

  useEffect(() => {
    const handleStorage = () => {
      setValue(readPluginSetting(pluginId, key, defaultValue));
    };

    window.addEventListener("local-storage", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("local-storage", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [pluginId, key, defaultValue]);

  return value;
};
