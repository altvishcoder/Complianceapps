import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  MoreHorizontal, 
  Search, 
  Shield, 
  Mail, 
  CheckCircle, 
  XCircle,
  Trash2,
  Edit,
  Key,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  organisationId: string | null;
  createdAt?: string;
}

const ROLE_LABELS: Record<string, string> = {
  LASHAN_SUPER_USER: "Lashan Super User",
  SUPER_ADMIN: "Super Admin",
  SYSTEM_ADMIN: "System Admin",
  COMPLIANCE_MANAGER: "Compliance Manager",
  ADMIN: "Admin",
  MANAGER: "Manager",
  OFFICER: "Officer",
  VIEWER: "Viewer"
};

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "SYSTEM_ADMIN", label: "System Admin" },
  { value: "COMPLIANCE_MANAGER", label: "Compliance Manager" },
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "OFFICER", label: "Officer" },
  { value: "VIEWER", label: "Viewer" }
];

export default function AdminUsersPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", username: "", role: "VIEWER", password: "" });

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role updated", description: "User role has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
    }
  });

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    
    setIsResettingPassword(true);
    try {
      const currentUserId = localStorage.getItem("user_id");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetPasswordUser.id,
          newPassword: newPassword,
          requestingUserId: currentUserId
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast({ 
          title: "Error", 
          description: data.error || "Failed to reset password.", 
          variant: "destructive" 
        });
        return;
      }
      
      toast({ 
        title: "Password Reset", 
        description: `Password for ${resetPasswordUser.name} has been reset successfully.` 
      });
      setIsResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to reset password.", 
        variant: "destructive" 
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openResetPasswordDialog = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword("");
    setIsResetPasswordDialogOpen(true);
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const getRoleIcon = (role: string) => {
    if (role === "LASHAN_SUPER_USER" || role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN") {
      return <Shield className="h-3 w-3 text-primary" />;
    }
    return <Users className="h-3 w-3 text-muted-foreground" />;
  };

  const currentUserRole = localStorage.getItem("user_role");
  const canResetPassword = (targetRole: string) => {
    if (currentUserRole === "LASHAN_SUPER_USER") return true;
    if (currentUserRole === "SUPER_ADMIN" && targetRole !== "LASHAN_SUPER_USER") return true;
    if (currentUserRole === "SYSTEM_ADMIN" && !["LASHAN_SUPER_USER", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(targetRole)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage system access and user roles.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Users</CardTitle>
            <CardDescription>
              A list of all users with access to the platform. Total: {users.length} users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search users..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-users"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Change Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                            {user.role === "LASHAN_SUPER_USER" && (
                              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 text-[10px]">
                                SUPER ADMIN
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {getRoleIcon(user.role)}
                            <span className="ml-1.5">{ROLE_LABELS[user.role] || user.role}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500 hover:bg-emerald-600">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role !== "LASHAN_SUPER_USER" ? (
                            <Select 
                              value={user.role} 
                              onValueChange={(val) => handleRoleChange(user.id, val)}
                            >
                              <SelectTrigger className="w-[160px]" data-testid={`select-role-${user.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">Protected</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${user.id}`}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email)}>
                                <Mail className="mr-2 h-4 w-4" />
                                Copy Email
                              </DropdownMenuItem>
                              {canResetPassword(user.role) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                                    <Key className="mr-2 h-4 w-4 text-amber-600" />
                                    Reset Password
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for <strong>{resetPasswordUser?.name}</strong> ({resetPasswordUser?.username}).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input 
                  id="new-password" 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  data-testid="input-new-password"
                />
                <p className="text-xs text-muted-foreground">
                  The password will be encrypted and stored securely.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleResetPassword} 
                disabled={!newPassword || isResettingPassword}
                data-testid="button-confirm-reset-password"
              >
                {isResettingPassword ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
