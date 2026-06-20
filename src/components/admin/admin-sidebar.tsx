"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Shield,
  ShieldAlert,
  ArrowLeft,
  LogOut,
  ChevronRight,
  KeyRound,
  Users,
  CreditCard,
  Mail,
  Settings,
  Coins,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/lib/enums";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogoIcon } from "@/components/shared/logo";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface NavEntry {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

/** Super admin nav — platform-level management. */
const SUPER_ADMIN_NAV: NavEntry[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/token-requests", label: "Token Requests", icon: Coins },
  { href: "/admin/user-management", label: "User Management", icon: Users },
];

/** Customer admin nav — org-level management. */
const CUSTOMER_ADMIN_NAV: NavEntry[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/api-admin", label: "API Admin", icon: KeyRound },
  { href: "/admin/user-management", label: "User Management", icon: Users },
  {
    href: "/admin/billing-management",
    label: "Billing Management",
    icon: CreditCard,
  },
  { href: "/admin/email-center", label: "Email Center", icon: Mail },
  {
    href: "/admin/system-management",
    label: "System Management",
    icon: Settings,
  },
];

interface AdminSidebarProps {
  user: AdminUser;
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = user.role === UserRole.SuperAdmin;
  const nav = isSuperAdmin ? SUPER_ADMIN_NAV : CUSTOMER_ADMIN_NAV;
  const panelTitle = isSuperAdmin ? "Super Admin" : "Customer Admin";

  const isActive = (entry: NavEntry) => {
    if (entry.exact) return pathname === entry.href;
    return pathname === entry.href || pathname.startsWith(entry.href + "/");
  };

  const initials =
    (user.name?.[0] ?? "A") + (user.name?.split(" ")[1]?.[0] ?? "");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size="sm" />
          <span className="text-base font-bold text-sidebar-foreground">
            SentinelPrompt
          </span>
        </Link>
      </div>

      <div className="px-3 py-2">
        <span className="flex items-center gap-2 rounded-lg bg-blue-600/10 px-3 py-2 text-sm font-medium text-blue-400">
          <ShieldAlert className="h-4 w-4" />
          {panelTitle}
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((entry) => {
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

      <div className="px-3 pb-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

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
              {user.name || "Admin"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              {user.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

export function MobileAdminNav({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = user.role === UserRole.SuperAdmin;
  const nav = isSuperAdmin ? SUPER_ADMIN_NAV : CUSTOMER_ADMIN_NAV;

  const isActive = (entry: NavEntry) => {
    if (entry.exact) return pathname === entry.href;
    return pathname === entry.href || pathname.startsWith(entry.href + "/");
  };

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-2 py-2 scrollbar-thin md:hidden">
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-1.5 px-2"
      >
        <ArrowLeft className="h-4 w-4 text-sidebar-foreground/60" />
      </Link>
      {nav.map((entry) => {
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
