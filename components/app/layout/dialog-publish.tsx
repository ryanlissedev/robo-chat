'use client';

import { Check, Copy, Globe, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import XIcon from '@/components/icons/x';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChatSession } from '@/lib/chat-store/session/provider';
import { APP_DOMAIN } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseEnabled } from '@/lib/supabase/config';

export function DialogPublish() {
  const [openDialog, setOpenDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { chatId } = useChatSession();
  const isMobile = useBreakpoint(768);
  const [copied, setCopied] = useState(false);

  if (!isSupabaseEnabled()) {
    return null;
  }

  if (!chatId) {
    return null;
  }

  const publicLink = `${APP_DOMAIN}/share/${chatId}`;

  const openPage = () => {
    setOpenDialog(false);

    window.open(publicLink, '_blank');
  };

  const shareOnX = () => {
    setOpenDialog(false);

    const X_TEXT = `Check out this public page I created with Zola! ${publicLink}`;
    window.open(`https://x.com/intent/tweet?text=${X_TEXT}`, '_blank');
  };

  const handlePublish = async () => {
    setIsLoading(true);

    const supabase = createClient();

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    const { data, error } = await (supabase as any)
      .from('chats')
      // Cast to any to satisfy TS inference issues with Supabase types
      .update({ public: true } as any)
      .eq('id', chatId)
      .select()
      .single();

    if (error) {
    }

    if (data) {
      setIsLoading(false);
      setOpenDialog(true);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);

    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const trigger = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="rounded-full bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            disabled={isLoading}
            onClick={handlePublish}
            size="icon"
            variant="ghost"
          >
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Globe className="size-5" />
            )}
            <span className="sr-only">Make public</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Make public</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const content = (
    <>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Input className="flex-1" id="slug" readOnly value={publicLink} />
              <Button
                className="absolute top-0 right-0 rounded-l-none bg-background transition-colors hover:bg-background"
                onClick={copyLink}
                variant="outline"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={openPage} variant="outline">
          View Page
        </Button>
        <Button className="flex-1" onClick={shareOnX}>
          Share on <XIcon className="size-4 text-primary-foreground" />
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer onOpenChange={setOpenDialog} open={openDialog}>
          <DrawerContent className="border-border bg-background">
            <DrawerHeader>
              <DrawerTitle>Your conversation is now public!</DrawerTitle>
              <DrawerDescription>
                Anyone with the link can now view this conversation and may
                appear in community feeds, featured pages, or search results in
                the future.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-4 px-4 pb-6">{content}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog onOpenChange={setOpenDialog} open={openDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Your conversation is now public!</DialogTitle>
            <DialogDescription>
              Anyone with the link can now view this conversation and may appear
              in community feeds, featured pages, or search results in the
              future.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
}
