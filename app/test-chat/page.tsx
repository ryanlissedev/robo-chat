'use client';

import { useState } from 'react';
import type { TestChatMessage } from '@/lib/types/models';

type TestResult = {
  message: string;
  response?: string;
  success: boolean;
  time?: number;
};

export default function TestChatPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [successRate, setSuccessRate] = useState<number | null>(null);

  const runTest = async () => {
    setIsRunning(true);
    setResults([]);
    setSuccessRate(null);

    const chatId = `browser-test-${Date.now()}`;
    const userId = `guest-${Date.now()}`;

    const testMessages = [
      'Hello, I need help with the RoboRail machine',
      'What safety equipment do I need?',
      'How do I perform daily maintenance?',
    ];

    const newResults: TestResult[] = [];
    const conversationHistory: TestChatMessage[] = [];

    for (const userMsg of testMessages) {
      conversationHistory.push({
        role: 'user',
        content: userMsg,
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
            chatId,
            userId,
            model: 'gpt-5-mini',
            isAuthenticated: false,
            enableSearch: false,
            reasoningEffort: 'medium',
          }),
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let assistantContent = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (!line.startsWith('data: ')) {
                  continue;
                }
                const raw = line.slice(6);
                if (raw === '[DONE]') {
                  continue;
                }
                try {
                  const evt = JSON.parse(raw);
                  // 1) Legacy shape
                  if (
                    evt?.type === 'content' &&
                    typeof evt?.data === 'string'
                  ) {
                    assistantContent += evt.data;
                    continue;
                  }
                  // 2) v5 delta
                  if (evt?.type === 'content.delta' && evt?.delta) {
                    const d = evt.delta;
                    if (d.type === 'text-delta' && (d.textDelta || d.text)) {
                      assistantContent += d.textDelta || d.text;
                      continue;
                    }
                  }
                  // 3) direct text-delta
                  if (
                    evt?.type === 'text-delta' &&
                    (evt.textDelta || evt.text)
                  ) {
                    assistantContent += evt.textDelta || evt.text;
                    continue;
                  }
                  // 4) message.delta with parts
                  if (evt?.type === 'message.delta' && evt?.delta?.content) {
                    const parts = Array.isArray(evt.delta.content)
                      ? evt.delta.content
                      : [];
                    for (const p of parts) {
                      if (p?.type === 'text' && typeof p?.text === 'string') {
                        assistantContent += p.text;
                      }
                    }
                    continue;
                  }
                  // 5) UI content event variant
                  if (
                    evt?.type === 'content' &&
                    evt?.content?.type === 'text' &&
                    typeof evt.content.text === 'string'
                  ) {
                    assistantContent += evt.content.text;
                  }
                } catch {}
              }
            }
          }

          if (assistantContent) {
            conversationHistory.push({
              role: 'assistant',
              content: assistantContent,
            });

            newResults.push({
              message: userMsg,
              response:
                assistantContent.substring(0, 100) +
                (assistantContent.length > 100 ? '...' : ''),
              success: true,
              time: responseTime,
            });
          } else {
            newResults.push({
              message: userMsg,
              success: false,
              time: responseTime,
            });
          }
        } else {
          newResults.push({
            message: userMsg,
            success: false,
          });
        }
      } catch {
        newResults.push({
          message: userMsg,
          success: false,
        });
      }

      setResults([...newResults]);
    }

    const successful = newResults.filter((r) => r.success).length;
    setSuccessRate(Math.round((successful / testMessages.length) * 100));
    setIsRunning(false);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-6 border-b pb-4 font-bold text-3xl text-gray-800">
          🤖 RoboRail Assistant - Chat Test
        </h1>

        <div
          className={`mb-6 rounded-lg p-4 ${
            successRate === null
              ? 'bg-blue-50 text-blue-800'
              : successRate === 100
                ? 'bg-green-50 text-green-800'
                : successRate >= 50
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-red-50 text-red-800'
          }`}
        >
          {successRate === null ? (
            'Click "Run Test" to start the chat functionality test'
          ) : successRate === 100 ? (
            <strong>🎉 100% SUCCESS! Chat is fully functional!</strong>
          ) : successRate >= 50 ? (
            <strong>
              ⚠️ {successRate}% SUCCESS - Chat is partially functional
            </strong>
          ) : (
            <strong>❌ {successRate}% SUCCESS - Chat needs fixes</strong>
          )}
        </div>

        {results.length > 0 && (
          <div className="mb-6 space-y-4">
            {results.map((result, i) => (
              <div
                className="border-blue-500 border-l-4 bg-gray-50 py-2 pl-4"
                key={i}
              >
                <div className="font-semibold text-blue-600">
                  Test {i + 1}: &quot;{result.message}&quot;
                </div>
                {result.success ? (
                  <>
                    <div className="mt-1 text-green-600">
                      ✅ Assistant: &quot;{result.response}&quot;
                    </div>
                    {result.time && (
                      <div className="mt-1 text-gray-500 text-sm">
                        ⏱️ Response time: {result.time}ms
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-1 text-red-600">
                    ❌ Failed to get response
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {successRate !== null && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded bg-gray-50 p-4 text-center">
              <div className="font-bold text-2xl text-blue-600">
                {successRate}%
              </div>
              <div className="text-gray-600 text-sm">Success Rate</div>
            </div>
            <div className="rounded bg-gray-50 p-4 text-center">
              <div className="font-bold text-2xl text-blue-600">
                {results.length > 0
                  ? Math.round(
                      results.reduce((acc, r) => acc + (r.time || 0), 0) /
                        results.length
                    )
                  : 0}
                ms
              </div>
              <div className="text-gray-600 text-sm">Avg Response Time</div>
            </div>
            <div className="rounded bg-gray-50 p-4 text-center">
              <div className="font-bold text-2xl text-blue-600">
                {results.length}
              </div>
              <div className="text-gray-600 text-sm">Tests Run</div>
            </div>
          </div>
        )}

        <button
          className={`rounded-lg px-6 py-3 font-semibold text-white transition-colors ${
            isRunning
              ? 'cursor-not-allowed bg-gray-400'
              : 'cursor-pointer bg-blue-600 hover:bg-blue-700'
          }`}
          disabled={isRunning}
          onClick={runTest}
        >
          {isRunning ? '🔄 Running Tests...' : 'Run Test'}
        </button>
      </div>
    </div>
  );
}
