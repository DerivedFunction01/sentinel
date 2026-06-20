import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getScanByReportId } from "@/lib/scan-db";
import { ReportView } from "./report-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const scan = await getScanByReportId(id, user.id);
  if (!scan) notFound();

  return <ReportView scan={scan} />;
}
