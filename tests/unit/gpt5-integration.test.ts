import { describe, expect, it } from 'vitest';
import { getAllModels } from '@/lib/models';
import { getProviderForModel } from '@/lib/openproviders/provider-map';

describe('GPT-5 Integration Tests', () => {

  describe('Model Availability', () => {
    it('should include GPT-5 models in the model list', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(model => model.id.startsWith('gpt-5'));
      
      expect(gpt5Models.length).toBeGreaterThan(0);
      
      // Check for specific GPT-5 models
      const modelIds = gpt5Models.map(m => m.id);
      expect(modelIds).toContain('gpt-5');
      expect(modelIds).toContain('gpt-5-mini');
      expect(modelIds).toContain('gpt-5-nano');
    });

    it('should have correct GPT-5 model configurations', async () => {
      const models = await getAllModels();
      const gpt5Model = models.find(m => m.id === 'gpt-5');
      const gpt5MiniModel = models.find(m => m.id === 'gpt-5-mini');
      const gpt5NanoModel = models.find(m => m.id === 'gpt-5-nano');

      // GPT-5 configuration
      expect(gpt5Model).toBeDefined();
      expect(gpt5Model?.provider).toBe('OpenAI');
      expect(gpt5Model?.providerId).toBe('openai');
      expect(gpt5Model?.modelFamily).toBe('GPT-5');
      expect(gpt5Model?.contextWindow).toBe(128_000);
      expect(gpt5Model?.inputCost).toBe(1.25);
      expect(gpt5Model?.outputCost).toBe(10);
      expect(gpt5Model?.reasoningText).toBe(true);
      expect(gpt5Model?.vision).toBe(true);
      expect(gpt5Model?.tools).toBe(true);
      expect(gpt5Model?.fileSearchTools).toBe(true);

      // GPT-5 Mini configuration
      expect(gpt5MiniModel).toBeDefined();
      expect(gpt5MiniModel?.inputCost).toBe(0.25);
      expect(gpt5MiniModel?.outputCost).toBe(2);
      expect(gpt5MiniModel?.contextWindow).toBe(128_000);
      expect(gpt5MiniModel?.tags).toContain('default');

      // GPT-5 Nano configuration
      expect(gpt5NanoModel).toBeDefined();
      expect(gpt5NanoModel?.inputCost).toBe(0.05);
      expect(gpt5NanoModel?.outputCost).toBe(0.4);
      expect(gpt5NanoModel?.speed).toBe('Very Fast');
      expect(gpt5NanoModel?.audio).toBe(false); // Nano doesn't have audio
    });
  });

  describe('Provider Mapping', () => {
    it('should correctly map GPT-5 models to OpenAI provider', () => {
      const gpt5Models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro'];
      
      gpt5Models.forEach(model => {
        const provider = getProviderForModel(model as any);
        expect(provider).toBe('openai');
      });
    });

    it('should distinguish GPT-5 from other OpenAI models', () => {
      const gpt4Models = ['gpt-4', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      const gpt5Models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'];
      
      // All should map to openai provider
      [...gpt4Models, ...gpt5Models].forEach(model => {
        const provider = getProviderForModel(model as any);
        expect(provider).toBe('openai');
      });
      
      // But GPT-5 models should be identifiable
      gpt5Models.forEach(model => {
        expect(model.startsWith('gpt-5')).toBe(true);
      });
      
      gpt4Models.forEach(model => {
        expect(model.startsWith('gpt-5')).toBe(false);
      });
    });
  });

  describe('Model Configuration Validation', () => {
    it('should have consistent GPT-5 model family designation', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      gpt5Models.forEach(model => {
        expect(model.modelFamily).toBe('GPT-5');
        expect(model.provider).toBe('OpenAI');
        expect(model.providerId).toBe('openai');
        expect(model.baseProviderId).toBe('openai');
      });
    });

    it('should have correct context window for all GPT-5 variants', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      // All GPT-5 variants should have 128k context window
      gpt5Models.forEach(model => {
        expect(model.contextWindow).toBe(128_000);
      });
    });

    it('should have reasoning capabilities enabled', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      gpt5Models.forEach(model => {
        expect(model.reasoningText).toBe(true);
      });
    });

    it('should have proper feature flags', async () => {
      const models = await getAllModels();
      const gpt5Model = models.find(m => m.id === 'gpt-5');
      const gpt5MiniModel = models.find(m => m.id === 'gpt-5-mini');
      const gpt5NanoModel = models.find(m => m.id === 'gpt-5-nano');

      // All GPT-5 models should support vision and tools
      [gpt5Model, gpt5MiniModel, gpt5NanoModel].forEach(model => {
        expect(model?.vision).toBe(true);
        expect(model?.tools).toBe(true);
        expect(model?.fileSearchTools).toBe(true);
      });

      // Audio support varies
      expect(gpt5Model?.audio).toBe(true);
      expect(gpt5MiniModel?.audio).toBe(true);
      expect(gpt5NanoModel?.audio).toBe(false); // Nano doesn't have audio
    });
  });

  describe('Performance Characteristics', () => {
    it('should configure correct speed expectations for each variant', async () => {
      const models = await getAllModels();
      
      const gpt5Nano = models.find(m => m.id === 'gpt-5-nano');
      const gpt5Mini = models.find(m => m.id === 'gpt-5-mini');  
      const gpt5 = models.find(m => m.id === 'gpt-5');

      expect(gpt5Nano?.speed).toBe('Very Fast');
      expect(gpt5Mini?.speed).toBe('Fast');
      expect(gpt5?.speed).toBe('Fast');
    });

    it('should have correct cost ratios between variants', async () => {
      const models = await getAllModels();
      
      const gpt5Nano = models.find(m => m.id === 'gpt-5-nano');
      const gpt5Mini = models.find(m => m.id === 'gpt-5-mini');
      const gpt5 = models.find(m => m.id === 'gpt-5');

      // Verify cost progression: Nano < Mini < GPT-5
      expect(gpt5Nano?.inputCost).toBeLessThan(gpt5Mini?.inputCost || Infinity);
      expect(gpt5Mini?.inputCost).toBeLessThan(gpt5?.inputCost || Infinity);
      expect(gpt5Nano?.outputCost).toBeLessThan(gpt5Mini?.outputCost || Infinity);
      expect(gpt5Mini?.outputCost).toBeLessThan(gpt5?.outputCost || Infinity);
    });

    it('should have pricing information', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      gpt5Models.forEach(model => {
        expect(model.inputCost).toBeGreaterThan(0);
        expect(model.outputCost).toBeGreaterThan(0);
        expect(model.priceUnit).toBe('per 1M tokens');
      });
    });
  });

  describe('API Integration Readiness', () => {
    it('should have proper API SDK configuration', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      gpt5Models.forEach(model => {
        expect(model.apiSdk).toBeDefined();
        expect(typeof model.apiSdk).toBe('function');
      });
    });

    it('should have correct model tags', async () => {
      const models = await getAllModels();
      const gpt5Model = models.find(m => m.id === 'gpt-5');
      const gpt5MiniModel = models.find(m => m.id === 'gpt-5-mini');
      const gpt5NanoModel = models.find(m => m.id === 'gpt-5-nano');

      // Check specific tags
      expect(gpt5Model?.tags).toContain('flagship');
      expect(gpt5MiniModel?.tags).toContain('default');
      expect(gpt5MiniModel?.tags).toContain('cost-effective');
      expect(gpt5NanoModel?.tags).toContain('fast');
      expect(gpt5NanoModel?.tags).toContain('lightweight');
    });

    it('should have model documentation links', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      gpt5Models.forEach(model => {
        expect(model.website).toBe('https://openai.com');
        expect(model.apiDocs).toContain('https://platform.openai.com/docs/models/');
        expect(model.modelPage).toContain('https://platform.openai.com/docs/models/');
        expect(model.icon).toBe('openai');
      });
    });
  });

  describe('Model Validation', () => {
    it('should not have duplicate model IDs', async () => {
      const models = await getAllModels();
      const modelIds = models.map(m => m.id);
      const uniqueIds = [...new Set(modelIds)];
      
      expect(modelIds.length).toBe(uniqueIds.length);
    });

    it('should have GPT-5 models available alongside existing models', async () => {
      const models = await getAllModels();
      const modelIds = models.map(m => m.id);
      
      // Should have GPT-5 models
      expect(modelIds.filter(id => id.startsWith('gpt-5')).length).toBeGreaterThan(0);
      
      // Should still have existing models
      expect(modelIds).toContain('gpt-4');
      expect(modelIds.filter(id => id.includes('claude')).length).toBeGreaterThan(0);
      expect(modelIds.filter(id => id.includes('gemini')).length).toBeGreaterThan(0);
    });

    it('should have proper model descriptions', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      gpt5Models.forEach(model => {
        expect(model.description).toBeDefined();
        expect(model.description.length).toBeGreaterThan(10);
        expect(model.description).not.toBe('');
      });
    });
  });

  describe('Functional Verification', () => {
    it('should identify GPT-5 models correctly by pattern', () => {
      const testCases = [
        { model: 'gpt-5', isGPT5: true },
        { model: 'gpt-5-mini', isGPT5: true },
        { model: 'gpt-5-nano', isGPT5: true },
        { model: 'gpt-5-pro', isGPT5: true },
        { model: 'gpt-4', isGPT5: false },
        { model: 'gpt-4o', isGPT5: false },
        { model: 'gpt-4-turbo', isGPT5: false },
        { model: 'claude-3-sonnet', isGPT5: false },
        { model: 'o1', isGPT5: false },
        { model: 'o1-mini', isGPT5: false },
      ];

      testCases.forEach(({ model, isGPT5 }) => {
        const detected = model.startsWith('gpt-5');
        expect(detected).toBe(isGPT5);
      });
    });

    it('should have consistent model family structure', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(m => m.id.startsWith('gpt-5'));
      
      // Should have at least 3 variants
      expect(gpt5Models.length).toBeGreaterThanOrEqual(3);
      
      // All should be OpenAI models
      gpt5Models.forEach(model => {
        expect(model.provider).toBe('OpenAI');
        expect(model.providerId).toBe('openai');
        expect(model.modelFamily).toBe('GPT-5');
      });
    });
  });
});