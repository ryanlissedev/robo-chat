// Debug script to check chat input state
// Run this in browser console to debug the chat input

function debugChat() {
  // Check React components
  const _reactFiber =
    document.querySelector('[data-testid="chat-input"]')?._reactInternalFiber ||
    document.querySelector('textarea')?.__reactInternalFiber;

  // Get all textareas
  const textareas = document.querySelectorAll('textarea');

  textareas.forEach((textarea, _index) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(textarea, 'test');

    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
  });
  Object.keys(localStorage).forEach((key) => {
    if (key.includes('draft')) {
    }
  });
}
debugChat();
