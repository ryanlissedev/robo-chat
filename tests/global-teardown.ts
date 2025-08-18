async function globalTeardown() {
  console.log('🧹 Cleaning up RoboRail Assistant test environment...');
  
  // Clean up test environment variables
  delete process.env.PLAYWRIGHT_TEST_RUNNING;
  
  // Optional: Clean up temporary test files if needed
  const fs = require('fs');
  const path = require('path');
  
  // Clean up old screenshots older than 7 days
  const screenshotsDir = 'test-results/screenshots';
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    files.forEach((file: string) => {
      const filePath = path.join(screenshotsDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime.getTime() < oneWeekAgo) {
        fs.unlinkSync(filePath);
      }
    });
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;