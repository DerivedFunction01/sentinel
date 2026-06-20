"use client";

import { useState } from "react";
import { Users, Mail, Building2, Coins, Shield, Loader2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserRole } from "@/lib/enums";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  company: string | null;
  scanTokens: number;
  createdAt: string;
  _count: { scans: number; tokenRequests: number };
}

interface UserManagementClientProps {
  users: UserRow[];
}

const ROLE_STYLES: Record<string, string> = {
  [UserRole.SuperAdmin]: "border-red-500/30 bg-red-500/10 text-red-400",
  [UserRole.CustomerAdmin]: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  [UserRole.User]: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export function UserManagementClient({ users: initialUsers }: UserManagementClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.company?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update role");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success("Role updated");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdating(null);
    }
  };

  const handleTokenAdjust = async (userId: string, delta: number) => {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tokenDelta: delta }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to adjust tokens");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, scanTokens: data.scanTokens } : u)));
      toast.success(`Tokens ${delta > 0 ? "added" : "removed"}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all users, change roles, and adjust token balances.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name, or company…"
          className="pl-9"
        />
      </div>

      {/* User list */}
      <div className="space-y-3">
        {filtered.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{u.name || "—"}</span>
                    <Badge variant="outline" className={ROLE_STYLES[u.role] || ROLE_STYLES[UserRole.User]}>
                      {u.role}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                    {u.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{u.company}</span>}
                    <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{u.scanTokens} tokens</span>
                    <span>{u._count.scans} scans</span>
                    <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)} disabled={updating === u.id}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark">
                      <SelectItem value={UserRole.User}>User</SelectItem>
                      <SelectItem value={UserRole.CustomerAdmin}>Customer Admin</SelectItem>
                      <SelectItem value={UserRole.SuperAdmin}>Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => handleTokenAdjust(u.id, 10)} disabled={updating === u.id}>
                    +10
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => handleTokenAdjust(u.id, -10)} disabled={updating === u.id}>
                    -10
                  </Button>
                  {updating === u.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No users found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
