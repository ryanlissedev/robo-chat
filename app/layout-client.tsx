'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { API_ROUTE_CSRF } from '@/lib/routes';

const GuestKeyPortal = dynamic(
  () =>
    import('@/components/common/credentials/GuestKeyPortal').then(
      (m) => m.GuestKeyPortal
    ),
  { ssr: false }
);

export function LayoutClient() {
  useQuery({
    queryKey: ['csrf-init'],
    queryFn: async () => {
      await fetch(API_ROUTE_CSRF);
      return true;
    },
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return mounted ? <GuestKeyPortal /> : null;
}
