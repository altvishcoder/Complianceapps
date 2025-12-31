import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { 
  Users, 
  UserPlus,
  MoreHorizontal, 
  Search, 
  Shield, 
  Mail, 
  Key,
  RefreshCw,
  Building,
  Wand2,
  Copy,
  Eye,
  EyeOff,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuth } from "@/contexts/AuthContext";

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
  const { user: currentUser, isLoading: authLoading } = useAuth();
  
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [addUserData, setAddUserData] = useState({ name: "", email: "", username: "", role: "VIEWER", password: "" });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);

  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const generateSecurePassword = () => {
    const length = 16;
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    const allChars = uppercase + lowercase + numbers + symbols;
    
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Password copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  };
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!currentUser?.id,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
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

  if (authLoading) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="text-center">
          <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Please log in to access this page</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = async () => {
    if (!addUserData.name || !addUserData.email || !addUserData.username || !addUserData.password) {
      toast({ title: "Error", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    
    setIsAddingUser(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(addUserData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast({ 
          title: "Error", 
          description: data.error || "Failed to create user.", 
          variant: "destructive" 
        });
        return;
      }
      
      toast({ 
        title: "User Created", 
        description: `${addUserData.name} has been added successfully.` 
      });
      setIsAddUserDialogOpen(false);
      setAddUserData({ name: "", email: "", username: "", role: "VIEWER", password: "" });
      setShowAddUserPassword(false);
      refetch();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to create user.", 
        variant: "destructive" 
      });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    
    setIsResettingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          userId: resetPasswordUser.id,
          newPassword: newPassword
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

  const currentUserRole = currentUser?.role || "";
  const canResetPassword = (targetRole: string) => {
    if (currentUserRole === "LASHAN_SUPER_USER") return true;
    if (currentUserRole === "SUPER_ADMIN" && targetRole !== "LASHAN_SUPER_USER") return true;
    if (currentUserRole === "SYSTEM_ADMIN" && !["LASHAN_SUPER_USER", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(targetRole)) return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="User Management" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display">User Management</h2>
                <p className="text-muted-foreground">Manage system access, user roles, and organization settings.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button onClick={() => setIsAddUserDialogOpen(true)} data-testid="button-add-user">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </div>

            <Tabs defaultValue="users" className="space-y-4">
              <TabsList>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Users
                </TabsTrigger>
                <TabsTrigger value="organization" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Organization
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users">
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
                                        OWNER
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
              </TabsContent>

              <TabsContent value="organization">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Organization Settings
                    </CardTitle>
                    <CardDescription>
                      Configure your organization details and default settings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <div className="relative">
                          <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input id="org-name" defaultValue="Acme Housing Association" className="pl-9" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Admin Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input id="admin-email" defaultValue="admin@acme-housing.co.uk" className="pl-9" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="mfa-policy">Default MFA Policy</Label>
                      <Select defaultValue="strict">
                        <SelectTrigger id="mfa-policy">
                          <SelectValue placeholder="Select policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strict">Strict (MFA Required for All)</SelectItem>
                          <SelectItem value="optional">Optional (User Discretion)</SelectItem>
                          <SelectItem value="admin_only">Admin Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button>
                        <Settings className="mr-2 h-4 w-4" />
                        Save Organization Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They will be able to log in immediately with the provided credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-user-name">Full Name</Label>
              <Input 
                id="add-user-name" 
                value={addUserData.name}
                onChange={(e) => setAddUserData({...addUserData, name: e.target.value})}
                placeholder="John Doe"
                data-testid="input-add-user-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-user-username">Username</Label>
              <Input 
                id="add-user-username" 
                value={addUserData.username}
                onChange={(e) => setAddUserData({...addUserData, username: e.target.value})}
                placeholder="johndoe"
                data-testid="input-add-user-username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-user-email">Email</Label>
              <Input 
                id="add-user-email" 
                type="email"
                value={addUserData.email}
                onChange={(e) => setAddUserData({...addUserData, email: e.target.value})}
                placeholder="john@company.com"
                data-testid="input-add-user-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-user-password">Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    id="add-user-password" 
                    type={showAddUserPassword ? "text" : "password"}
                    value={addUserData.password}
                    onChange={(e) => setAddUserData({...addUserData, password: e.target.value})}
                    placeholder="Enter or generate password"
                    data-testid="input-add-user-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowAddUserPassword(!showAddUserPassword)}
                  >
                    {showAddUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const pwd = generateSecurePassword();
                    setAddUserData({...addUserData, password: pwd});
                    setShowAddUserPassword(true);
                  }}
                  title="Generate Password"
                  data-testid="button-generate-password"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
                {addUserData.password && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(addUserData.password)}
                    title="Copy Password"
                    data-testid="button-copy-password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Click the wand to generate a secure password. Make sure to copy it before closing.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-user-role">Role</Label>
              <Select 
                value={addUserData.role} 
                onValueChange={(val) => setAddUserData({...addUserData, role: val})}
              >
                <SelectTrigger data-testid="select-add-user-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddUserDialogOpen(false); setShowAddUserPassword(false); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddUser} 
              disabled={isAddingUser}
              data-testid="button-confirm-add-user"
            >
              {isAddingUser ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordDialogOpen} onOpenChange={(open) => { setIsResetPasswordDialogOpen(open); if (!open) setShowResetPassword(false); }}>
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
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    id="new-password" 
                    type={showResetPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter or generate password"
                    data-testid="input-new-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const pwd = generateSecurePassword();
                    setNewPassword(pwd);
                    setShowResetPassword(true);
                  }}
                  title="Generate Password"
                  data-testid="button-generate-reset-password"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
                {newPassword && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newPassword)}
                    title="Copy Password"
                    data-testid="button-copy-reset-password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Click the wand to generate a secure password. Make sure to copy it before closing.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsResetPasswordDialogOpen(false); setShowResetPassword(false); }}>
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
  );
}
