"use client";

import { useState } from "react";
import { Users, Mail, Building2, Coins, Loader2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  currentUser: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    company: string | null;
    scanTokens: number;
  };
}

const ROLE_STYLES: Record<string, string> = {
  [UserRole.SuperAdmin]: "border-red-500/30 bg-red-500/10 text-red-400",
  [UserRole.CustomerAdmin]: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  [UserRole.User]: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export function UserManagementClient({
  users: initialUsers,
  currentUser,
}: UserManagementClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  // Dialog / Add User Form States
  const [isOpen, setIsOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>(UserRole.User);
  const [newUserCompany, setNewUserCompany] = useState(
    currentUser.company || "",
  );
  const [adding, setAdding] = useState(false);

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
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
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
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, scanTokens: data.scanTokens } : u,
        ),
      );
      toast.success(`Tokens ${delta > 0 ? "added" : "removed"}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdating(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) {
      toast.error("Email and password are required");
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          company: newUserCompany,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create user");
        return;
      }
      toast.success("User created successfully");
      const added = {
        ...data,
        _count: { scans: 0, tokenRequests: 0 },
      };
      setUsers((prev) => [added, ...prev]);
      setIsOpen(false);
      // Reset form fields
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole(UserRole.User);
      setNewUserCompany(currentUser.company || "");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          User Management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentUser.role === UserRole.SuperAdmin
            ? "View all users, change roles, and adjust token balances."
            : `Manage users and customer admins for ${currentUser.company || "your company"}.`}
        </p>
      </div>

      {/* Toolbar: Search + Add User */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or company…"
            className="pl-9"
          />
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">Add User</Button>
          </DialogTrigger>
          <DialogContent className="dark sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password (min 6 chars)</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={setNewUserRole}>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="dark">
                    <SelectItem value={UserRole.User}>User</SelectItem>
                    <SelectItem value={UserRole.CustomerAdmin}>
                      Customer Admin
                    </SelectItem>
                    {currentUser.role === UserRole.SuperAdmin && (
                      <SelectItem value={UserRole.SuperAdmin}>
                        Super Admin
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Company Name"
                  value={newUserCompany}
                  onChange={(e) => setNewUserCompany(e.target.value)}
                  disabled={currentUser.role === UserRole.CustomerAdmin}
                />
              </div>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={adding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={adding}
                >
                  {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* User list */}
      <div className="space-y-3">
        {filtered.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {u.name || "—"}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        ROLE_STYLES[u.role] || ROLE_STYLES[UserRole.User]
                      }
                    >
                      {u.role}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {u.email}
                    </span>
                    {u.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {u.company}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {u.scanTokens} tokens
                    </span>
                    <span>{u._count.scans} scans</span>
                    <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={(v) => handleRoleChange(u.id, v)}
                    disabled={
                      updating === u.id ||
                      (currentUser.role === UserRole.CustomerAdmin &&
                        u.role === UserRole.SuperAdmin)
                    }
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark">
                      <SelectItem value={UserRole.User}>User</SelectItem>
                      <SelectItem value={UserRole.CustomerAdmin}>
                        Customer Admin
                      </SelectItem>
                      {currentUser.role === UserRole.SuperAdmin && (
                        <SelectItem value={UserRole.SuperAdmin}>
                          Super Admin
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleTokenAdjust(u.id, 10)}
                    disabled={updating === u.id}
                  >
                    +10
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleTokenAdjust(u.id, -10)}
                    disabled={updating === u.id}
                  >
                    -10
                  </Button>
                  {updating === u.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
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
