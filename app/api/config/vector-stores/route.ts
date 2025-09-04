import { NextResponse } from 'next/server';
import { getVectorStoreConfig } from '@/lib/utils/environment-loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { vectorStoreIds, hasVectorStores } = getVectorStoreConfig();
  return NextResponse.json({
    hasVectorStores,
    count: vectorStoreIds.length,
    vectorStoreIds,
  });
}
