import React from 'react';
import { render, screen } from '@testing-library/react';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '../components/ai-elements/reasoning';

render(
  <Reasoning>
    <ReasoningTrigger />
    <ReasoningContent>Test reasoning content</ReasoningContent>
  </Reasoning>
);

const content = screen.getByText('Test reasoning content');
console.log('content visible', content instanceof HTMLElement && content.offsetParent !== null);
console.log('content parent attrs', content.parentElement?.getAttribute('data-state'));
console.log('content parent hidden', (content.parentElement as HTMLElement | null)?.hasAttribute('hidden'));
console.log('parent outerHTML', content.parentElement?.outerHTML);
