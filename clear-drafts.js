// Utility to clear chat drafts from localStorage
// Run this in browser console if input has stuck values

// Clear all chat draft keys
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('chat-draft')) {
    console.log('Removing:', key, '=', localStorage.getItem(key));
    localStorage.removeItem(key);
  }
});

console.log('All chat drafts cleared!');