'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useUser } from '@/lib/user-store/provider';

export function SystemPromptSection() {
  const { user, updateUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const effectivePrompt = prompt ?? user?.system_prompt ?? '';

  const savePrompt = async () => {
    if (!user?.id) {
      return;
    }

    setIsLoading(true);
    try {
      await updateUser({ system_prompt: prompt });

      toast({
        title: 'Prompt saved',
        description: "It'll be used for new chats.",
        status: 'success',
      });
    } catch {
      toast({
        title: 'Failed to save',
        description: "Couldn't save your system prompt. Please try again.",
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);
  };

  const hasChanges = effectivePrompt !== (user?.system_prompt || '');

  return (
    <div>
      <Label className="mb-3 font-medium text-sm" htmlFor="system-prompt">
        Default system prompt
      </Label>
      <div className="relative">
        <Textarea
          className="min-h-24 w-full"
          id="system-prompt"
          onChange={handlePromptChange}
          placeholder="Enter a default system prompt for new conversations"
          value={effectivePrompt}
        />

        <AnimatePresence>
          {hasChanges && (
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute right-3 bottom-3"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                className="shadow-sm"
                disabled={isLoading}
                onClick={savePrompt}
                size="sm"
              >
                {isLoading ? 'Saving...' : 'Save prompt'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        This prompt will be used for new chats.
      </p>
    </div>
  );
}
