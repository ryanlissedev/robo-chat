'use client';

import { useState } from 'react';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  pricing: {
    input: string;
    output: string;
  };
  speed: string;
  features: string[];
}

const gpt5Models: ModelInfo[] = [
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Fast, cost-effective GPT-5 variant. Default model for most use cases.',
    pricing: { input: '$0.25/1M', output: '$2/1M' },
    speed: 'Fast',
    features: ['Reasoning', 'Vision', 'Tools', 'File Search', 'Audio'],
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    description: 'Ultra-fast, lightweight GPT-5 for simple tasks and high-volume applications.',
    pricing: { input: '$0.05/1M', output: '$0.40/1M' },
    speed: 'Very Fast',
    features: ['Reasoning', 'Vision', 'Tools', 'File Search'],
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Latest flagship model with 94.6% on AIME 2025, 74.9% on SWE-bench.',
    pricing: { input: '$1.25/1M', output: '$10/1M' },
    speed: 'Fast',
    features: ['Reasoning', 'Vision', 'Tools', 'File Search', 'Audio'],
  },
  {
    id: 'gpt-5-pro',
    name: 'GPT-5 Pro',
    description: 'Most capable GPT-5 for challenging tasks with advanced reasoning.',
    pricing: { input: '$15/1M', output: '$60/1M' },
    speed: 'Medium',
    features: ['Reasoning', 'Vision', 'Tools', 'File Search', 'Audio'],
  },
];

export default function DemoGPT5() {
  const [selectedModel, setSelectedModel] = useState('gpt-5-mini');
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelStats, setModelStats] = useState<any>(null);

  const testModel = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setResponse('');
    setModelStats(null);

    try {
      const res = await fetch('/api/test-gpt5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: input }],
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'text-delta') {
                  fullText += parsed.textDelta || '';
                  setResponse(fullText);
                } else if (parsed.type === 'model-info') {
                  setModelStats(parsed.data);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error testing model');
    } finally {
      setLoading(false);
    }
  };

  const selectedModelInfo = gpt5Models.find(m => m.id === selectedModel);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">GPT-5 Model Family Demo</h1>
        <p className="text-gray-600 mb-8">September 2025 - Testing the new GPT-5 models</p>

        {/* Model Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select a Model</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gpt5Models.map((model) => (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-semibold">{model.name}</h3>
                {model.id === 'gpt-5-mini' && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">DEFAULT</span>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Input: {model.pricing.input}<br/>
                  Output: {model.pricing.output}
                </p>
                <p className="text-xs text-gray-500 mt-1">Speed: {model.speed}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Model Details */}
        {selectedModelInfo && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">{selectedModelInfo.name}</h2>
            <p className="text-gray-600 mb-4">{selectedModelInfo.description}</p>
            <div className="flex flex-wrap gap-2">
              {selectedModelInfo.features.map((feature) => (
                <span key={feature} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Test Interface */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test {selectedModelInfo?.name}</h2>
          
          <div className="mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && testModel()}
              placeholder="Enter your message..."
              className="w-full p-3 border rounded-lg"
              disabled={loading}
            />
          </div>

          <button
            onClick={testModel}
            disabled={loading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading ? 'Processing...' : 'Send'}
          </button>

          {/* Response */}
          {response && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Response:</h3>
              <p className="whitespace-pre-wrap">{response}</p>
            </div>
          )}

          {/* Model Stats */}
          {modelStats && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Model Information:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Model: {modelStats.model}</div>
                <div>Speed: {modelStats.stats?.speed}</div>
                <div>Context: {modelStats.stats?.contextWindow?.toLocaleString()} tokens</div>
                <div>Response Time: {modelStats.stats?.responseTime}</div>
              </div>
            </div>
          )}
        </div>

        {/* Configuration Status */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2">✅ GPT-5 Models Configured</h3>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Models added to /lib/models/data/openai.ts</li>
            <li>• Default model set to gpt-5-mini in /lib/config.ts</li>
            <li>• Responses API integration configured</li>
            <li>• Provider mappings updated</li>
            <li>• Mock endpoint available at /api/test-gpt5</li>
          </ul>
        </div>
      </div>
    </div>
  );
}