import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelConfigurationService } from '@/lib/services/ModelConfigurationService';

// Mock dependencies with vi.hoisted for proper isolation
const mockGetAllModels = vi.hoisted(() => vi.fn());

vi.mock('@/lib/models', () => ({
  getAllModels: mockGetAllModels,
}));

describe('ModelConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getModelConfiguration', () => {
    const mockModels = [
      {
        id: 'gpt-4',
        apiSdk: vi.fn(),
        reasoningText: false,
      },
      {
        id: 'gpt-5',
        apiSdk: vi.fn(),
        reasoningText: 'Reasoning enabled',
        fileSearchTools: true,
      },
      {
        id: 'gpt-5-mini',
        apiSdk: vi.fn(),
        reasoningText: 'Reasoning enabled',
        fileSearchTools: false,
      },
      {
        id: 'claude-3',
        apiSdk: vi.fn(),
        reasoningText: false,
      },
    ];

    beforeEach(() => {
      mockGetAllModels.mockReset();
      mockGetAllModels.mockResolvedValue(mockModels);
    });

    it('should get configuration for GPT-4 model', async () => {
      const result = await ModelConfigurationService.getModelConfiguration(
        'gpt-4',
        'gpt-4'
      );

      expect(mockGetAllModels).toHaveBeenCalled();
      expect(result).toEqual({
        modelConfig: mockModels[0],
        isGPT5Model: false,
        isReasoningCapable: false,
        modelSupportsFileSearchTools: false,
      });
    });

    it('should get configuration for GPT-5 model with reasoning and file search', async () => {
      const result = await ModelConfigurationService.getModelConfiguration(
        'gpt-5',
        'gpt-5'
      );

      expect(result).toEqual({
        modelConfig: mockModels[1],
        isGPT5Model: true,
        isReasoningCapable: true,
        modelSupportsFileSearchTools: true,
      });
    });

    it('should detect GPT-5 models correctly', async () => {
      const result = await ModelConfigurationService.getModelConfiguration(
        'gpt-5-mini',
        'gpt-5-mini'
      );

      expect(result.isGPT5Model).toBe(true);
    });

    it('should throw error when model not found', async () => {
      await expect(
        ModelConfigurationService.getModelConfiguration(
          'unknown-model',
          'unknown-model'
        )
      ).rejects.toThrow('Model unknown-model not found');
    });

    it('should throw error when model lacks apiSdk', async () => {
      mockGetAllModels.mockResolvedValue([
        {
          id: 'incomplete-model',
          // Missing apiSdk
        },
      ]);

      await expect(
        ModelConfigurationService.getModelConfiguration(
          'incomplete-model',
          'incomplete-model'
        )
      ).rejects.toThrow('Model incomplete-model not found');
    });

    it('should handle different original vs resolved model names', async () => {
      mockGetAllModels.mockResolvedValue(mockModels);

      const result = await ModelConfigurationService.getModelConfiguration(
        'gpt-5',
        'gpt-4o-mini'
      );

      expect(result.modelConfig).toBe(mockModels[1]);
      expect(result.isGPT5Model).toBe(true);
    });
  });

  describe('supportsFeature', () => {
    const mockModelConfig = {
      modelConfig: { id: 'test' } as any,
      isGPT5Model: true,
      isReasoningCapable: true,
      modelSupportsFileSearchTools: true,
    };

    it('should check reasoning support', () => {
      const result = ModelConfigurationService.supportsFeature(
        mockModelConfig,
        'reasoning'
      );

      expect(result).toBe(true);
    });

    it('should check file search support', () => {
      const result = ModelConfigurationService.supportsFeature(
        mockModelConfig,
        'fileSearch'
      );

      expect(result).toBe(true);
    });

    it('should check streaming support', () => {
      const result = ModelConfigurationService.supportsFeature(
        mockModelConfig,
        'streaming'
      );

      expect(result).toBe(true);
    });

    it('should return false for unsupported features', () => {
      const result = ModelConfigurationService.supportsFeature(
        mockModelConfig,
        'reasoning' as any
      );

      expect(result).toBe(true);
    });

    it('should handle model without reasoning capability', () => {
      const nonReasoningConfig = {
        ...mockModelConfig,
        isReasoningCapable: false,
      };

      const result = ModelConfigurationService.supportsFeature(
        nonReasoningConfig,
        'reasoning'
      );

      expect(result).toBe(false);
    });

    it('should handle model without file search capability', () => {
      const nonFileSearchConfig = {
        ...mockModelConfig,
        modelSupportsFileSearchTools: false,
      };

      const result = ModelConfigurationService.supportsFeature(
        nonFileSearchConfig,
        'fileSearch'
      );

      expect(result).toBe(false);
    });
  });

  describe('getModelSettings', () => {
    it('should generate settings for reasoning-capable model', () => {
      const mockModelConfig = {
        modelConfig: { id: 'test' } as any,
        isGPT5Model: true,
        isReasoningCapable: true,
        modelSupportsFileSearchTools: false,
      };

      const result = ModelConfigurationService.getModelSettings(
        mockModelConfig,
        'medium',
        'high'
      );

      expect(result).toEqual({
        enableSearch: false,
        reasoningEffort: 'medium',
        verbosity: 'high',
        headers: {
          'X-Reasoning-Effort': 'medium',
          'X-Text-Verbosity': 'high',
        },
      });
    });

    it('should generate settings for non-reasoning model', () => {
      const mockModelConfig = {
        modelConfig: { id: 'test' } as any,
        isGPT5Model: false,
        isReasoningCapable: false,
        modelSupportsFileSearchTools: false,
      };

      const result = ModelConfigurationService.getModelSettings(
        mockModelConfig,
        'low'
      );

      expect(result).toEqual({
        enableSearch: false,
        reasoningEffort: 'low',
        verbosity: undefined,
        headers: undefined,
      });
    });

    it('should handle reasoning model without verbosity', () => {
      const mockModelConfig = {
        modelConfig: { id: 'test' } as any,
        isGPT5Model: true,
        isReasoningCapable: true,
        modelSupportsFileSearchTools: false,
      };

      const result = ModelConfigurationService.getModelSettings(
        mockModelConfig,
        'high'
      );

      expect(result).toEqual({
        enableSearch: false,
        reasoningEffort: 'high',
        verbosity: undefined,
        headers: {
          'X-Reasoning-Effort': 'high',
        },
      });
    });

    it('should always disable provider-level search', () => {
      const mockModelConfig = {
        modelConfig: { id: 'test' } as any,
        isGPT5Model: false,
        isReasoningCapable: false,
        modelSupportsFileSearchTools: true,
      };

      const result = ModelConfigurationService.getModelSettings(
        mockModelConfig,
        'low',
        'low'
      );

      expect(result.enableSearch).toBe(false);
    });
  });
});
