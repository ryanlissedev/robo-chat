import { getAllModels } from '@/lib/models';
import type { ModelConfig } from '@/lib/models/types';

export interface ModelConfiguration {
  modelConfig: ModelConfig;
  isGPT5Model: boolean;
  isReasoningCapable: boolean;
  modelSupportsFileSearchTools: boolean;
}

/**
 * Service for handling model configuration and capabilities
 */
export class ModelConfigurationService {
  /**
   * Resolve model ID (handle model aliases)
   */
  static resolveModelId(model: string): string {
    return model === 'gpt-4o-mini' ? 'gpt-5-mini' : model;
  }

  /**
   * Get comprehensive model configuration
   */
  static async getModelConfiguration(
    resolvedModel: string,
    originalModel: string
  ): Promise<ModelConfiguration> {
    const allModels = await getAllModels();
    const modelConfig = allModels.find((m) => m.id === resolvedModel);

    if (!modelConfig?.apiSdk) {
      throw new Error(`Model ${originalModel} not found`);
    }

    const isGPT5Model = resolvedModel.startsWith('gpt-5');
    const isReasoningCapable = Boolean(modelConfig?.reasoningText);
    const modelSupportsFileSearchTools = Boolean(
      (modelConfig as { fileSearchTools?: boolean })?.fileSearchTools
    );

    return {
      modelConfig,
      isGPT5Model,
      isReasoningCapable,
      modelSupportsFileSearchTools,
    };
  }

  /**
   * Calculate effective settings for GPT-5 models
   */
  static calculateEffectiveSettings(
    reasoningEffort: string,
    verbosity: string,
    isGPT5Model: boolean
  ) {
    let effectiveReasoningEffort = reasoningEffort;
    let effectiveVerbosity = verbosity;

    if (isGPT5Model) {
      effectiveReasoningEffort =
        reasoningEffort === 'medium' ? 'low' : reasoningEffort;
      effectiveVerbosity = verbosity === 'medium' ? 'low' : verbosity;
    }

    return {
      reasoningEffort: effectiveReasoningEffort,
      verbosity: effectiveVerbosity,
    };
  }

  /**
   * Check if model supports specific features
   */
  static supportsFeature(
    modelConfig: ModelConfiguration,
    feature: 'reasoning' | 'fileSearch' | 'streaming'
  ): boolean {
    switch (feature) {
      case 'reasoning':
        return modelConfig.isReasoningCapable;
      case 'fileSearch':
        return modelConfig.modelSupportsFileSearchTools;
      case 'streaming':
        return true; // Most models support streaming
      default:
        return false;
    }
  }

  /**
   * Get model-specific settings
   */
  static getModelSettings(
    modelConfig: ModelConfiguration,
    reasoningEffort: string,
    verbosity?: string,
    reasoningSummary?: 'auto' | 'detailed'
  ) {
    return {
      enableSearch: false, // Vector-store only: do not enable provider-level web search
      reasoningEffort,
      verbosity,
      reasoningSummary,
      headers: modelConfig.isReasoningCapable
        ? {
            'X-Reasoning-Effort': reasoningEffort,
            ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
          }
        : undefined,
    };
  }
}
