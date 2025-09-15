'use client';

import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import { DialogDeleteProject } from '@/components/app/layout/sidebar/dialog-delete-project';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Project = {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
};

type SidebarProjectMenuProps = {
  project: Project;
  onStartEditing: () => void;
  onMenuOpenChange?: (open: boolean) => void;
};

export function SidebarProjectMenu({
  project,
  onStartEditing,
  onMenuOpenChange,
}: SidebarProjectMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const isMobile = useBreakpoint(768);

  return (
    <>
      <DropdownMenu
        // shadcn/ui / radix pointer-events-none issue
        modal={!!isMobile}
        onOpenChange={onMenuOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150 hover:bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="text-primary" size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onStartEditing();
            }}
          >
            <Pencil className="mr-2" size={16} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDeleteDialogOpen(true);
            }}
            variant="destructive"
          >
            <Trash className="mr-2" size={16} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogDeleteProject
        isOpen={isDeleteDialogOpen}
        project={project}
        setIsOpen={setIsDeleteDialogOpen}
      />
    </>
  );
}
