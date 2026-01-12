import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { 
  Navigation, 
  Shield, 
  Save, 
  Check, 
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton, CardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

interface Role {
  id: string;
  name: string;
  description: string;
}

interface NavigationItem {
  id: string;
  name: string;
  slug: string;
  href: string;
  iconKey: string;
  displayOrder: number;
  requiresAdmin: boolean;
  requiresFactorySettings: boolean;
  requiresAITools: boolean;
  requiresRole: string | null;
  isSystem: boolean;
  isActive: boolean;
  allowedRoles: string[];
}

interface NavigationSection {
  id: string;
  title: string;
  slug: string;
  displayOrder: number;
  requiresRole: string | null;
  isSystem: boolean;
  isActive: boolean;
  items: NavigationItem[];
}

const ALL_ROLES = [
  'LASHAN_SUPER_USER',
  'SUPER_ADMIN', 
  'SYSTEM_ADMIN',
  'COMPLIANCE_MANAGER',
  'ADMIN',
  'MANAGER',
  'OFFICER',
  'VIEWER'
];

const ROLE_LABELS: Record<string, string> = {
  LASHAN_SUPER_USER: "Super",
  SUPER_ADMIN: "S.Admin",
  SYSTEM_ADMIN: "Sys",
  COMPLIANCE_MANAGER: "Comp",
  ADMIN: "Admin",
  MANAGER: "Mgr",
  OFFICER: "Off",
  VIEWER: "View"
};

export default function AdminNavigationManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  
  const [pendingChanges, setPendingChanges] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: navigation, isLoading } = useQuery<NavigationSection[]>({
    queryKey: ["/api/navigation"],
    queryFn: async () => {
      const res = await fetch("/api/navigation");
      if (!res.ok) throw new Error("Failed to fetch navigation");
      return res.json();
    }
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Array<{ itemId: string; roles: string[] }>) => {
      const res = await fetch("/api/admin/navigation/bulk-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ items: updates })
      });
      if (!res.ok) throw new Error("Failed to save changes");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Changes saved", description: "Navigation visibility settings have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/navigation"] });
      setPendingChanges({});
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to save changes. Please try again.", variant: "destructive" });
    }
  });

  const handleRoleToggle = (itemId: string, role: string, currentRoles: string[]) => {
    const existingChanges = pendingChanges[itemId] ?? currentRoles ?? [];
    const newRoles = existingChanges.includes(role)
      ? existingChanges.filter(r => r !== role)
      : [...existingChanges, role];
    
    setPendingChanges(prev => ({ ...prev, [itemId]: newRoles }));
  };

  const handleSaveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    
    setIsSaving(true);
    try {
      const updates = Object.entries(pendingChanges).map(([itemId, roles]) => ({
        itemId,
        roles
      }));
      await saveMutation.mutateAsync(updates);
    } finally {
      setIsSaving(false);
    }
  };

  const getEffectiveRoles = (item: NavigationItem): string[] => {
    return pendingChanges[item.id] ?? item.allowedRoles ?? [];
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const canManageNavigation = currentUser && ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role);

  if (!canManageNavigation) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header title="Navigation Management" />
          <main className="flex-1 overflow-auto p-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>You don't have permission to manage navigation settings.</p>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header title="Navigation Management" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2" data-testid="text-page-title">
                  <Navigation className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="hidden sm:inline">Navigation Management</span>
                  <span className="sm:hidden">Navigation</span>
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                  Role visibility controls for navigation items.
                </p>
              </div>
              <Button 
                onClick={handleSaveChanges}
                disabled={!hasChanges || isSaving}
                data-testid="button-save-changes"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
                {hasChanges && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.keys(pendingChanges).length}
                  </Badge>
                )}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Role Visibility Matrix
                </CardTitle>
                <CardDescription className="text-sm hidden sm:block">
                  Check roles for access. No selection = visible to all.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && !navigation ? (
                  <div className="space-y-4">
                    <TableSkeleton rows={6} columns={10} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Accordion type="multiple" defaultValue={navigation?.map(s => s.id) || []} className="w-full">
                      {navigation?.map((section) => (
                        <AccordionItem key={section.id} value={section.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{section.title}</span>
                              {section.isSystem && (
                                <Badge variant="outline" className="text-xs">System</Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {section.items?.length || 0} items
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[200px]">Navigation Item</TableHead>
                                    <TableHead className="w-[80px] text-center">Active</TableHead>
                                    {ALL_ROLES.map(role => (
                                      <TableHead key={role} className="text-center w-[70px]">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="cursor-help text-xs">{ROLE_LABELS[role]}</span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>{roles?.find(r => r.id === role)?.name || role}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {section.items?.map((item) => {
                                    const effectiveRoles = getEffectiveRoles(item);
                                    const hasItemChanges = pendingChanges[item.id] !== undefined;
                                    
                                    return (
                                      <TableRow 
                                        key={item.id} 
                                        className={hasItemChanges ? "bg-amber-50 dark:bg-amber-900/20" : ""}
                                        data-testid={`row-nav-item-${item.id}`}
                                      >
                                        <TableCell className="font-medium">
                                          <div className="flex items-center gap-2">
                                            <span>{item.name}</span>
                                            {item.isSystem && (
                                              <Badge variant="outline" className="text-xs">System</Badge>
                                            )}
                                          </div>
                                          <div className="text-xs text-muted-foreground">{item.href}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {item.isActive ? (
                                            <Eye className="h-4 w-4 text-green-500 mx-auto" />
                                          ) : (
                                            <EyeOff className="h-4 w-4 text-gray-400 mx-auto" />
                                          )}
                                        </TableCell>
                                        {ALL_ROLES.map(role => (
                                          <TableCell key={role} className="text-center">
                                            <Checkbox
                                              checked={effectiveRoles.includes(role)}
                                              onCheckedChange={() => handleRoleToggle(item.id, role, item.allowedRoles)}
                                              data-testid={`checkbox-${item.id}-${role}`}
                                            />
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Understanding Role-Based Visibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p><strong>Checked roles</strong> can see this navigation item.</p>
                </div>
                <div className="flex items-start gap-2">
                  <X className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p><strong>No roles checked</strong> means the item is visible to all authenticated users.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p><strong>System items</strong> have built-in role restrictions that work alongside these settings.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
