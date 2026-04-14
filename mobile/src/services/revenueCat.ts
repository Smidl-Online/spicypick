import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import Constants from 'expo-constants';

const RC_IOS_KEY = Constants.expoConfig?.extra?.revenueCatIosKey || '';
const RC_ANDROID_KEY = Constants.expoConfig?.extra?.revenueCatAndroidKey || '';

let isConfigured = false;
let initPromise: Promise<void> | null = null;

export async function initRevenueCat(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
    if (!apiKey) {
      console.warn('RevenueCat API key not configured for', Platform.OS);
      return;
    }

    if (isConfigured) return;

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    isConfigured = true;
  })();
  return initPromise;
}

export async function loginRevenueCat(userId: string): Promise<void> {
  await initRevenueCat();
  if (!isConfigured) return;
  await Purchases.logIn(userId);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!isConfigured) return;
  await Purchases.logOut();
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (!isConfigured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchasePremium(userId?: string): Promise<{
  sdkConfigured: boolean;
  platform: 'ios' | 'android';
  customerInfo: CustomerInfo;
} | null> {
  // Ensure SDK is initialized before checking config
  await initRevenueCat();

  if (!isConfigured) {
    // Dev fallback — no SDK configured, use stub
    return {
      sdkConfigured: false,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      customerInfo: {} as CustomerInfo,
    };
  }

  // Ensure RC is logged in as the correct user before purchase
  // to prevent entitlement being attached to anonymous RC user
  if (userId) {
    await Purchases.logIn(userId);
  }

  const offerings = await Purchases.getOfferings();
  const premiumPackage = offerings.current?.availablePackages?.[0];
  if (!premiumPackage) {
    throw new Error('No premium package available');
  }

  const { customerInfo } = await Purchases.purchasePackage(premiumPackage);

  return {
    sdkConfigured: true,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    customerInfo,
  };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  return Purchases.getCustomerInfo();
}

export async function checkPremiumStatus(): Promise<boolean> {
  await initRevenueCat();
  if (!isConfigured) return false;
  const info = await Purchases.getCustomerInfo();
  return !!info.entitlements.active['premium'];
}

export async function restorePurchases(userId?: string): Promise<CustomerInfo | null> {
  await initRevenueCat();
  if (!isConfigured) return null;
  // Ensure RC is logged in as the correct user before restore
  if (userId) {
    await Purchases.logIn(userId);
  }
  return Purchases.restorePurchases();
}

export async function checkRevenueCatConfigured(): Promise<boolean> {
  await initRevenueCat();
  return isConfigured;
}

export { isConfigured as isRevenueCatConfigured };
