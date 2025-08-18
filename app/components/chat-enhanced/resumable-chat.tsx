"use client";

import React, { useEffect, useState } from "react";
import { useResumableChat } from "@/app/hooks/use-resumable-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  User,
  Bot,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumableChatProps {
  chatId?: string;
  className?: string;
}

export function ResumableChat({ chatId, className }: ResumableChatProps) {
  const [input, setInput] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "offline">("connected");

  const {
    messages,
    handleSubmit,
    isLoading,
    error,
    isResuming,
    resumeError,
    resumeStream,
    hasActiveStream,
    reload,
    stop
  } = useResumableChat({
    id: chatId,
    onFinish: (message) => {
      console.log("Chat finished:", message);
    },
    onError: (error) => {
      console.error("Chat error:", error);
    }
  });

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus("connected");
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Handle form submission
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    handleSubmit(e, {
      options: {
        body: { content: input }
      }
    });
    setInput("");
  };

  // Manual resume handler
  const handleManualResume = async () => {
    setConnectionStatus("reconnecting");
    try {
      await resumeStream();
      setConnectionStatus("connected");
    } catch (error) {
      setConnectionStatus("offline");
    }
  };

  return (
    <div className={cn("flex flex-col h-full max-w-4xl mx-auto", className)}>
      {/* Header with Status */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">RoboRail Assistant Chat</CardTitle>
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <Badge 
                variant={isOnline ? "default" : "destructive"}
                className="flex items-center gap-2"
              >
                {isOnline ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {connectionStatus === "reconnecting" ? "Reconnecting..." : 
                 connectionStatus === "offline" ? "Offline" : "Online"}
              </Badge>
              
              {/* Stream Status */}
              {hasActiveStream && (
                <Badge variant="outline" className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Streaming
                </Badge>
              )}
              
              {/* Resume Button */}
              {(resumeError || !isOnline) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualResume}
                  disabled={isResuming}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={cn("w-3 h-3", isResuming && "animate-spin")} />
                  Resume
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Alerts */}
      <AnimatePresence>
        {(error || resumeError) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error?.message || resumeError?.message || "An error occurred"}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualResume}
                  className="ml-2"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Start a conversation with RoboRail Assistant</p>
                  <p className="text-sm mt-1">Your chat will automatically resume if interrupted</p>
                </div>
              )}
              
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex gap-3 p-4 rounded-lg",
                      message.role === "user" 
                        ? "bg-primary/10 ml-8" 
                        : "bg-muted mr-8"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {message.role === "user" ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="w-4 h-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="w-4 h-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {message.content}
                      </div>
                      
                      {/* Message metadata */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {message.createdAt && new Date(message.createdAt).toLocaleTimeString()}
                        {message.role === "assistant" && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Delivered</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 p-4 rounded-lg bg-muted mr-8"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        RoboRail Assistant is thinking...
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>
          
          <Separator />
          
          {/* Input Area */}
          <form onSubmit={onSubmit} className="p-4">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask RoboRail Assistant about technical support..."
                className="flex-1 min-h-[60px] resize-none"
                disabled={isLoading || !isOnline}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading || !isOnline}
                  size="sm"
                  className="h-auto px-4 py-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
                {isLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stop}
                    size="sm"
                    className="h-auto px-4 py-2"
                  >
                    Stop
                  </Button>
                )}
              </div>
            </div>
            
            {/* Input hints */}
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Press Enter to send, Shift+Enter for new line</span>
              {chatId && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Auto-resumable (ID: {chatId.slice(-6)})
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}