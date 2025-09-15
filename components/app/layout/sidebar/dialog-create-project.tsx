'use client';

import React from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { fetchClient } from '@/lib/fetch';

type DialogCreateProjectProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

type CreateProjectData = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
};

export function DialogCreateProject({
  isOpen,
  setIsOpen,
}: DialogCreateProjectProps) {
  const [projectName, setProjectName] = useState('');
  const queryClient = useQueryClient();
  const router = useRouter();
  const createProjectMutation = useMutation({
    mutationFn: async (name: string): Promise<CreateProjectData> => {
      const response = await fetchClient('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/p/${data.id}`);
      setProjectName('');
      setIsOpen(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      createProjectMutation.mutate(projectName.trim());
    }
  };

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              value={projectName}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!projectName.trim() || createProjectMutation.isPending}
              type="submit"
            >
              {createProjectMutation.isPending
                ? 'Creating...'
                : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
