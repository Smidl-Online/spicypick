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

export async function initRevenueCat(): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
  if (!apiKey) {
    console.warn('RevenueCat API key not configured for', Platform.OS);
    return;
  }

  if (isConfigured) return;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  isConfigured = true;
}

export async function loginRevenueCat(userId: string): Promise<void> {
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

export async function purchasePremium(): Promise<{
  receipt: string;
  platform: 'ios' | 'android';
  customerInfo: CustomerInfo;
} | null> {
  if (!isConfigured) {
    // Dev fallback — no SDK configured, use stub
    return {
      receipt: 'dev-receipt',
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      customerInfo: {} as CustomerInfo,
    };
  }

  const offerings = await Purchases.getOfferings();
  const premiumPackage = offerings.current?.availablePackages?.[0];
  if (!premiumPackage) {
    throw new Error('No premium package available');
  }

  const { customerInfo } = await Purchases.purchasePackage(premiumPackage);

  // Get the receipt/transaction identifier for server validation
  const activeEntitlement = customerInfo.entitlements.active['premium'];
  const receipt = activeEntitlement?.productIdentifier || premiumPackage.product.identifier;

  return {
    receipt,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    customerInfo,
  };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  return Purchases.getCustomerInfo();
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (!isConfigured) return false;
  const info = await Purchases.getCustomerInfo();
  return !!info.entitlements.active['premium'];
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  return Purchases.restorePurchases();
}

export { isConfigured as isRevenueCatConfigured };
