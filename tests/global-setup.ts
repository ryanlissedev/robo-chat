import { chromium, type FullConfig } from '@playwright/test';

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

  // E2E tests use real AI models, not mocked responses
  console.log('🤖 Setting up for real AI model testing...');

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

  // Set environment variables for testing using Object.defineProperty to avoid read-only issues
  if (!process.env.NODE_ENV) {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true,
      configurable: true
    });
  }
  
  Object.defineProperty(process.env, 'PLAYWRIGHT_TEST_RUNNING', {
    value: 'true',
    writable: true,
    configurable: true
  });
  
  console.log('✅ Global setup completed');
}

export default globalSetup;