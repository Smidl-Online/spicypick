import { create } from 'zustand';
import { api } from '../api/client';
import { analytics } from '../services/analytics';

type ExperimentState = {
  /** Map of experiment key → assigned variant */
  assignments: Record<string, string>;
  isLoading: boolean;

  /** Fetch all active experiment assignments from server */
  fetchExperiments: () => Promise<void>;

  /** Get variant for a specific experiment (returns null if not enrolled) */
  getVariant: (key: string) => string | null;

  /** Track a conversion event for an experiment */
  trackEvent: (
    experimentKey: string,
    eventType: string,
    eventValue?: number,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;

  /** Clear assignments (on logout) */
  reset: () => void;
};

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  assignments: {},
  isLoading: false,

  fetchExperiments: async () => {
    set({ isLoading: true });
    try {
      const data = await api<{ experiments: Record<string, string> }>(
        '/api/experiments/me',
      );
      set({ assignments: data.experiments });

      // Report experiment assignments to analytics
      for (const [key, variant] of Object.entries(data.experiments)) {
        analytics.track('$experiment_assigned', {
          experiment_key: key,
          variant,
        });
      }
    } catch {
      // Silently fail — experiments are non-critical
    } finally {
      set({ isLoading: false });
    }
  },

  getVariant: (key: string) => {
    return get().assignments[key] ?? null;
  },

  trackEvent: async (experimentKey, eventType, eventValue, metadata) => {
    try {
      await api('/api/experiments/track', {
        method: 'POST',
        body: { experimentKey, eventType, eventValue, metadata },
      });

      analytics.track('$experiment_conversion', {
        experiment_key: experimentKey,
        event_type: eventType,
        event_value: eventValue,
      });
    } catch {
      // Silently fail — tracking is non-critical
    }
  },

  reset: () => {
    set({ assignments: {} });
  },
}));
