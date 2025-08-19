const { chromium } = require('playwright');

async function debugMessagesLoad() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Add console logging
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    }
  });
  
  try {
    // Navigate to existing chat
    const chatId = '53685ead-c368-4f46-8866-cc4a2a7d68dd';
    
    // Inject debugging code before navigation
    await page.addInitScript(() => {
      // Override console methods to capture logs
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.log = (...args) => {
        originalLog('[DEBUG]', ...args);
      };
      
      console.error = (...args) => {
        originalError('[ERROR]', ...args);
      };
      
      console.warn = (...args) => {
        originalWarn('[WARN]', ...args);
      };
      
      // Log IndexedDB operations
      const originalOpen = indexedDB.open;
      indexedDB.open = function(...args) {
        console.log('[IndexedDB] Opening database:', args[0]);
        return originalOpen.apply(this, args);
      };
    });
    
    console.log(`Navigating to chat: ${chatId}`);
    await page.goto(`http://localhost:3000/c/${chatId}`);
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check if messages are in the React state
    const reactState = await page.evaluate(() => {
      // Try to find React fiber
      const findReactFiber = (element) => {
        for (const key in element) {
          if (key.startsWith('__reactFiber')) {
            return element[key];
          }
        }
        return null;
      };
      
      // Find the chat container
      const container = document.querySelector('[data-testid="chat-container"]');
      if (!container) return { error: 'No chat container found' };
      
      const fiber = findReactFiber(container);
      if (!fiber) return { error: 'No React fiber found' };
      
      // Try to find messages in the component tree
      let messages = null;
      let current = fiber;
      while (current && !messages) {
        if (current.memoizedProps?.messages) {
          messages = current.memoizedProps.messages;
          break;
        }
        if (current.memoizedState?.messages) {
          messages = current.memoizedState.messages;
          break;
        }
        current = current.return || current.child;
      }
      
      return { messages, hasContainer: true };
    });
    
    console.log('React state:', JSON.stringify(reactState, null, 2));
    
    // Check DOM for messages
    const messageElements = await page.$$('[data-role="user"], [data-role="assistant"], .message');
    console.log('Message elements found:', messageElements.length);
    
    console.log('\nKeeping browser open for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugMessagesLoad();