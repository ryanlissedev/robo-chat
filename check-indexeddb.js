const { chromium } = require('playwright');

async function checkIndexedDB() {
  const browser = await chromium.launch({ 
    headless: false
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to a chat page directly
    await page.goto('http://localhost:3000/c/53685ead-c368-4f46-8866-cc4a2a7d68dd');
    await page.waitForTimeout(2000);
    
    // Check IndexedDB
    const dbData = await page.evaluate(async () => {
      const databases = ['zola-db'];
      const result = {};
      
      for (const dbName of databases) {
        result[dbName] = {};
        
        try {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          const objectStoreNames = Array.from(db.objectStoreNames);
          
          for (const storeName of objectStoreNames) {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const data = await new Promise((resolve, reject) => {
              const request = store.getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            
            result[dbName][storeName] = data;
          }
          
          db.close();
        } catch (error) {
          result[dbName].error = error.message;
        }
      }
      
      return result;
    });
    
    console.log('IndexedDB contents:');
    console.log(JSON.stringify(dbData, null, 2));
    
    // Check localStorage
    const localStorageData = await page.evaluate(() => {
      const result = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        result[key] = localStorage.getItem(key);
      }
      return result;
    });
    
    console.log('\nLocalStorage contents:');
    console.log(JSON.stringify(localStorageData, null, 2));
    
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkIndexedDB();