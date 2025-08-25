import { ChatContainer } from '@/components/app/chat/chat-container';
import { LayoutApp } from '@/components/app/layout/layout-app';
import { MessagesProvider } from '@/lib/chat-store/messages/provider';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <MessagesProvider>
      <LayoutApp>
        <ChatContainer />
      </LayoutApp>
    </MessagesProvider>
  );
}
