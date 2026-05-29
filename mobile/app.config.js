// Dynamic Expo config — extends app.json with environment-specific overrides.
// Legal document URLs default to production but can be overridden for staging/dev:
//   EXPO_PUBLIC_API_URL=https://staging.spicypick.app npx expo start
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://spicypick.app';

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    privacyPolicyUrl: `${BASE_URL}/privacy`,
    termsOfServiceUrl: `${BASE_URL}/terms`,
  },
});
