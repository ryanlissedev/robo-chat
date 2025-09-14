'use client';

import { useEffect, useState } from 'react';

type Summary = {
  totalRequests: number;
  successfulRequests: number;
  errorRate: number;
  bySource: Record<
    string,
    { total: number; successful: number; errorRate: number }
  >;
  byProvider: Record<
    string,
    {
      total: number;
      successful: number;
      errorRate: number;
      avgResponseTime: number;
    }
  >;
  errors: {
    total: number;
    byType: Record<string, number>;
    byProvider: Record<string, number>;
  };
  timeRange: { start: string; end: string } | { start: Date; end: Date };
};

type ApiResponse = {
  summary: Summary;
  recent: {
    usage: Array<{
      timestamp: string | Date;
      source: string;
      provider: string;
      model: string;
      success: boolean;
      responseTime?: number;
    }>;
    errors: Array<{
      timestamp: string | Date;
      provider: string;
      errorType: string;
      errorMessage: string;
    }>;
  };
};

export function DiagnosticsPanel() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/diagnostics/credentials');
        if (!res.ok) {
          if (res.status === 403) {
            setError(
              'Not authorized. Ask an admin to add your email to ADMIN_EMAILS.'
            );
          } else {
            setError(`Failed to load diagnostics (${res.status})`);
          }
          setLoading(false);
          return;
        }
        const json = (await res.json()) as ApiResponse;
        if (active) setData(json);
      } catch (_e) {
        if (active) setError('Network error loading diagnostics');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading diagnostics…</div>;
  }
  if (error) {
    return <div className="text-red-600">{error}</div>;
  }
  if (!data) {
    return <div className="text-muted-foreground">No data.</div>;
  }

  const { summary, recent } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total Requests" value={summary.totalRequests} />
        <StatCard title="Success" value={summary.successfulRequests} />
        <StatCard
          title="Error Rate"
          value={`${Math.round(summary.errorRate * 100)}%`}
        />
        <StatCard title="Errors Logged" value={summary.errors.total} />
      </div>

      <section>
        <h3 className="mb-2 font-semibold">By Source</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Successful</th>
                <th className="py-2 pr-4">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.bySource).map(([src, v]) => (
                <tr key={src} className="border-b/50">
                  <td className="py-2 pr-4">{src}</td>
                  <td className="py-2 pr-4">{v.total}</td>
                  <td className="py-2 pr-4">{v.successful}</td>
                  <td className="py-2 pr-4">
                    {Math.round(v.errorRate * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">By Provider</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Successful</th>
                <th className="py-2 pr-4">Error Rate</th>
                <th className="py-2 pr-4">Avg Response (ms)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.byProvider).map(([p, v]) => (
                <tr key={p} className="border-b/50">
                  <td className="py-2 pr-4">{p}</td>
                  <td className="py-2 pr-4">{v.total}</td>
                  <td className="py-2 pr-4">{v.successful}</td>
                  <td className="py-2 pr-4">
                    {Math.round(v.errorRate * 100)}%
                  </td>
                  <td className="py-2 pr-4">{Math.round(v.avgResponseTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Recent Activity (60m)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Success</th>
                <th className="py-2 pr-4">Resp (ms)</th>
              </tr>
            </thead>
            <tbody>
              {recent.usage
                .slice(-50)
                .reverse()
                .map((u, idx) => (
                  <tr key={`${u.timestamp}-${idx}`} className="border-b/50">
                    <td className="py-2 pr-4">
                      {new Date(String(u.timestamp)).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-4">{u.source}</td>
                    <td className="py-2 pr-4">{u.provider}</td>
                    <td className="py-2 pr-4">{u.model}</td>
                    <td className="py-2 pr-4">{u.success ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">{u.responseTime ?? '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-muted-foreground text-sm">{title}</div>
      <div className="mt-1 font-semibold text-xl">{value}</div>
    </div>
  );
}
