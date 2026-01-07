import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { ShieldCheck, ArrowRight, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ROLES = [
  "LASHAN_SUPER_USER",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "ADMIN",
  "COMPLIANCE_MANAGER"
];

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, isAuthenticated, user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const urlError = params.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchString]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const userRole = user.role?.toUpperCase() || "";
      const isAdmin = ADMIN_ROLES.some(role => role.toUpperCase() === userRole);
      
      if (isAdmin) {
        setLocation("/admin/system-health");
      } else {
        setError("Access denied. Admin privileges required.");
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || "Login failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-14 w-14 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mb-2 ring-2 ring-amber-500/30">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white">Admin Portal</h1>
          <p className="text-slate-400">Restricted Access - Administrators Only</p>
        </div>

        <Card className="border-amber-500/30 bg-slate-800/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Admin Sign In
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your administrator credentials
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/50 border-red-500/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Admin Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@company.co.uk" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="bg-slate-700/50 border-slate-600 text-white"
                  data-testid="input-admin-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                className="w-full bg-amber-600 hover:bg-amber-700 text-white group" 
                disabled={isLoading} 
                data-testid="button-admin-login"
              >
                {isLoading ? "Authenticating..." : "Access Admin Portal"} 
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
              
              <div className="text-center text-sm">
                <a href="/login" className="text-slate-400 hover:text-white transition-colors">
                  Return to Standard Login
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>
        
        <div className="text-center text-xs text-slate-500">
          <p>This portal is restricted to authorized administrators.</p>
          <p className="mt-1">All access attempts are logged and monitored.</p>
        </div>
      </div>
    </div>
  );
}
