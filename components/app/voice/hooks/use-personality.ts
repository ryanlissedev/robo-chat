'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPersonalityConfig,
  getPersonalityModes,
} from '../config/personality-configs';
import {
  type PersonalityManager,
  personalityManager,
} from '../config/personality-manager';
import type {
  PersonalityConfig,
  PersonalityEvent,
  PersonalityEventType,
  PersonalityMode,
  VoicePersonalitySettings,
} from '../config/personality-types';
import { useVoiceStore } from '../store/voice-store';

interface UsePersonalityOptions {
  enableAutoSwitch?: boolean;
  enableEventLogging?: boolean;
  customManager?: PersonalityManager;
}

interface PersonalityHookState {
  currentMode: PersonalityMode;
  currentConfig: PersonalityConfig;
  availableModes: PersonalityMode[];
  settings: VoicePersonalitySettings;
  isLoading: boolean;
  error: Error | null;
}

export function usePersonality(options: UsePersonalityOptions = {}) {
  const {
    enableAutoSwitch = false,
    enableEventLogging = true,
    customManager,
  } = options;

  const manager = customManager || personalityManager;
  const { sessionId, currentTranscript, config: voiceConfig } = useVoiceStore();

  const [state, setState] = useState<PersonalityHookState>({
    currentMode: manager.getSettings().currentMode,
    currentConfig: manager.getCurrentPersonality(),
    availableModes: getPersonalityModes(),
    settings: manager.getSettings(),
    isLoading: false,
    error: null,
  });

  // Update state when manager changes
  const updateState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentMode: manager.getSettings().currentMode,
      currentConfig: manager.getCurrentPersonality(),
      settings: manager.getSettings(),
    }));
  }, [manager]);

  // Switch personality mode
  const switchPersonality = useCallback(
    async (
      newMode: PersonalityMode,
      reason: string = 'User selection'
    ): Promise<boolean> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const success = manager.switchPersonality(newMode, reason);

        if (success) {
          updateState();

          // Update voice store with new personality configuration
          const newConfig = getPersonalityConfig(newMode);
          useVoiceStore.getState().updateConfig({
            voice: newConfig.voiceSettings.voice,
          });

          if (enableEventLogging) {
          }
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        return success;
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error('Failed to switch personality');
        setState((prev) => ({ ...prev, isLoading: false, error: err }));
        return false;
      }
    },
    [manager, updateState, enableEventLogging]
  );

  // Get personality recommendations based on context
  const getPersonalityRecommendation = useCallback(
    (context: string): PersonalityMode | null => {
      return manager.suggestPersonalitySwitch(context);
    },
    [manager]
  );

  // Auto-switch personality based on transcript content
  const handleAutoSwitch = useCallback(
    (transcript: string) => {
      if (!enableAutoSwitch || !transcript) return;

      const recommendation = getPersonalityRecommendation(transcript);
      if (recommendation && recommendation !== state.currentMode) {
        switchPersonality(
          recommendation,
          'Auto-switch based on content analysis'
        );
      }
    },
    [
      enableAutoSwitch,
      getPersonalityRecommendation,
      state.currentMode,
      switchPersonality,
    ]
  );

  // Generate voice instructions
  const generateVoiceInstructions = useCallback(
    (customContext?: string): string => {
      return manager.generateVoiceInstructions(customContext);
    },
    [manager]
  );

  // Safety protocol management
  const triggerSafetyProtocol = useCallback(
    (
      protocolName: string,
      severity: 'low' | 'medium' | 'high' | 'critical',
      details: Record<string, unknown> = {}
    ) => {
      manager.triggerSafetyProtocol(protocolName, severity, details);
    },
    [manager]
  );

  // Request confirmation for actions
  const requestConfirmation = useCallback(
    async (
      action: string,
      riskLevel: 'low' | 'medium' | 'high'
    ): Promise<boolean> => {
      return manager.requestConfirmation(action, riskLevel);
    },
    [manager]
  );

  // Update settings
  const updateSettings = useCallback(
    (updates: Partial<VoicePersonalitySettings>) => {
      manager.updateSettings(updates);
      updateState();
    },
    [manager, updateState]
  );

  // Session management
  const startPersonalitySession = useCallback(() => {
    manager.recordSessionStart();
  }, [manager]);

  const endPersonalitySession = useCallback(
    (duration: number, userRating?: number) => {
      manager.recordSessionEnd(duration, userRating);
    },
    [manager]
  );

  const recordQuestion = useCallback(
    (question: string) => {
      manager.recordQuestion(question);
    },
    [manager]
  );

  // Event handling
  const addEventListener = useCallback(
    (
      eventType: PersonalityEventType,
      listener: (event: PersonalityEvent) => void
    ) => {
      manager.addEventListener(eventType, listener);
    },
    [manager]
  );

  const removeEventListener = useCallback(
    (
      eventType: PersonalityEventType,
      listener: (event: PersonalityEvent) => void
    ) => {
      manager.removeEventListener(eventType, listener);
    },
    [manager]
  );

  // Metrics and analytics
  const getMetrics = useCallback(
    (mode?: PersonalityMode) => {
      return manager.getPersonalityMetrics(mode);
    },
    [manager]
  );

  const getTransitionHistory = useCallback(() => {
    return manager.getTransitionHistory();
  }, [manager]);

  const getEventHistory = useCallback(
    (eventType?: PersonalityEventType) => {
      return manager.getEventHistory(eventType);
    },
    [manager]
  );

  // Export/Import settings
  const exportSettings = useCallback(() => {
    return manager.exportSettings();
  }, [manager]);

  const importSettings = useCallback(
    (data: string) => {
      const success = manager.importSettings(data);
      if (success) {
        updateState();
      }
      return success;
    },
    [manager, updateState]
  );

  // Memoized derived values
  const personalityFeatures = useMemo(
    () => state.currentConfig.features,
    [state.currentConfig]
  );
  const audioSettings = useMemo(
    () => state.currentConfig.audioSettings,
    [state.currentConfig]
  );
  const voiceSettings = useMemo(
    () => state.currentConfig.voiceSettings,
    [state.currentConfig]
  );

  // Auto-switch effect
  useEffect(() => {
    if (currentTranscript && enableAutoSwitch) {
      handleAutoSwitch(currentTranscript);
    }
  }, [currentTranscript, enableAutoSwitch, handleAutoSwitch]);

  // Voice config sync effect
  useEffect(() => {
    const config = state.currentConfig;
    if (voiceConfig && state.currentMode) {
      useVoiceStore.getState().updateConfig({
        voice: config.voiceSettings.voice,
      });
    }
  }, [state.currentMode, state.currentConfig, voiceConfig]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clean up any pending operations or listeners
    };
  }, []);

  return {
    // Current state
    currentMode: state.currentMode,
    currentConfig: state.currentConfig,
    availableModes: state.availableModes,
    settings: state.settings,
    isLoading: state.isLoading,
    error: state.error,

    // Derived values
    personalityFeatures,
    audioSettings,
    voiceSettings,

    // Actions
    switchPersonality,
    updateSettings,
    generateVoiceInstructions,
    getPersonalityRecommendation,

    // Safety and confirmation
    triggerSafetyProtocol,
    requestConfirmation,

    // Session management
    startPersonalitySession,
    endPersonalitySession,
    recordQuestion,

    // Event system
    addEventListener,
    removeEventListener,

    // Analytics
    getMetrics,
    getTransitionHistory,
    getEventHistory,

    // Import/Export
    exportSettings,
    importSettings,

    // Utility functions
    isPersonalityMode: (mode: string): mode is PersonalityMode => {
      return state.availableModes.includes(mode as PersonalityMode);
    },

    getPersonalityByMode: (mode: PersonalityMode) => {
      return getPersonalityConfig(mode);
    },

    canSwitchPersonality: () => !state.isLoading,

    requiresConfirmation: (
      _action: string,
      riskLevel: 'low' | 'medium' | 'high'
    ) => {
      return personalityFeatures.requiresConfirmation && riskLevel !== 'low';
    },

    shouldShowWarnings: () => personalityFeatures.includesWarnings,

    isEncouraging: () => personalityFeatures.isEncouraging,

    usesTechnicalTerminology: () =>
      personalityFeatures.usesTechnicalTerminology,

    emphasizesSafety: () => personalityFeatures.emphasizesSafety,
  };
}

// Specialized hooks for specific use cases
export function usePersonalityFeatures() {
  const { personalityFeatures } = usePersonality();
  return personalityFeatures;
}

export function usePersonalitySwitcher() {
  const {
    switchPersonality,
    currentMode,
    availableModes,
    isLoading,
    canSwitchPersonality,
  } = usePersonality();
  return {
    switchPersonality,
    currentMode,
    availableModes,
    isLoading,
    canSwitchPersonality,
  };
}

export function usePersonalityInstructions() {
  const { generateVoiceInstructions, currentConfig } = usePersonality();
  return { generateVoiceInstructions, currentConfig };
}

export function usePersonalitySafety() {
  const {
    triggerSafetyProtocol,
    requestConfirmation,
    requiresConfirmation,
    shouldShowWarnings,
    emphasizesSafety,
  } = usePersonality();

  return {
    triggerSafetyProtocol,
    requestConfirmation,
    requiresConfirmation,
    shouldShowWarnings,
    emphasizesSafety,
  };
}
