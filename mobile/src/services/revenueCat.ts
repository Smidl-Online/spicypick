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

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    isConfigured = true;
  })();

  return initPromise;
}

export async function loginRevenueCat(userId: string): Promise<void> {
  // Ensure init completes before login — handles cold start race when
  // the [user.id] effect fires before the mount effect calls initRevenueCat()
  await initRevenueCat();
  if (!isConfigured) return;
  await Purchases.logIn(userId);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!isConfigured) return;
  await Purchases.logOut();
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  await initRevenueCat();
  if (!isConfigured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchasePremium(): Promise<{
  sdkConfigured: boolean;
  platform: 'ios' | 'android';
  customerInfo: CustomerInfo;
} | null> {
  // Ensure init completes before checking isConfigured — handles race when
  // user opens Premium screen before async init finishes
  await initRevenueCat();

  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  if (!isConfigured) {
    // Dev fallback — no SDK key configured for this platform
    return {
      sdkConfigured: false,
      platform,
      customerInfo: {} as CustomerInfo,
    };
  }

  const offerings = await Purchases.getOfferings();
  const premiumPackage = offerings.current?.availablePackages?.[0];
  if (!premiumPackage) {
    throw new Error('No premium package available');
  }

  // RevenueCat SDK automatically sends the receipt to RC servers upon purchase.
  // No need to extract a receipt — the backend queries RC API via GET /status.
  const { customerInfo } = await Purchases.purchasePackage(premiumPackage);

  return {
    sdkConfigured: true,
    platform,
    customerInfo,
  };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  await initRevenueCat();
  if (!isConfigured) return null;
  return Purchases.getCustomerInfo();
}

export async function checkPremiumStatus(): Promise<boolean> {
  await initRevenueCat();
  if (!isConfigured) return false;
  const info = await Purchases.getCustomerInfo();
  return !!info.entitlements.active['premium'];
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  await initRevenueCat();
  if (!isConfigured) return null;
  return Purchases.restorePurchases();
}

export { isConfigured as isRevenueCatConfigured };
