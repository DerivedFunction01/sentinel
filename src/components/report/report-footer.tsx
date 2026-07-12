import { APP_NAME } from "@/lib/constants";
export function ReportFooter() {
  return (
    <div className="flex items-center justify-between pb-8 text-xs text-muted-foreground">
      <span>{APP_NAME} · Security Insights Report · Confidential</span>
    </div>
  );
}
