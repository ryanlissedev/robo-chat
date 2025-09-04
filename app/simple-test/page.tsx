'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function SimpleTest() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/verify',
    }),
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4 font-bold">🔬 Simple Chat Test</h1>
      
      <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded">
        <p className="text-blue-800">
          <strong>Status:</strong> {status} | <strong>Messages:</strong> {messages.length}
        </p>
      </div>

      {/* Raw message debugging */}
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Raw Messages Debug:</h3>
        {messages.map((message, idx) => (
          <div key={message.id} className="mb-4 p-2 border border-gray-300 rounded bg-white">
            <div><strong>Message {idx}:</strong> {message.role}</div>
            <div><strong>ID:</strong> {message.id}</div>
            <div><strong>Parts Count:</strong> {message.parts?.length || 0}</div>
            
            {/* Show all parts */}
            {message.parts && message.parts.length > 0 && (
              <div className="mt-2">
                <strong>Parts:</strong>
                {message.parts.map((part: any, partIdx: number) => (
                  <div key={partIdx} className="ml-4 p-1 bg-gray-50 mt-1 rounded text-xs">
                    <strong>Type:</strong> {part.type} | 
                    <strong> Text/Delta:</strong> "{(part.text || part.delta || '').substring(0, 50)}..."
                  </div>
                ))}
              </div>
            )}

            {/* Try to extract text */}
            <div className="mt-2">
              <strong>Extracted Text:</strong> "
              {message.parts
                ?.filter((part: any) => part.type === 'text' || part.type === 'text-delta')
                .map((part: any) => part.text || part.delta || '')
                .join('')
                .substring(0, 100)}..."
            </div>

            {/* Try to extract reasoning */}
            <div className="mt-2">
              <strong>Extracted Reasoning:</strong> "
              {message.parts
                ?.filter((part: any) => part.type === 'reasoning' || part.type === 'reasoning-delta')
                .map((part: any) => part.text || part.delta || '')
                .join('')
                .substring(0, 100)}..."
            </div>
          </div>
        ))}
      </div>

      {/* Simple message display */}
      <div className="space-y-4 mb-4">
        {messages.map((message, idx) => (
          <div key={message.id} className={`p-3 rounded ${
            message.role === 'user' 
              ? 'bg-blue-50 border-l-4 border-blue-400' 
              : 'bg-green-50 border-l-4 border-green-400'
          }`}>
            <div className="font-semibold mb-1">{message.role.toUpperCase()}:</div>
            
            {/* Show reasoning if present */}
            {message.role === 'assistant' && message.parts?.some((part: any) => 
              part.type === 'reasoning' || part.type === 'reasoning-delta'
            ) && (
              <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                <strong>🧠 Reasoning:</strong><br/>
                {message.parts
                  ?.filter((part: any) => part.type === 'reasoning' || part.type === 'reasoning-delta')
                  .map((part: any) => part.text || part.delta || '')
                  .join('')}
              </div>
            )}

            {/* Show main content */}
            <div>
              {message.role === 'user' 
                ? (message as any).content || 'No content'
                : message.parts
                    ?.filter((part: any) => part.type === 'text' || part.type === 'text-delta')
                    .map((part: any) => part.text || part.delta || '')
                    .join('') || 'No text content'
              }
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              sendMessage({ text: input });
              setInput('');
            }
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-gray-300 p-3 rounded-lg"
            placeholder="Type 'test' to see reasoning and response..."
            disabled={status !== 'ready'}
          />
          <button 
            type="submit" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={status !== 'ready' || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}