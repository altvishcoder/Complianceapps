import { Link } from "wouter";
import { ShieldCheck, LayoutDashboard, Settings, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 space-y-12">
      <div className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-display font-bold tracking-tight">ComplianceAI Suite</h1>
        <p className="text-xl text-muted-foreground max-w-lg mx-auto">
          Select the application portal you wish to access.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Business App Card */}
        <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg hover:border-primary/50">
          <div className="p-8 space-y-6">
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Business App</h3>
              <p className="text-muted-foreground">
                Access the main compliance dashboard, reports, and property management tools.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full h-12 text-base">
                Launch Business App
              </Button>
            </Link>
          </div>
          <div className="absolute inset-0 border-2 border-transparent group-hover:border-primary/10 rounded-xl pointer-events-none transition-colors" />
        </div>

        {/* Admin App Card */}
        <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg hover:border-orange-500/50">
          <div className="p-8 space-y-6">
            <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Admin Portal</h3>
              <p className="text-muted-foreground">
                Manage users, system configurations, and administrative controls.
              </p>
            </div>
            <Link href="/admin/users">
              <Button variant="outline" className="w-full h-12 text-base border-orange-200 hover:bg-orange-50 hover:text-orange-700">
                Launch Admin Portal
              </Button>
            </Link>
          </div>
          <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-500/10 rounded-xl pointer-events-none transition-colors" />
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>ComplianceAI Platform v1.0.0 • Local Development Build</p>
      </div>
    </div>
  );
}
