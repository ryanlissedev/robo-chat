'use client';

import { CaretLeft, SealCheck, Spinner } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseEnabled } from '@/lib/supabase/config';

const TRANSITION_CONTENT = {
  ease: [0.16, 1, 0.3, 1] as const,
  duration: 0.2,
};

type FeedbackFormProps = {
  authUserId?: string;
  onClose: () => void;
};

export function FeedbackForm({ authUserId, onClose }: FeedbackFormProps) {
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [feedback, setFeedback] = useState('');

  if (!isSupabaseEnabled) {
    return null;
  }

  const handleClose = () => {
    setFeedback('');
    setStatus('idle');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!authUserId) {
      toast({
        title: 'Please login to submit feedback',
        status: 'error',
      });
      return;
    }

    setStatus('submitting');
    if (!feedback.trim()) {
      return;
    }

    try {
      const supabase = createClient();

      if (!supabase) {
        toast({
          title: 'Feedback is not supported in this deployment',
          status: 'info',
        });
        return;
      }

      const { error } = await supabase.from('feedback').insert({
        message: feedback,
        user_id: authUserId,
      });

      if (error) {
        toast({
          title: `Error submitting feedback: ${error}`,
          status: 'error',
        });
        setStatus('error');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));

      setStatus('success');

      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (error) {
      toast({
        title: `Error submitting feedback: ${error}`,
        status: 'error',
      });
      setStatus('error');
    }
  };

  return (
    <div className="h-[200px] w-full">
      <AnimatePresence mode="popLayout">
        {status === 'success' ? (
          <motion.div
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            className="flex h-[200px] w-full flex-col items-center justify-center"
            exit={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
            initial={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
            key="success"
            transition={TRANSITION_CONTENT}
          >
            <div className="rounded-full bg-green-500/10 p-1">
              <SealCheck className="size-6 text-green-500" />
            </div>
            <p className="mt-3 mb-1 text-center font-medium text-foreground text-sm">
              Thank you for your time!
            </p>
            <p className="text-muted-foreground text-sm">
              Your feedback makes Zola better.
            </p>
          </motion.div>
        ) : (
          <motion.form
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            className="flex h-full flex-col"
            exit={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
            initial={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
            key="form"
            onSubmit={handleSubmit}
            transition={TRANSITION_CONTENT}
          >
            <motion.span
              animate={{
                opacity: feedback ? 0 : 1,
              }}
              aria-hidden="true"
              className="pointer-events-none absolute top-3.5 left-4 select-none text-muted-foreground text-sm leading-[1.4]"
              initial={{
                opacity: 1,
              }}
              transition={{
                duration: 0,
              }}
            >
              What would make Zola better for you?
            </motion.span>
            <textarea
              autoFocus
              className="h-full w-full resize-none rounded-md bg-transparent px-4 py-3.5 text-foreground text-sm outline-hidden"
              disabled={status === 'submitting'}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <div
              className="flex justify-between pt-2 pr-3 pb-3 pl-2"
              key="close"
            >
              <Button
                aria-label="Close"
                className="rounded-lg"
                disabled={status === 'submitting'}
                onClick={handleClose}
                size="sm"
                type="button"
                variant="ghost"
              >
                <CaretLeft className="text-foreground" size={16} />
              </Button>
              <Button
                aria-label="Submit feedback"
                className="rounded-lg"
                disabled={status === 'submitting' || !feedback.trim()}
                size="sm"
                type="submit"
                variant="outline"
              >
                <AnimatePresence mode="popLayout">
                  {status === 'submitting' ? (
                    <motion.span
                      animate={{ opacity: 1, y: 0 }}
                      className="inline-flex items-center gap-2"
                      exit={{ opacity: 0, y: -10 }}
                      initial={{ opacity: 0, y: 10 }}
                      key="submitting"
                      transition={TRANSITION_CONTENT}
                    >
                      <Spinner className="size-4 animate-spin" />
                      Sending...
                    </motion.span>
                  ) : (
                    <motion.span
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      initial={{ opacity: 0, y: 10 }}
                      key="send"
                      transition={TRANSITION_CONTENT}
                    >
                      Send
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
