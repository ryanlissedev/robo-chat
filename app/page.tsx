import { ChatContainer } from '@/components/app/chat/chat-container';
import { LayoutApp } from '@/components/app/layout/layout-app';
import { MessagesProvider } from '@/lib/chat-store/messages/provider';
import { ChatSessionProvider } from '@/lib/chat-store/session/provider';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <ChatSessionProvider>
      <MessagesProvider>
        <LayoutApp>
          <ChatContainer />
        </LayoutApp>
      </MessagesProvider>
    </ChatSessionProvider>
  );
}
