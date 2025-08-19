import { test, expect } from '@playwright/test';

test.describe('GPT-5 API Integration Testing', () => {
  test('should get real response from chat API with GPT-5', async ({ request }) => {
    // Make direct API call to the chat endpoint
    const response = await request.post('/api/chat', {
      data: {
        messages: [
          {
            role: 'user',
            content: 'What is 2+2? Please answer with just the number.'
          }
        ],
        model: 'gpt-5-mini',
        stream: false
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Check that the API responded successfully
    expect(response.ok()).toBeTruthy();
    
    // Get the response body
    const responseBody = await response.text();
    console.log('API Response:', responseBody.substring(0, 200));
    
    // Verify we got a real response containing "4"
    expect(responseBody).toContain('4');
    
    console.log('✅ Successfully received real GPT-5 response via API');
  });

  test('should handle GPT-5 model without temperature parameter errors', async ({ request }) => {
    // Test with GPT-5 model which should NOT accept temperature parameter
    const response = await request.post('/api/chat', {
      data: {
        messages: [
          {
            role: 'user',
            content: 'Test message for GPT-5 temperature handling'
          }
        ],
        model: 'gpt-5',
        stream: false,
        // This should be filtered out by our temperature fix
        temperature: 0.7
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Should not return an error about temperature parameter
    expect(response.ok()).toBeTruthy();
    
    const responseBody = await response.text();
    console.log('GPT-5 Response Status:', response.status());
    
    // Should not contain OpenAI API errors about temperature
    expect(responseBody).not.toContain('temperature');
    expect(responseBody).not.toContain('not supported');
    expect(responseBody).not.toContain('parameter');
    
    console.log('✅ GPT-5 temperature fix is working - no API errors');
  });

  test('should verify different GPT-5 models work correctly', async ({ request }) => {
    const gpt5Models = ['gpt-5-mini', 'gpt-5', 'gpt-5-pro'];
    
    for (const model of gpt5Models) {
      console.log(`Testing ${model}...`);
      
      const response = await request.post('/api/chat', {
        data: {
          messages: [
            {
              role: 'user',
              content: `Test message for ${model}`
            }
          ],
          model,
          stream: false
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const responseBody = await response.text();
      expect(responseBody.length).toBeGreaterThan(10);
      
      console.log(`✅ ${model} working correctly`);
    }
  });
});