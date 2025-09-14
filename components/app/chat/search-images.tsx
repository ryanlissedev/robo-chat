import Image from 'next/image';
import { useState } from 'react';
import { addUTM, getFavicon, getSiteName } from './utils';

type ImageResult = {
  title: string;
  imageUrl: string;
  sourceUrl: string;
};

export function SearchImages({ results }: { results: ImageResult[] }) {
  const [hiddenIndexes, setHiddenIndexes] = useState<Set<number>>(new Set());

  const handleError = (index: number) => {
    setHiddenIndexes((prev) => new Set(prev).add(index));
  };

  if (!results?.length) {
    return null;
  }

  return (
    <div className="my-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {results.map((img, i) => {
        const favicon = getFavicon(img.sourceUrl);
        const shouldShowFavicon = favicon && img.sourceUrl.trim();
        return hiddenIndexes.has(i) ? null : (
          <div key={`${img.imageUrl}-${img.sourceUrl}`} className="relative">
            <a
              className="group/image relative block overflow-hidden rounded-xl"
              href={addUTM(img.sourceUrl)}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt={img.title}
                className="h-full max-h-48 min-h-40 w-full object-cover opacity-0 transition-opacity duration-150 ease-out"
                onError={() => handleError(i)}
                onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.remove('opacity-0')}
                src={img.imageUrl}
              />
              <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-0.5 bg-primary px-2.5 py-1.5 opacity-0 transition-opacity duration-100 ease-out group-hover/image:opacity-100">
                <div className="flex items-center gap-1">
                  <span className="line-clamp-1 text-secondary text-xs">
                    {getSiteName(img.sourceUrl)}
                  </span>
                </div>
                <span className="line-clamp-1 text-secondary text-xs">
                  {img.title}
                </span>
              </div>
            </a>
            {shouldShowFavicon && (
              <a
                href={addUTM(img.sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2 z-10"
              >
                <Image
                  alt="favicon"
                  className="h-4 w-4 rounded-full"
                  src={favicon}
                />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
