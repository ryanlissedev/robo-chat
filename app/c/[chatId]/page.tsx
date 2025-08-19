import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function Page() {
  // Allow guest users to access chat pages
  // Authentication check removed to support guest users
  
  return (
    <MessagesProvider>
      <LayoutApp>
        <ChatContainer />
      </LayoutApp>
    </MessagesProvider>
  )
}
