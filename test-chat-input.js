// Test script to debug chat input issues
// Run this in browser console to test input functionality

// Check if draft values exist in localStorage
console.log('=== localStorage Chat Drafts ===');
Object.keys(localStorage).forEach(key => {
  if (key.includes('chat-draft')) {
    console.log(`${key}: "${localStorage.getItem(key)}"`);
  }
});

// Clear all drafts
function clearAllDrafts() {
  Object.keys(localStorage).forEach(key => {
    if (key.includes('chat-draft')) {
      localStorage.removeItem(key);
      console.log(`Removed: ${key}`);
    }
  });
  console.log('All drafts cleared! Refresh the page.');
}

// Test input functionality
function testInput() {
  const input = document.querySelector('textarea[data-testid="chat-input"]');
  if (input) {
    console.log('Input found!');
    console.log('Current value:', input.value);
    console.log('Disabled:', input.disabled);
    
    // Try to set value
    input.value = 'Test message';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('Value after update:', input.value);
  } else {
    console.log('Input not found. Looking for other textarea elements...');
    const textareas = document.querySelectorAll('textarea');
    console.log(`Found ${textareas.length} textarea(s):`);
    textareas.forEach((ta, i) => {
      console.log(`  [${i}] placeholder: "${ta.placeholder}", disabled: ${ta.disabled}, value: "${ta.value}"`);
    });
  }
}

console.log('Available functions:');
console.log('- clearAllDrafts() : Clear all chat drafts from localStorage');
console.log('- testInput() : Test the chat input functionality');