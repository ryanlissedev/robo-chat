'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  Database, 
  Upload, 
  File, 
  Trash, 
  Plus, 
  FolderOpen,
  FileText,
  FilePdf,
  FileCode,
  Download,
  MagnifyingGlass
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import OpenAI from 'openai'
import { useDropzone } from 'react-dropzone'

interface VectorStore {
  id: string
  name: string
  status: 'active' | 'processing' | 'error'
  file_count: number
  usage_bytes: number
  created_at: string
  expires_at?: string
}

interface VectorStoreFile {
  id: string
  vector_store_id: string
  file_id: string
  file_name: string
  file_size: number
  status: 'completed' | 'processing' | 'failed'
  created_at: string
}

interface VectorStoreManagerProps {
  userId: string
}

const FILE_ICONS = {
  pdf: FilePdf,
  txt: FileText,
  md: FileText,
  py: FileCode,
  js: FileCode,
  ts: FileCode,
  json: FileCode,
  default: File,
}

export function VectorStoreManager({ userId }: VectorStoreManagerProps) {
  const [vectorStores, setVectorStores] = useState<VectorStore[]>([])
  const [selectedStore, setSelectedStore] = useState<VectorStore | null>(null)
  const [storeFiles, setStoreFiles] = useState<VectorStoreFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [newStoreName, setNewStoreName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadVectorStores()
  }, [])

  useEffect(() => {
    if (selectedStore) {
      loadStoreFiles(selectedStore.id)
    }
  }, [selectedStore])

  const loadVectorStores = async () => {
    setLoading(true)
    try {
      // Get OpenAI API key
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', 'openai')
        .single()

      if (!keyData?.api_key) {
        toast.error('OpenAI API key required')
        return
      }

      const openai = new OpenAI({ 
        apiKey: keyData.api_key,
        dangerouslyAllowBrowser: true 
      })

      // List vector stores
      const response = await openai.beta.vectorStores.list()
      const stores = response.data.map(store => ({
        id: store.id,
        name: store.name || 'Unnamed Store',
        status: store.status as 'active' | 'processing' | 'error',
        file_count: store.file_counts?.total || 0,
        usage_bytes: store.usage_bytes || 0,
        created_at: new Date(store.created_at * 1000).toISOString(),
        expires_at: store.expires_at ? new Date(store.expires_at * 1000).toISOString() : undefined,
      }))

      setVectorStores(stores)
    } catch (error) {
      console.error('Error loading vector stores:', error)
      toast.error('Failed to load vector stores')
    } finally {
      setLoading(false)
    }
  }

  const loadStoreFiles = async (storeId: string) => {
    try {
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', 'openai')
        .single()

      if (!keyData?.api_key) return

      const openai = new OpenAI({ 
        apiKey: keyData.api_key,
        dangerouslyAllowBrowser: true 
      })

      const response = await openai.beta.vectorStores.files.list(storeId)
      const files = response.data.map(file => ({
        id: file.id,
        vector_store_id: storeId,
        file_id: file.id,
        file_name: 'File ' + file.id, // OpenAI doesn't return filename
        file_size: 0,
        status: file.status as 'completed' | 'processing' | 'failed',
        created_at: new Date(file.created_at * 1000).toISOString(),
      }))

      setStoreFiles(files)
    } catch (error) {
      console.error('Error loading store files:', error)
    }
  }

  const createVectorStore = async () => {
    if (!newStoreName) {
      toast.error('Please enter a name for the vector store')
      return
    }

    setLoading(true)
    try {
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', 'openai')
        .single()

      if (!keyData?.api_key) {
        toast.error('OpenAI API key required')
        return
      }

      const openai = new OpenAI({ 
        apiKey: keyData.api_key,
        dangerouslyAllowBrowser: true 
      })

      const vectorStore = await openai.beta.vectorStores.create({
        name: newStoreName,
        metadata: {
          user_id: userId,
          created_by: 'RoboRail',
        }
      })

      toast.success('Vector store created successfully')
      setNewStoreName('')
      await loadVectorStores()
    } catch (error) {
      console.error('Error creating vector store:', error)
      toast.error('Failed to create vector store')
    } finally {
      setLoading(false)
    }
  }

  const deleteVectorStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this vector store?')) return

    setLoading(true)
    try {
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', 'openai')
        .single()

      if (!keyData?.api_key) return

      const openai = new OpenAI({ 
        apiKey: keyData.api_key,
        dangerouslyAllowBrowser: true 
      })

      await openai.beta.vectorStores.del(storeId)
      
      toast.success('Vector store deleted')
      setSelectedStore(null)
      await loadVectorStores()
    } catch (error) {
      console.error('Error deleting vector store:', error)
      toast.error('Failed to delete vector store')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedStore) {
      toast.error('Please select a vector store first')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', 'openai')
        .single()

      if (!keyData?.api_key) {
        toast.error('OpenAI API key required')
        return
      }

      const openai = new OpenAI({ 
        apiKey: keyData.api_key,
        dangerouslyAllowBrowser: true 
      })

      const totalFiles = acceptedFiles.length
      let completed = 0

      for (const file of acceptedFiles) {
        try {
          // Upload file to OpenAI
          const uploadedFile = await openai.files.create({
            file: file,
            purpose: 'assistants',
          })

          // Add file to vector store
          await openai.beta.vectorStores.files.create(
            selectedStore.id,
            {
              file_id: uploadedFile.id,
            }
          )

          completed++
          setUploadProgress((completed / totalFiles) * 100)
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error)
          toast.error(`Failed to upload ${file.name}`)
        }
      }

      toast.success(`Uploaded ${completed} of ${totalFiles} files`)
      await loadStoreFiles(selectedStore.id)
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Failed to upload files')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [selectedStore, userId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'text/x-python': ['.py'],
      'text/javascript': ['.js', '.jsx'],
      'text/typescript': ['.ts', '.tsx'],
    },
    disabled: !selectedStore || uploading,
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return FILE_ICONS[ext as keyof typeof FILE_ICONS] || FILE_ICONS.default
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create New Vector Store</CardTitle>
          <CardDescription>
            Vector stores allow you to search through your documents using semantic search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter vector store name"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
            />
            <Button 
              onClick={createVectorStore} 
              disabled={loading || !newStoreName}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Store
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Your Vector Stores</CardTitle>
            <CardDescription>
              Select a store to manage files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading vector stores...
              </div>
            ) : vectorStores.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No vector stores yet. Create one to get started.
              </div>
            ) : (
              vectorStores.map(store => (
                <div
                  key={store.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedStore?.id === store.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedStore(store)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="font-medium">{store.name}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteVectorStore(store.id)
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{store.file_count} files</span>
                    <span>{formatBytes(store.usage_bytes)}</span>
                    <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                      {store.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedStore ? `Files in ${selectedStore.name}` : 'Select a Vector Store'}
            </CardTitle>
            <CardDescription>
              {selectedStore ? 'Upload files to add them to your vector store' : 'Choose a store to view and manage files'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStore ? (
              <div className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {isDragActive ? (
                    <p>Drop the files here...</p>
                  ) : (
                    <div>
                      <p>Drag & drop files here, or click to select</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported: PDF, TXT, MD, JSON, CSV, Code files
                      </p>
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-sm text-muted-foreground">
                      Uploading files... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {storeFiles.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No files uploaded yet
                    </div>
                  ) : (
                    storeFiles.map(file => {
                      const Icon = getFileIcon(file.file_name)
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{file.file_name}</span>
                          </div>
                          <Badge variant={
                            file.status === 'completed' ? 'default' : 
                            file.status === 'processing' ? 'secondary' : 
                            'destructive'
                          }>
                            {file.status}
                          </Badge>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-2" />
                <p>Select a vector store to view files</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}