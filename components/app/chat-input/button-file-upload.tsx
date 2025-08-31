import { FileUp, Paperclip } from 'lucide-react';
import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from '@/components/prompt-kit/file-upload';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getModelInfo } from '@/lib/models';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import { cn } from '@/lib/utils';
import { PopoverContentAuth } from './popover-content-auth';

type ButtonFileUploadProps = {
  onFileUpload: (files: File[]) => void;
  isUserAuthenticated: boolean;
  model: string;
};

export function ButtonFileUpload({
  onFileUpload,
  isUserAuthenticated,
  model,
}: ButtonFileUploadProps) {
  if (!isSupabaseEnabled()) {
    return null;
  }

  const isFileUploadAvailable = getModelInfo(model)?.vision;

  if (!isFileUploadAvailable) {
    return (
      <Popover data-testid="popover">
        <Tooltip data-testid="tooltip">
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                aria-label="Add files"
                className="size-9 rounded-full border border-border bg-transparent dark:bg-secondary"
                size="sm"
                type="button"
                variant="secondary"
              >
                <Paperclip className="size-4" data-testid="paperclip-icon" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent data-testid="tooltip-content">
            Add files
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="p-2" data-testid="popover-content">
          <div className="text-secondary-foreground text-sm">
            This model does not support file uploads.
            <br />
            Please select another model.
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (!isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                aria-label="Add files"
                className="size-9 rounded-full border border-border bg-transparent dark:bg-secondary"
                size="sm"
                type="button"
                variant="secondary"
              >
                <Paperclip className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add files</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    );
  }

  return (
    <FileUpload
      accept=".txt,.md,image/jpeg,image/png,image/gif,image/webp,image/svg,image/heic,image/heif"
      disabled={!isUserAuthenticated}
      multiple
      onFilesAdded={onFileUpload}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <FileUploadTrigger asChild>
            <Button
              aria-label="Add files"
              className={cn(
                'size-9 rounded-full border border-border bg-transparent dark:bg-secondary',
                !isUserAuthenticated && 'opacity-50'
              )}
              disabled={!isUserAuthenticated}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Paperclip className="size-4" />
            </Button>
          </FileUploadTrigger>
        </TooltipTrigger>
        <TooltipContent>Add files</TooltipContent>
      </Tooltip>
      <FileUploadContent>
        <div className="flex flex-col items-center rounded-lg border border-input border-dashed bg-background p-8">
          <FileUp
            className="size-8 text-muted-foreground"
            data-testid="file-up-icon"
          />
          <span className="mt-4 mb-1 font-medium text-lg">Drop files here</span>
          <span className="text-muted-foreground text-sm">
            Drop any files here to add it to the conversation
          </span>
        </div>
      </FileUploadContent>
    </FileUpload>
  );
}
