import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '../components/ai-elements/reasoning';

(async () => {
  const user = userEvent.setup();
  render(
    <Reasoning>
      <ReasoningTrigger />
      <ReasoningContent>Content</ReasoningContent>
    </Reasoning>
  );

  console.log('initial visible', screen.queryByText('Content')?.offsetParent !== null);
  await user.click(screen.getByRole('button'));
  console.log('after click visible', screen.queryByText('Content')?.offsetParent !== null);
})();
