import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme/ThemeContext';
import { api } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'spicypick_onboarding_done';

type Slide = {
  icon: string;
  titleKey: string;
  subtitleKey: string;
  isPremium?: boolean;
};

const SLIDES: Slide[] = [
  { icon: '🌶️', titleKey: 'onboarding.slide1_title', subtitleKey: 'onboarding.slide1_subtitle' },
  { icon: '🗳️', titleKey: 'onboarding.slide2_title', subtitleKey: 'onboarding.slide2_subtitle' },
  { icon: '🏆', titleKey: 'onboarding.slide3_title', subtitleKey: 'onboarding.slide3_subtitle' },
  { icon: '⭐', titleKey: 'onboarding.slide4_title', subtitleKey: 'onboarding.slide4_subtitle', isPremium: true },
];

async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
  await api('/api/users/me/onboarding-complete', { method: 'POST' }).catch(() => {});
}

export async function shouldShowOnboarding(onboardingCompleted: boolean): Promise<boolean> {
  if (onboardingCompleted) return false;
  const local = await AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null);
  return local !== 'true';
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  };

  const goToSlide = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
    setCurrentIndex(idx);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await markOnboardingDone();
    await fetchProfile();
    router.replace('/(tabs)');
  };

  const isLast = currentIndex === SLIDES.length - 1;
  const isPremiumSlide = SLIDES[currentIndex]?.isPremium;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Skip button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{slide.icon}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{t(slide.titleKey)}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t(slide.subtitleKey)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, idx) => (
          <TouchableOpacity key={idx} onPress={() => goToSlide(idx)}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: idx === currentIndex ? colors.primary : colors.border,
                  width: idx === currentIndex ? 20 : 8,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom buttons */}
      <View style={styles.footer}>
        {isPremiumSlide ? (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleFinish}
            >
              <Text style={styles.primaryButtonText}>{t('onboarding.get_started')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleFinish}>
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>{t('onboarding.slide4_skip')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>
              {isLast ? t('onboarding.get_started') : t('onboarding.next')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
    paddingBottom: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  icon: {
    fontSize: 80,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
  },
});
