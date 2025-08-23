Object.keys(localStorage).forEach((key) => {
  if (key.includes('chat-draft')) {
  }
});

// Clear all drafts
function _clearAllDrafts() {
  Object.keys(localStorage).forEach((key) => {
    if (key.includes('chat-draft')) {
      localStorage.removeItem(key);
    }
  });
}

// Test input functionality
function _testInput() {
  const input = document.querySelector('textarea[data-testid="chat-input"]');
  if (input) {
    // Try to set value
    input.value = 'Test message';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((_ta, _i) => {});
  }
}
