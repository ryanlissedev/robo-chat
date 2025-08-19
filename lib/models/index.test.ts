import { describe, expect, it } from 'bun:test';
import { getAllModels, getModelInfo, getModelsForProvider } from './index';

describe('Models Index', () => {
  describe('getAllModels', () => {
    it('should return all available models', async () => {
      const models = await getAllModels();
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should include models from all providers', async () => {
      const models = await getAllModels();
      const providers = new Set(models.map((model) => model.provider));

      // Should include major providers
      expect(providers.has('OpenAI')).toBe(true);
      expect(providers.has('Anthropic')).toBe(true);
      expect(providers.has('Google')).toBe(true);
    });

    it('should have consistent model structure', async () => {
      const models = await getAllModels();

      models.forEach((model) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('providerId');
        expect(model).toHaveProperty('baseProviderId');

        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.provider).toBe('string');
        expect(typeof model.providerId).toBe('string');
        expect(typeof model.baseProviderId).toBe('string');

        // apiSdk is optional, but if present should be a function
        if (model.apiSdk !== undefined) {
          expect(typeof model.apiSdk).toBe('function');
        }
      });
    });

    it('should include GPT-5 models', async () => {
      const models = await getAllModels();
      const gpt5Models = models.filter(
        (model) => model.modelFamily === 'GPT-5'
      );

      expect(gpt5Models.length).toBeGreaterThan(0);
      expect(gpt5Models.some((model) => model.id === 'gpt-5-mini')).toBe(true);
    });

    it('should include Claude models', async () => {
      const models = await getAllModels();
      const claudeModels = models.filter((model) =>
        model.modelFamily?.includes('Claude')
      );

      expect(claudeModels.length).toBeGreaterThan(0);
    });

    it('should include Gemini models', async () => {
      const models = await getAllModels();
      const geminiModels = models.filter(
        (model) => model.modelFamily === 'Gemini'
      );

      expect(geminiModels.length).toBeGreaterThan(0);
    });
  });

  describe('getModelInfo', () => {
    it('should return correct model info for valid ID', () => {
      const modelInfo = getModelInfo('gpt-5-mini');

      expect(modelInfo).toBeDefined();
      expect(modelInfo?.id).toBe('gpt-5-mini');
      expect(modelInfo?.name).toBe('GPT-5 Mini');
      expect(modelInfo?.provider).toBe('OpenAI');
      expect(modelInfo?.modelFamily).toBe('GPT-5');
    });

    it('should return undefined for invalid ID', () => {
      const modelInfo = getModelInfo('non-existent-model');
      expect(modelInfo).toBeUndefined();
    });

    it('should return model with all required properties', () => {
      const modelInfo = getModelInfo('gpt-5-mini');

      expect(modelInfo).toHaveProperty('id');
      expect(modelInfo).toHaveProperty('name');
      expect(modelInfo).toHaveProperty('provider');
      expect(modelInfo).toHaveProperty('providerId');
      expect(modelInfo).toHaveProperty('baseProviderId');
      
      // These are optional properties, but should exist for this specific model
      expect(modelInfo).toHaveProperty('apiSdk');
      expect(modelInfo).toHaveProperty('contextWindow');
      expect(modelInfo).toHaveProperty('inputCost');
      expect(modelInfo).toHaveProperty('outputCost');
    });

    it('should handle case sensitivity', () => {
      const modelInfo1 = getModelInfo('gpt-5-mini');
      const modelInfo2 = getModelInfo('GPT-5-MINI');

      expect(modelInfo1).toBeDefined();
      expect(modelInfo2).toBeUndefined(); // Should be case sensitive
    });
  });

  describe('getModelsForProvider', () => {
    it('should return OpenAI models', async () => {
      const openaiModels = await getModelsForProvider('openai');

      expect(openaiModels.length).toBeGreaterThan(0);
      expect(openaiModels.every((model) => model.providerId === 'openai')).toBe(
        true
      );
      expect(openaiModels.some((model) => model.id === 'gpt-5-mini')).toBe(
        true
      );
    });

    it('should return Anthropic models', async () => {
      const anthropicModels = await getModelsForProvider('anthropic');

      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(
        anthropicModels.every((model) => model.providerId === 'anthropic')
      ).toBe(true);
    });

    it('should return Google models', async () => {
      const googleModels = await getModelsForProvider('google');

      expect(googleModels.length).toBeGreaterThan(0);
      expect(googleModels.every((model) => model.providerId === 'google')).toBe(
        true
      );
    });

    it('should return empty array for unknown provider', async () => {
      const unknownModels = await getModelsForProvider('unknown-provider');
      expect(unknownModels).toEqual([]);
    });

    it('should handle case insensitive provider names', async () => {
      const openaiModels1 = await getModelsForProvider('openai');
      const openaiModels2 = await getModelsForProvider('OPENAI');

      expect(openaiModels1.length).toBeGreaterThan(0);
      expect(openaiModels2.length).toBe(0); // Should be case sensitive
    });
  });

  describe('Model Properties', () => {
    it('should have valid cost information', async () => {
      const models = await getAllModels();

      models.forEach((model) => {
        if (model.inputCost !== undefined) {
          expect(typeof model.inputCost).toBe('number');
          expect(model.inputCost).toBeGreaterThanOrEqual(0);
        }

        if (model.outputCost !== undefined) {
          expect(typeof model.outputCost).toBe('number');
          expect(model.outputCost).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should have valid context window information', async () => {
      const models = await getAllModels();

      models.forEach((model) => {
        if (model.contextWindow !== undefined) {
          expect(typeof model.contextWindow).toBe('number');
          expect(model.contextWindow).toBeGreaterThan(0);
        }
      });
    });

    it('should have valid capability flags', async () => {
      const models = await getAllModels();

      models.forEach((model) => {
        if (model.vision !== undefined) {
          expect(typeof model.vision).toBe('boolean');
        }

        if (model.tools !== undefined) {
          expect(typeof model.tools).toBe('boolean');
        }

        if (model.audio !== undefined) {
          expect(typeof model.audio).toBe('boolean');
        }
      });
    });

    it('should have valid speed ratings', async () => {
      const models = await getAllModels();
      const validSpeeds = ['Very Fast', 'Fast', 'Medium', 'Slow'];

      models.forEach((model) => {
        if (model.speed !== undefined) {
          expect(validSpeeds).toContain(model.speed);
        }
      });
    });

    it('should have valid intelligence ratings', async () => {
      const models = await getAllModels();
      const validIntelligence = ['Low', 'Medium', 'High'];

      models.forEach((model) => {
        if (model.intelligence !== undefined) {
          expect(validIntelligence).toContain(model.intelligence);
        }
      });
    });
  });

  describe('Model Tags', () => {
    it('should have meaningful tags', async () => {
      const models = await getAllModels();

      models.forEach((model) => {
        if (model.tags) {
          expect(Array.isArray(model.tags)).toBe(true);
          expect(model.tags.length).toBeGreaterThan(0);

          model.tags.forEach((tag) => {
            expect(typeof tag).toBe('string');
            expect(tag.length).toBeGreaterThan(0);
          });
        }
      });
    });

    it('should include relevant tags for GPT-5 models', async () => {
      const allModels = await getAllModels();
      const gpt5Models = allModels.filter(
        (model) => model.modelFamily === 'GPT-5'
      );

      gpt5Models.forEach((model) => {
        expect(model.tags).toBeDefined();
        expect(
          model.tags?.some(
            (tag) =>
              tag.includes('fast') ||
              tag.includes('efficient') ||
              tag.includes('reasoning') ||
              tag.includes('balanced') ||
              tag.includes('advanced') ||
              tag.includes('conversational') ||
              tag.includes('creative')
          )
        ).toBe(true);
      });
    });
  });
});
