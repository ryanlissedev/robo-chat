'use client';

import { useState } from 'react';

interface TestResult {
  message: string;
  response?: string;
  success: boolean;
  time?: number;
}

export default function TestChatPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [successRate, setSuccessRate] = useState<number | null>(null);

  const runTest = async () => {
    setIsRunning(true);
    setResults([]);
    setSuccessRate(null);

    const chatId = 'browser-test-' + Date.now();
    const userId = 'guest-' + Date.now();

    const testMessages = [
      "Hello, I need help with the RoboRail machine",
      "What safety equipment do I need?",
      "How do I perform daily maintenance?"
    ];

    const newResults: TestResult[] = [];
    let conversationHistory: any[] = [];

    for (const userMsg of testMessages) {
      conversationHistory.push({
        role: 'user',
        parts: [{ type: 'text', text: userMsg }]
      });

      const startTime = Date.now();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationHistory,
            chatId: chatId,
            userId: userId,
            model: 'gpt-5-mini',
            isAuthenticated: false,
            enableSearch: false,
            reasoningEffort: 'medium'
          })
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let assistantContent = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6);
                if (raw === '[DONE]') continue;
                try {
                  const evt = JSON.parse(raw);
                  // 1) Legacy shape
                  if (evt?.type === 'content' && typeof evt?.data === 'string') {
                    assistantContent += evt.data;
                    continue;
                  }
                  // 2) v5 delta
                  if (evt?.type === 'content.delta' && evt?.delta) {
                    const d = evt.delta;
                    if (d.type === 'text-delta' && (d.textDelta || d.text)) {
                      assistantContent += (d.textDelta || d.text);
                      continue;
                    }
                  }
                  // 3) direct text-delta
                  if (evt?.type === 'text-delta' && (evt.textDelta || evt.text)) {
                    assistantContent += (evt.textDelta || evt.text);
                    continue;
                  }
                  // 4) message.delta with parts
                  if (evt?.type === 'message.delta' && evt?.delta?.content) {
                    const parts = Array.isArray(evt.delta.content) ? evt.delta.content : [];
                    for (const p of parts) {
                      if (p?.type === 'text' && typeof p?.text === 'string') {
                        assistantContent += p.text;
                      }
                    }
                    continue;
                  }
                  // 5) UI content event variant
                  if (evt?.type === 'content' && evt?.content?.type === 'text' && typeof evt.content.text === 'string') {
                    assistantContent += evt.content.text;
                    continue;
                  }
                } catch {}
              }
            }
          }

          if (assistantContent) {
            conversationHistory.push({
              role: 'assistant',
              parts: [{ type: 'text', text: assistantContent }]
            });

            newResults.push({
              message: userMsg,
              response: assistantContent.substring(0, 100) + (assistantContent.length > 100 ? '...' : ''),
              success: true,
              time: responseTime
            });
          } else {
            newResults.push({
              message: userMsg,
              success: false,
              time: responseTime
            });
          }
        } else {
          newResults.push({
            message: userMsg,
            success: false
          });
        }
      } catch (error) {
        newResults.push({
          message: userMsg,
          success: false
        });
      }

      setResults([...newResults]);
    }

    const successful = newResults.filter(r => r.success).length;
    setSuccessRate(Math.round((successful / testMessages.length) * 100));
    setIsRunning(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">
          🤖 RoboRail Assistant - Chat Test
        </h1>

        <div className={`p-4 rounded-lg mb-6 ${
          successRate === null ? 'bg-blue-50 text-blue-800' :
          successRate === 100 ? 'bg-green-50 text-green-800' :
          successRate >= 50 ? 'bg-yellow-50 text-yellow-800' :
          'bg-red-50 text-red-800'
        }`}>
          {successRate === null ? (
            'Click "Run Test" to start the chat functionality test'
          ) : successRate === 100 ? (
            <strong>🎉 100% SUCCESS! Chat is fully functional!</strong>
          ) : successRate >= 50 ? (
            <strong>⚠️ {successRate}% SUCCESS - Chat is partially functional</strong>
          ) : (
            <strong>❌ {successRate}% SUCCESS - Chat needs fixes</strong>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-4 mb-6">
            {results.map((result, i) => (
              <div key={i} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50">
                <div className="font-semibold text-blue-600">
                  Test {i + 1}: "{result.message}"
                </div>
                {result.success ? (
                  <>
                    <div className="text-green-600 mt-1">
                      ✅ Assistant: "{result.response}"
                    </div>
                    {result.time && (
                      <div className="text-gray-500 text-sm mt-1">
                        ⏱️ Response time: {result.time}ms
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-red-600 mt-1">
                    ❌ Failed to get response
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {successRate !== null && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="bg-gray-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.length > 0 ? Math.round(results.reduce((acc, r) => acc + (r.time || 0), 0) / results.length) : 0}ms
              </div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
            <div className="bg-gray-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-sm text-gray-600">Tests Run</div>
            </div>
          </div>
        )}

        <button
          onClick={runTest}
          disabled={isRunning}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            isRunning 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {isRunning ? '🔄 Running Tests...' : 'Run Test'}
        </button>
      </div>
    </div>
  );
}
