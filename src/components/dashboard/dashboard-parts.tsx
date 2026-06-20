import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "default" | "blue" | "red" | "amber" | "emerald";
  sublabel?: string;
}

const ACCENT_STYLES = {
  default: "text-foreground",
  blue: "text-blue-400",
  red: "text-red-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
};

const ICON_BG = {
  default: "bg-muted text-muted-foreground",
  blue: "bg-blue-600/15 text-blue-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "default",
  sublabel,
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold tracking-tight",
              ACCENT_STYLES[accent],
            )}
          >
            {value}
          </p>
          {sublabel && (
            <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              ICON_BG[accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
