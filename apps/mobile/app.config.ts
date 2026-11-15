import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the config; this only adjusts it per EAS build profile.
 * Store builds (`production`) talk to the hosted project, so they don't need
 * the local-network permission the development build uses to reach the PC.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.EAS_BUILD_PROFILE !== 'production') return base;
  const { NSLocalNetworkUsageDescription: _dev, ...infoPlist } = base.ios?.infoPlist ?? {};
  return { ...base, ios: { ...base.ios, infoPlist } };
};
