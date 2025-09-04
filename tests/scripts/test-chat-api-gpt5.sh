#!/bin/bash

echo "🚀 Testing GPT-5 Models via Chat API"
echo "======================================"

# Test GPT-5 Mini (default model)
echo -e "\n📦 Testing GPT-5 Mini:"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, what model are you?"}],
    "model": "gpt-5-mini",
    "temperature": 0.7,
    "stream": false,
    "chatId": "test-chat-1",
    "userId": "test-user"
  }' 2>/dev/null | head -c 500

echo -e "\n\n📦 Testing GPT-5 Nano:"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, what model are you?"}],
    "model": "gpt-5-nano",
    "temperature": 0.7,
    "stream": false,
    "chatId": "test-chat-2",
    "userId": "test-user"
  }' 2>/dev/null | head -c 500

echo -e "\n\n📦 Testing GPT-5 (flagship):"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, what model are you?"}],
    "model": "gpt-5",
    "temperature": 0.7,
    "stream": false,
    "chatId": "test-chat-3",
    "userId": "test-user"
  }' 2>/dev/null | head -c 500

echo -e "\n\n✅ Test Complete!"