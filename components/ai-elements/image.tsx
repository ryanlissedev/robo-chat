import type { Experimental_GeneratedImage } from 'ai';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const Image = ({ base64, mediaType, ...props }: ImageProps) => (
  <NextImage
    {...props}
    alt={props.alt || 'Generated image'}
    className={cn(
      'h-auto max-w-full overflow-hidden rounded-md',
      props.className
    )}
    height={512}
    src={`data:${mediaType};base64,${base64}`}
    width={512}
  />
);
