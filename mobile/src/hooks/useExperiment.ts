import { useCallback } from 'react';
import { useExperimentStore } from '../store/experimentStore';

/**
 * Hook to read an experiment variant and track conversions.
 *
 * Usage:
 *   const { variant, trackConversion } = useExperiment('reveal_animation');
 *   if (variant === 'variant_a') { ... }
 *   trackConversion('tap_reveal');
 */
export function useExperiment(experimentKey: string) {
  const variant = useExperimentStore((s) => s.assignments[experimentKey] ?? null);
  const trackEvent = useExperimentStore((s) => s.trackEvent);

  const trackConversion = useCallback(
    (eventType: string, eventValue?: number, metadata?: Record<string, unknown>) => {
      trackEvent(experimentKey, eventType, eventValue, metadata);
    },
    [experimentKey, trackEvent],
  );

  return {
    variant,
    enrolled: variant !== null,
    trackConversion,
  };
}
