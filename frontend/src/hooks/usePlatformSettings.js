import { useState, useEffect } from 'react';
import { subscribeToPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '../services/settingsService';

export function usePlatformSettings() {
  const [settings, setSettings] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((data) => {
      setSettings(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { settings, loading };
}
