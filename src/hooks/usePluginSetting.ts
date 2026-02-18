import { useEffect, useState } from "react";

// Helper hook to read plugin settings
export const usePluginSetting = <T>(
  pluginId: string,
  key: string,
  defaultValue: T,
): T => {
  const [value, setValue] = useState<T>(() => {
    try {
      const allSettings = JSON.parse(
        localStorage.getItem("zen-plugin-settings") || "{}",
      );
      return allSettings[pluginId]?.[key] ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const allSettings = JSON.parse(
          localStorage.getItem("zen-plugin-settings") || "{}",
        );
        const newValue = allSettings[pluginId]?.[key] ?? defaultValue;
        setValue(newValue);
      } catch {}
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
