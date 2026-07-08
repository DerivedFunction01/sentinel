"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Crosshair,
  FileText,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  KeyRound,
  Rocket,
  BookOpen,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserRole, ADMIN_ROLES } from "@/lib/enums";
import { LogoIcon } from "@/components/shared/logo";

interface SidebarUser {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  scanTokens: number;
  role: string;
}

interface NavEntry {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  adminOnly?: boolean;
}

const NAV_ENTRIES: NavEntry[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/scan", label: "PenTest Scan", icon: Crosshair },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/analysis", label: "Analysis Console", icon: BarChart3 },
  { href: "/dashboard/manual-test", label: "Manual Playground", icon: MessageSquare },
  {
    href: "/dashboard/api-integration",
    label: "API Integration",
    icon: KeyRound,
  },
  {
    href: "/dashboard/agent-deployment",
    label: "Agent Deployment",
    icon: Rocket,
  },
  {
    href: "/dashboard/scan-export-format",
    label: "Scan Export Format",
    icon: BookOpen,
  },
  { href: "/dashboard/settings", label: "Settings & Billing", icon: Settings },
  { href: "/admin", label: "Admin Panel", icon: Shield, adminOnly: true },
];

export function DashboardSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const visibleEntries = NAV_ENTRIES.filter(
    (e) => !e.adminOnly || (ADMIN_ROLES as string[]).includes(user.role),
  );

  const isActive = (entry: NavEntry) => {
    if (entry.exact) return pathname === entry.href;
    return pathname === entry.href || pathname.startsWith(entry.href + "/");
  };

  const initials =
    (user.name?.[0] ?? "U") + (user.name?.split(" ")[1]?.[0] ?? "");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-60 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size="sm" />
          <span className="text-base font-bold text-sidebar-foreground">
            ToolRegistry
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleEntries.map((entry) => {
          const active = isActive(entry);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <entry.icon className="h-4 w-4" />
              {entry.label}
              {active && <ChevronRight className="ml-auto h-4 w-4" />}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar className="h-9 w-9 border border-sidebar-border">
            <AvatarFallback className="bg-blue-600/20 text-xs font-semibold text-blue-400">
              {initials.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.name || "User"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              {user.email}
            </p>
          </div>
        </div>

        {/* Token Balances */}
        <div className="mt-2 space-y-1 px-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-sidebar-foreground/50">Tokens</span>
            <span className="font-semibold text-sidebar-foreground">{user.scanTokens}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

export function MobileDashboardNav({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const visibleEntries = NAV_ENTRIES.filter(
    (e) => !e.adminOnly || (ADMIN_ROLES as string[]).includes(user.role),
  );

  const isActive = (entry: NavEntry) => {
    if (entry.exact) return pathname === entry.href;
    return pathname === entry.href || pathname.startsWith(entry.href + "/");
  };

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-2 py-2 scrollbar-thin md:hidden">
      <Link href="/" className="flex shrink-0 items-center gap-1.5 px-2">
        <LogoIcon size="sm" className="h-7 w-7 rounded-md" />
      </Link>
      {visibleEntries.map((entry) => {
        const active = isActive(entry);
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-blue-600/15 text-blue-400"
                : "text-sidebar-foreground/60",
            )}
          >
            <entry.icon className="h-3.5 w-3.5" />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
