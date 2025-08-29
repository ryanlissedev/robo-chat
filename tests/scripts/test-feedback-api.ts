#!/usr/bin/env tsx

/**
 * Test the feedback API endpoint with LangSmith integration
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

async function testFeedbackAPI() {
  const PORT = process.env.PORT || 3001;
  const BASE_URL = `http://localhost:${PORT}`;
  
  // First, check if the server is running
  // Note: /api/chat only supports POST, so we expect 405 for GET
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/chat`, { method: 'GET' });
    console.log('Server status:', healthCheck.status === 405 ? '✅ Running (405 expected for GET)' : '❌ Not responding as expected');
  } catch (error) {
    console.error('❌ Server not running. Please start the dev server first with: npm run dev');
    return false;
  }

  // Test feedback submission with a mock run ID
  const testRunId = 'test-run-' + Date.now();
  
  console.log('\n=== Testing Feedback API ===');
  console.log('Test Run ID:', testRunId);
  
  const feedbackData = {
    runId: testRunId,
    feedback: 'upvote',
    score: 1,
    comment: 'Test feedback from API test script',
    userId: 'test-user-123',
  };
  
  try {
    console.log('\nSending feedback:', JSON.stringify(feedbackData, null, 2));
    
    const response = await fetch(`${BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedbackData),
    });
    
    const result = await response.json();
    
    console.log('\nResponse status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.success) {
      console.log('\n✅ Feedback API test passed!');
      console.log('Note: This used a test run ID. In production, use real run IDs from chat responses.');
      return true;
    } else {
      console.log('\n❌ Feedback API test failed');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Error testing feedback API:', error);
    return false;
  }
}

testFeedbackAPI().then(success => {
  process.exit(success ? 0 : 1);
});