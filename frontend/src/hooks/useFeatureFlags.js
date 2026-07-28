import { useState, useEffect } from 'react';
import { subscribeToPlatformSettings, fetchFeatureConfig, DEFAULT_PLATFORM_SETTINGS } from '../services/settingsService';

export function useFeatureFlags() {
  const [featureFlags, setFeatureFlags] = useState({
    vendor_enabled: true,
    vendorSellingEnabled: true,
    vendorRegistrationEnabled: true,
    loading: true,
  });

  useEffect(() => {
    let unsub = () => {};

    // 1. Initial backend feature config fetch
    fetchFeatureConfig()
      .then((cfg) => {
        const isVendorEnabled = (
          cfg.vendor_enabled !== false &&
          cfg.vendorSellingEnabled !== false &&
          cfg.vendorRegistrationEnabled !== false
        );
        setFeatureFlags({
          vendor_enabled: isVendorEnabled,
          vendorSellingEnabled: cfg.vendorSellingEnabled !== false,
          vendorRegistrationEnabled: cfg.vendorRegistrationEnabled !== false,
          loading: false,
        });

        // 2. Realtime listener fallback/sync
        unsub = subscribeToPlatformSettings((data) => {
          const fsData = data || DEFAULT_PLATFORM_SETTINGS;
          const fsVendorEnabled = (
            fsData.vendor_enabled !== false &&
            fsData.vendorSellingEnabled !== false &&
            fsData.vendorRegistrationEnabled !== false
          );
          setFeatureFlags({
            vendor_enabled: fsVendorEnabled,
            vendorSellingEnabled: fsData.vendorSellingEnabled !== false,
            vendorRegistrationEnabled: fsData.vendorRegistrationEnabled !== false,
            loading: false,
          });
        });
      })
      .catch((err) => {
        console.warn('[useFeatureFlags] Error fetching feature config:', err);
        setFeatureFlags(prev => ({ ...prev, loading: false }));
      });

    return () => unsub();
  }, []);

  return featureFlags;
}
