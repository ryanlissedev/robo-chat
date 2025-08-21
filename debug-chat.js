// Debug script to check chat input state
// Run this in browser console to debug the chat input

function debugChat() {
  // Check React components
  const reactFiber = document.querySelector('[data-testid="chat-input"]')?._reactInternalFiber || 
                     document.querySelector('textarea')?.__reactInternalFiber;
  
  // Get all textareas
  const textareas = document.querySelectorAll('textarea');
  console.log(`Found ${textareas.length} textarea(s):`);
  
  textareas.forEach((textarea, index) => {
    console.log(`\n=== Textarea ${index} ===`);
    console.log('Value:', textarea.value);
    console.log('Placeholder:', textarea.placeholder);
    console.log('Disabled:', textarea.disabled);
    console.log('ReadOnly:', textarea.readOnly);
    console.log('Style display:', textarea.style.display);
    console.log('Parent className:', textarea.parentElement?.className);
    
    // Try to trigger change
    console.log('\nTrying to set value to "test"...');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(textarea, 'test');
    
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    
    console.log('Value after change:', textarea.value);
  });
  
  // Check localStorage
  console.log('\n=== localStorage drafts ===');
  Object.keys(localStorage).forEach(key => {
    if (key.includes('draft')) {
      console.log(`${key}: "${localStorage.getItem(key)}"`);
    }
  });
}

console.log('Run debugChat() to debug the chat input');
debugChat();