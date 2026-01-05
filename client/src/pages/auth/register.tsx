import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ShieldCheck, ArrowRight, User, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const username = formData.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          username: username,
          organisationId: "default-org",
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok || result.error) {
        setError(result.message || result.error?.message || "Registration failed. Please try again.");
        setIsLoading(false);
        return;
      }
      
      setIsLoading(false);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="mx-auto h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
             <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Registration Successful</h1>
          
          <Card className="border-border/50 shadow-lg text-left">
            <CardContent className="pt-6 space-y-4">
              <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
                <AlertTitle className="font-semibold text-emerald-900">Account Created</AlertTitle>
                <AlertDescription className="mt-2 text-sm">
                  Your account has been created successfully. You can now sign in with your email and password.
                </AlertDescription>
              </Alert>
              
              <div className="text-sm text-muted-foreground space-y-3 bg-muted/30 p-4 rounded-md border border-border/50">
                <p>You have been assigned the Viewer role by default.</p>
                <p>Contact your administrator to request additional permissions if needed.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => setLocation("/login")}>
                Continue to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
             <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">SocialComply</h1>
          <p className="text-muted-foreground">Create your Account</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>Enter your details to create an account</CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    className="pl-9"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required 
                    data-testid="input-name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required 
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Min 8 characters"
                    className="pl-9"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required 
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="Re-enter password"
                    className="pl-9"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    required 
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button className="w-full group" disabled={isLoading} data-testid="button-register">
                {isLoading ? "Creating Account..." : "Create Account"} 
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login">
                  <span className="font-medium text-primary hover:underline underline-offset-4 cursor-pointer">Sign in</span>
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
