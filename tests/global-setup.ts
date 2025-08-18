import { chromium, type FullConfig } from '@playwright/test';
import { mockModel } from '../lib/ai/models.test';

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up RoboRail Assistant test environment...');
  
  // Ensure test directories exist
  const fs = require('fs');
  const path = require('path');
  
  const testDirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/traces',
    'test-results/videos'
  ];
  
  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Initialize mock AI model for testing
  console.log('🤖 Initializing mock AI models...');
  
  // Add test-specific responses
  mockModel.addResponse('test connection', {
    content: 'Test connection successful! RoboRail Assistant is ready.',
    delay: 50
  });
  
  mockModel.addResponse('performance test', {
    content: 'Performance test response with controlled timing.',
    delay: 200,
    chunks: Array(20).fill('Performance test chunk. ')
  });

  // Setup browser for authentication if needed
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to app to warm up
    await page.goto(config.projects[0]?.use?.baseURL || 'http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('✅ App warmup completed');
  } catch (error) {
    console.warn('⚠️ App warmup failed, tests may be slower:', error);
  }
  
  await browser.close();

  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.PLAYWRIGHT_TEST_RUNNING = 'true';
  
  console.log('✅ Global setup completed');
}

export default globalSetup;