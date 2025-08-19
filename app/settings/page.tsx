'use client'

import { Header } from '@/app/components/layout/header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Key, Database, Shield, Brain } from '@phosphor-icons/react'
import { VectorStoreManager } from './components/vector-store-manager'
import { ApiKeyManager } from './components/api-key-manager'
import { RetrievalSettings } from './components/retrieval-settings'
import { SecuritySettings } from './components/security-settings'
import { useUser } from '@/lib/user-store/provider'
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  const { user } = useUser()
  
  // Redirect if not authenticated
  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex h-full flex-col">
      <Header hasSidebar={false} />
      
      <main className="flex-1 overflow-y-auto pt-app-header">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your API keys, vector stores, and retrieval configuration
            </p>
          </div>

          <Tabs defaultValue="api-keys" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="api-keys" className="gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="vector-stores" className="gap-2">
                <Database className="h-4 w-4" />
                Vector Stores
              </TabsTrigger>
              <TabsTrigger value="retrieval" className="gap-2">
                <Brain className="h-4 w-4" />
                Retrieval
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api-keys" className="space-y-4">
              <ApiKeyManager userId={user.id} />
            </TabsContent>

            <TabsContent value="vector-stores" className="space-y-4">
              <VectorStoreManager userId={user.id} />
            </TabsContent>

            <TabsContent value="retrieval" className="space-y-4">
              <RetrievalSettings userId={user.id} />
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <SecuritySettings userId={user.id} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}