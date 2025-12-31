import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Captcha } from "@/components/ui/captcha";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    const result = await login(username, password);
    
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setError(result.error || "Login failed");
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
             <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">ComplianceAI</h1>
          <p className="text-muted-foreground">Secure Enterprise Access</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  type="text" 
                  placeholder="Enter your username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button variant="link" className="px-0 font-normal text-xs h-auto" type="button">
                    Forgot password?
                  </Button>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm font-normal">Remember me for 30 days</Label>
              </div>

              <div className="pt-2">
                <Captcha />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button className="w-full group" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"} 
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link href="/register">
                  <span className="font-medium text-primary hover:underline underline-offset-4 cursor-pointer">Register here</span>
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          Protected by Enterprise Grade Security. <br/>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>

        <div className="bg-slate-950 text-slate-300 p-4 rounded-md text-xs font-mono space-y-2 border border-slate-800">
          <p className="font-bold text-slate-100 border-b border-slate-800 pb-1 mb-2">Demo Credentials</p>
          <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
             <span>Super Admin:</span>
             <span className="text-emerald-400">superadmin</span>
          </div>
          <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
             <span>Password:</span>
             <span className="text-emerald-400">SuperAdmin2025!</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-800">
            * Use these credentials to access restricted Admin areas.
          </div>
        </div>
      </div>
    </div>
  );
}
