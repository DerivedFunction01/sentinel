"use client";

import { use, useEffect, useState } from "react";
import { getCachedScanDetail, setCachedScanDetail } from "@/lib/indexed-db";
import { ReportView } from "./report-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReportPage({ params }: PageProps) {
  const { id } = use(params);
  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function syncScanDetail(forceLoadingState = false) {
    if (forceLoadingState) setLoading(true);
    try {
      const res = await fetch(`/api/scan/${id}`);
      const data = await res.json();
      if (data.scan) {
        setScan(data.scan);
        await setCachedScanDetail(id, data.scan);
      }
    } catch (err) {
      console.error("Failed to sync scan details:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        const cached = await getCachedScanDetail(id);
        if (cached) {
          setScan(cached);
          setLoading(false);
        }
        await syncScanDetail(cached === null);
      } catch (err) {
        console.error("Error loading scan details:", err);
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    await syncScanDetail(false);
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">Scan report not found.</p>
      </div>
    );
  }

  return (
    <ReportView
      scan={scan}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  );
}
