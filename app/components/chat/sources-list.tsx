"use client"

import { cn } from "@/lib/utils"
import type { SourceUrlUIPart, SourceDocumentUIPart } from 'ai'
import { CaretDown, Link } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { addUTM, formatUrl, getFavicon } from "./utils"

type SourcesListProps = {
  sources: (SourceUrlUIPart | SourceDocumentUIPart)[]
  className?: string
}

const TRANSITION = {
  type: "spring" as const,
  duration: 0.2,
  bounce: 0,
}

export function SourcesList({ sources, className }: SourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set())

  const handleFaviconError = (url: string) => {
    setFailedFavicons((prev) => new Set(prev).add(url))
  }

  return (
    <div className={cn("my-4", className)}>
      <div className="border-border flex flex-col gap-0 overflow-hidden rounded-md border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-sm">
            Sources
            <div className="flex -space-x-1">
              {sources?.map((source, index) => {
                const sourceUrl = (source as { url?: string }).url || ''
                const faviconUrl = getFavicon(sourceUrl)
                const showFallback =
                  !faviconUrl || failedFavicons.has(sourceUrl)

                return showFallback ? (
                  <div
                    key={`${sourceUrl}-${index}`}
                    className="bg-muted border-background h-4 w-4 rounded-full border"
                  />
                ) : (
                  <Image
                    key={`${sourceUrl}-${index}`}
                    src={faviconUrl}
                    alt={`Favicon for ${source.title}`}
                    width={16}
                    height={16}
                    className="border-background h-4 w-4 rounded-sm border"
                    onError={() => handleFaviconError(sourceUrl)}
                  />
                )
              })}
              {sources.length > 3 && (
                <span className="text-muted-foreground ml-1 text-xs">
                  +{sources.length - 3}
                </span>
              )}
            </div>
          </div>
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180 transform" : ""
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
              className="overflow-hidden"
            >
              <ul className="space-y-2 px-3 pt-3 pb-3">
                {sources.map((source, index) => {
                  const sourceUrl = (source as { url?: string }).url || ''
                  const sourceId = (source as { sourceId?: string; id?: string }).sourceId || (source as { sourceId?: string; id?: string }).id || `source-${index}`
                  const faviconUrl = getFavicon(sourceUrl)
                  const showFallback =
                    !faviconUrl || failedFavicons.has(sourceUrl)

                  return (
                    <li key={sourceId} className="flex items-center text-sm">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <a
                          href={addUTM(sourceUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary group line-clamp-1 flex items-center gap-1 hover:underline"
                        >
                          {showFallback ? (
                            <div className="bg-muted h-4 w-4 flex-shrink-0 rounded-full" />
                          ) : (
                            <Image
                              src={faviconUrl}
                              alt={`Favicon for ${source.title}`}
                              width={16}
                              height={16}
                              className="h-4 w-4 flex-shrink-0 rounded-sm"
                              onError={() => handleFaviconError(sourceUrl)}
                            />
                          )}
                          <span className="truncate">{source.title}</span>
                          <Link className="inline h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                        </a>
                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {formatUrl(sourceUrl)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
