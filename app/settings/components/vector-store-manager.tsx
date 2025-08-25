'use client';

import {
  Database,
  File,
  FileCode,
  FilePdf,
  FileText,
  FolderOpen,
  Plus,
  Trash,
  Upload,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
// Uses server API routes under /api/vector-stores

type VectorStore = {
  id: string;
  name: string;
  status: 'active' | 'processing' | 'error';
  file_count: number;
  usage_bytes: number;
  created_at: string;
  expires_at?: string;
};

type VectorStoreFile = {
  id: string;
  vector_store_id: string;
  file_id: string;
  file_name: string;
  file_size: number;
  status: 'completed' | 'processing' | 'failed';
  created_at: string;
};

type VectorStoreManagerProps = {
  userId?: string;
};

const FILE_ICONS = {
  pdf: FilePdf,
  txt: FileText,
  md: FileText,
  py: FileCode,
  js: FileCode,
  ts: FileCode,
  json: FileCode,
  default: File,
};

export function VectorStoreManager({ }: VectorStoreManagerProps) {
  const [vectorStores, setVectorStores] = useState<VectorStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<VectorStore | null>(null);
  const [storeFiles, setStoreFiles] = useState<VectorStoreFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newStoreName, setNewStoreName] = useState('');
  // Vector store operations are performed via server API routes backed by OpenAI SDK

  const loadVectorStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vector-stores', { method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch vector stores');
      const data = await res.json();
      const stores = (data.stores || []) as Array<{
        id: string; name: string; created_at?: string; status?: string; usage_bytes?: number; file_counts?: { total: number }
      }>;
      setVectorStores(
        stores.map((s) => ({
          id: s.id,
          name: s.name,
          status: (s.status as VectorStore['status']) || 'active',
          file_count: s.file_counts?.total ?? 0,
          usage_bytes: s.usage_bytes ?? 0,
          created_at: s.created_at || new Date().toISOString(),
        }))
      );
    } catch {
      toast.error('Failed to load vector stores');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStoreFiles = useCallback(async (storeId: string) => {
    try {
      const res = await fetch(`/api/vector-stores/${storeId}/files`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      const files = (data.files || []) as Array<{
        id: string; file_id?: string; filename?: string; name?: string; created_at?: string; status?: string; bytes?: number
      }>;
      const mapped: VectorStoreFile[] = files.map((f) => ({
        id: f.id,
        vector_store_id: storeId,
        file_id: f.file_id || f.id,
        file_name: f.filename || f.name || 'file',
        file_size: f.bytes ?? 0,
        status: (f.status as VectorStoreFile['status']) || 'completed',
        created_at: f.created_at || new Date().toISOString(),
      }));
      setStoreFiles(mapped);
    } catch {}
  }, []);

  useEffect(() => {
    loadVectorStores();
  }, [loadVectorStores]);

  useEffect(() => {
    if (selectedStore) {
      loadStoreFiles(selectedStore.id);
    }
  }, [selectedStore, loadStoreFiles]);

  const createVectorStore = async () => {
    if (!newStoreName) {
      toast.error('Please enter a name for the vector store');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/vector-stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoreName }),
      });
      if (!res.ok) throw new Error('Create failed');
      toast.success('Vector store created successfully');
      setNewStoreName('');
      await loadVectorStores();
    } catch {
      toast.error('Failed to create vector store');
    } finally {
      setLoading(false);
    }
  };

  const deleteVectorStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this vector store?')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/vector-stores/${storeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Vector store deleted');
      setSelectedStore(null);
      await loadVectorStores();
    } catch {
      toast.error('Failed to delete vector store');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!selectedStore) {
        toast.error('Please select a vector store first');
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        const totalFiles = acceptedFiles.length;
        let completed = 0;
        for (const file of acceptedFiles) {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch(`/api/vector-stores/${selectedStore.id}/files`, {
            method: 'POST',
            body: form,
          });
          if (!res.ok) throw new Error('Upload failed');
          completed++;
          setUploadProgress((completed / totalFiles) * 100);
        }
        toast.success(`Uploaded ${completed} of ${totalFiles} files`);
        await loadStoreFiles(selectedStore.id);
      } catch {
        toast.error('Failed to upload files');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [selectedStore, loadStoreFiles]
  );

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
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return FILE_ICONS[ext as keyof typeof FILE_ICONS] || FILE_ICONS.default;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create New Vector Store</CardTitle>
          <CardDescription>
            Vector stores allow you to search through your documents using
            semantic search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="Enter vector store name"
              value={newStoreName}
            />
            <Button
              disabled={loading || !newStoreName}
              onClick={createVectorStore}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Store
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Vector Stores</CardTitle>
            <CardDescription>Select a store to manage files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="py-4 text-center text-muted-foreground">
                Loading vector stores...
              </div>
            ) : vectorStores.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">
                No vector stores yet. Create one to get started.
              </div>
            ) : (
              vectorStores.map((store) => (
                <div
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    selectedStore?.id === store.id
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="font-medium">{store.name}</span>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVectorStore(store.id);
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex gap-4 text-muted-foreground text-xs">
                    <span>{store.file_count} files</span>
                    <span>{formatBytes(store.usage_bytes)}</span>
                    <Badge
                      variant={
                        store.status === 'active' ? 'default' : 'secondary'
                      }
                    >
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
              {selectedStore
                ? `Files in ${selectedStore.name}`
                : 'Select a Vector Store'}
            </CardTitle>
            <CardDescription>
              {selectedStore
                ? 'Upload files to add them to your vector store'
                : 'Choose a store to view and manage files'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStore ? (
              <div className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    isDragActive
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted'
                  } ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  {isDragActive ? (
                    <p>Drop the files here...</p>
                  ) : (
                    <div>
                      <p>Drag & drop files here, or click to select</p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        Supported: PDF, TXT, MD, JSON, CSV, Code files
                      </p>
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-muted-foreground text-sm">
                      Uploading files... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}

                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {storeFiles.length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground">
                      No files uploaded yet
                    </div>
                  ) : (
                    storeFiles.map((file) => {
                      const Icon = getFileIcon(file.file_name);
                      return (
                        <div
                          className="flex items-center justify-between rounded p-2 hover:bg-muted"
                          key={file.id}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{file.file_name}</span>
                          </div>
                          <Badge
                            variant={
                              file.status === 'completed'
                                ? 'default'
                                : file.status === 'processing'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {file.status}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <FolderOpen className="mx-auto mb-2 h-12 w-12" />
                <p>Select a vector store to view files</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
