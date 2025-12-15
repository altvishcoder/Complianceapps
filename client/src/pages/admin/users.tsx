import { useState } from "react";
import { useLocation } from "wouter";
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
  Key
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

// Mock data for users
const INITIAL_USERS = [
  { id: 1, name: "Admin User", email: "admin@company.com", role: "Administrator", status: "Active", lastActive: "Just now" },
  { id: 2, name: "Sarah Johnson", email: "sarah@company.com", role: "Compliance Officer", status: "Active", lastActive: "2 hours ago" },
  { id: 3, name: "Michael Chen", email: "michael@company.com", role: "Auditor", status: "Pending", lastActive: "Never" },
  { id: 4, name: "Jessica Wu", email: "jessica@company.com", role: "Viewer", status: "Inactive", lastActive: "5 days ago" },
];

export default function AdminUsersPage() {
  console.log("AdminUsersPage mounting..."); 
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState(INITIAL_USERS);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Add User State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Viewer", password: "" });

  // Edit User State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState({ id: 0, name: "", email: "", role: "Viewer" });

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const user = {
      id: users.length + 1,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: "Active", // Auto-activate manually added users
      lastActive: "Never"
    };
    setUsers([...users, user]);
    setIsAddDialogOpen(false);
    setNewUser({ name: "", email: "", role: "Viewer", password: "" });
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUsers(users.map(u => u.id === editingUser.id ? { ...u, name: editingUser.name, email: editingUser.email, role: editingUser.role } : u));
    setIsEditDialogOpen(false);
  };

  const openEditDialog = (user: typeof INITIAL_USERS[0]) => {
    setEditingUser({ id: user.id, name: user.name, email: user.email, role: user.role });
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (id: number) => {
    setUsers(users.filter(u => u.id !== id));
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
  };

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage system access and user roles manually.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              Back to Dashboard
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Manually create a user account. They will be able to log in immediately.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddUser}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        value={newUser.name}
                        onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        placeholder="john@company.com"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Initial Password</Label>
                      <Input 
                        id="password" 
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role</Label>
                      <Select 
                        value={newUser.role} 
                        onValueChange={(val) => setNewUser({...newUser, role: val})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Administrator">Administrator</SelectItem>
                          <SelectItem value="Compliance Officer">Compliance Officer</SelectItem>
                          <SelectItem value="Auditor">Auditor</SelectItem>
                          <SelectItem value="Viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create Account</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user details.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditUser}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-name">Full Name</Label>
                      <Input 
                        id="edit-name" 
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input 
                        id="edit-email" 
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-role">Role</Label>
                      <Select 
                        value={editingUser.role} 
                        onValueChange={(val) => setEditingUser({...editingUser, role: val})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Administrator">Administrator</SelectItem>
                          <SelectItem value="Compliance Officer">Compliance Officer</SelectItem>
                          <SelectItem value="Auditor">Auditor</SelectItem>
                          <SelectItem value="Viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-2 border-t mt-2">
                        <Label htmlFor="reset-password">Reset Password</Label>
                        <div className="flex gap-2 mt-1.5">
                            <Input 
                                id="reset-password" 
                                type="password"
                                placeholder="New password"
                                className="text-sm"
                            />
                            <Button type="button" variant="outline" size="sm">
                                <Key className="mr-2 h-3 w-3" />
                                Reset
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Enter a new password to manually override the user's current password.
                        </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Changes</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Users</CardTitle>
            <CardDescription>
              A list of all users with access to the platform.
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
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.role === "Administrator" ? (
                              <Shield className="h-3 w-3 text-primary" />
                            ) : (
                              <Users className="h-3 w-3 text-muted-foreground" />
                            )}
                            {user.role}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            user.status === "Active" ? "default" : 
                            user.status === "Pending" ? "secondary" : "outline"
                          } className={
                            user.status === "Active" ? "bg-emerald-500 hover:bg-emerald-600" : ""
                          }>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.lastActive}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email)}>
                                <Mail className="mr-2 h-4 w-4" />
                                Copy Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStatusChange(user.id, user.status === "Active" ? "Inactive" : "Active")}>
                                {user.status === "Active" ? (
                                  <>
                                    <XCircle className="mr-2 h-4 w-4 text-orange-500" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteUser(user.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete User
                              </DropdownMenuItem>
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
      </div>
    </div>
  );
}
