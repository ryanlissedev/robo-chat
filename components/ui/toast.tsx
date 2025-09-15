'use client';

import React from 'react';

import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { Button } from './button';

type ToastProps = {
  id: string | number;
  title: string;
  description?: string;
  button?: {
    label: string;
    onClick: () => void;
  };
  status?: 'error' | 'info' | 'success' | 'warning';
};

function Toast({ title, description, button, id, status }: ToastProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-input bg-popover p-4 shadow-xs backdrop-blur-xl">
      <div className="flex flex-1 items-center">
        {status === 'error' ? (
          <AlertTriangle className="mr-3 size-4 text-primary" />
        ) : null}
        {status === 'info' ? (
          <Info className="mr-3 size-4 text-primary" />
        ) : null}
        {status === 'success' ? (
          <CheckCircle className="mr-3 size-4 text-primary" />
        ) : null}
        <div className="w-full">
          <p className="font-medium text-foreground text-sm">{title}</p>
          {description && (
            <p className="mt-1 text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </div>
      {button ? (
        <div className="shrink-0">
          <Button
            onClick={() => {
              button?.onClick();
              sonnerToast.dismiss(id);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {button?.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function toast(toast: Omit<ToastProps, 'id'>) {
  return sonnerToast.custom(
    (id) => (
      <Toast
        button={toast?.button}
        description={toast?.description}
        id={id}
        status={toast?.status}
        title={toast.title}
      />
    ),
    {
      position: 'top-center',
    }
  );
}

export { toast };
