import Image from 'next/image';
import type React from 'react';
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
    <div className="my-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {results.map((img, i) => {
        const favicon = getFavicon(img.sourceUrl);
        const shouldShowFavicon = favicon && img.sourceUrl.trim();
        return (
          <div key={`${img.imageUrl}-${img.sourceUrl}`} className="relative">
            <a
              className="group relative block overflow-hidden rounded-lg bg-gray-100 aspect-video"
              href={addUTM(img.sourceUrl)}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt={img.title}
                className={`w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 ${
                  hiddenIndexes.has(i) ? 'hidden' : ''
                }`}
                onError={() => handleError(i)}
                onLoad={(e: React.SyntheticEvent<HTMLImageElement>) =>
                  e.currentTarget.classList.remove('opacity-0')
                }
                src={img.imageUrl}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute left-0 right-0 bottom-0 p-3">
                  <div className="flex items-center gap-1">
                    <span className="line-clamp-1 text-secondary text-xs">
                      {getSiteName(img.sourceUrl)}
                    </span>
                  </div>
                  <span className="line-clamp-1 text-secondary text-xs">
                    {img.title}
                  </span>
                </div>
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
