'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type FeedbackType = 'upvote' | 'downvote' | null;

type MessageFeedbackProps = {
  messageId: string;
  initialFeedback?: FeedbackType;
  onFeedback?: (feedback: FeedbackType, comment?: string) => Promise<void>;
  langsmithRunId?: string;
  className?: string;
};

export function MessageFeedback({
  messageId,
  initialFeedback = null,
  onFeedback,
  langsmithRunId,
  className,
}: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<FeedbackType>(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [comment, setComment] = useState('');
  const [pendingFeedback, setPendingFeedback] = useState<FeedbackType>(null);

  const handleFeedback = async (
    type: FeedbackType,
    feedbackComment?: string
  ) => {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      // Toggle feedback if clicking the same button
      const newFeedback = feedback === type ? null : type;

      // Call the feedback API
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedback: newFeedback,
          comment: feedbackComment,
          runId: langsmithRunId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setFeedback(newFeedback);

      // Call the optional callback
      if (onFeedback) {
        await onFeedback(newFeedback, feedbackComment);
      }

      // Show success toast
      if (newFeedback) {
        toast.success(
          newFeedback === 'upvote'
            ? 'Thanks for your feedback!'
            : "Thanks for letting us know. We'll improve."
        );
      } else {
        toast.success('Feedback removed');
      }

      // Close comment dialog if open
      setShowCommentDialog(false);
      setComment('');
      setPendingFeedback(null);
    } catch {
      toast.error('Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleDownvote = () => {
    setPendingFeedback('downvote');
    setShowCommentDialog(true);
  };

  const submitDownvote = () => {
    handleFeedback(pendingFeedback, comment);
  };

  return (
    <>
      <div className={cn('flex items-center gap-1', className)}>
        <button
          aria-label="Upvote message"
          className={cn(
            'rounded-md p-1.5 transition-all',
            'hover:bg-accent/50',
            feedback === 'upvote' && 'bg-accent',
            loading && 'cursor-not-allowed opacity-50'
          )}
          disabled={loading}
          onClick={() => handleFeedback('upvote')}
          title="This was helpful"
        >
          <ThumbsUp
            className={cn(
              'h-4 w-4',
              feedback === 'upvote' ? 'text-green-500' : 'text-muted-foreground'
            )}
            weight={feedback === 'upvote' ? 'fill' : 'regular'}
          />
        </button>

        <button
          aria-label="Downvote message"
          className={cn(
            'rounded-md p-1.5 transition-all',
            'hover:bg-accent/50',
            feedback === 'downvote' && 'bg-accent',
            loading && 'cursor-not-allowed opacity-50'
          )}
          disabled={loading}
          onClick={handleDownvote}
          title="This wasn't helpful"
        >
          <ThumbsDown
            className={cn(
              'h-4 w-4',
              feedback === 'downvote' ? 'text-red-500' : 'text-muted-foreground'
            )}
            weight={feedback === 'downvote' ? 'fill' : 'regular'}
          />
        </button>
      </div>

      <Dialog onOpenChange={setShowCommentDialog} open={showCommentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Help us improve</DialogTitle>
            <DialogDescription>
              What went wrong with this response? Your feedback helps us get
              better.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              className="min-h-[100px]"
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what could be improved... (optional)"
              value={comment}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowCommentDialog(false);
                setComment('');
                setPendingFeedback(null);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={loading} onClick={submitDownvote}>
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact version for inline use
export function MessageFeedbackInline({
  messageId,
  initialFeedback = null,
  onFeedback,
  langsmithRunId,
  className,
}: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<FeedbackType>(initialFeedback);
  const [loading, setLoading] = useState(false);

  const handleQuickFeedback = async (type: FeedbackType) => {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      const newFeedback = feedback === type ? null : type;

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedback: newFeedback,
          runId: langsmithRunId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setFeedback(newFeedback);

      if (onFeedback) {
        await onFeedback(newFeedback);
      }
    } catch {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('ml-2 inline-flex items-center gap-0.5', className)}>
      <button
        className={cn(
          'rounded p-1 transition-all',
          'hover:bg-accent/50',
          feedback === 'upvote' && 'text-green-500',
          !feedback && 'text-muted-foreground/50',
          loading && 'cursor-not-allowed opacity-50'
        )}
        disabled={loading}
        onClick={() => handleQuickFeedback('upvote')}
        title="Helpful"
      >
        <ThumbsUp
          className="h-3 w-3"
          weight={feedback === 'upvote' ? 'fill' : 'regular'}
        />
      </button>
      <button
        className={cn(
          'rounded p-1 transition-all',
          'hover:bg-accent/50',
          feedback === 'downvote' && 'text-red-500',
          !feedback && 'text-muted-foreground/50',
          loading && 'cursor-not-allowed opacity-50'
        )}
        disabled={loading}
        onClick={() => handleQuickFeedback('downvote')}
        title="Not helpful"
      >
        <ThumbsDown
          className="h-3 w-3"
          weight={feedback === 'downvote' ? 'fill' : 'regular'}
        />
      </button>
    </div>
  );
}
