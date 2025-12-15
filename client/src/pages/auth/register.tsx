import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ShieldCheck, ArrowRight, User, Mail, Building, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import { Captcha } from "@/components/ui/captcha";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    org: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate network request
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="mx-auto h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
             <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Registration Submitted</h1>
          
          <Card className="border-border/50 shadow-lg text-left">
            <CardContent className="pt-6 space-y-4">
              <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                <AlertTitle className="font-semibold text-blue-900">Pending Approval</AlertTitle>
                <AlertDescription className="mt-2 text-sm">
                  Your account has been created successfully. For security reasons, all new registrations require manual approval.
                </AlertDescription>
              </Alert>
              
              <div className="text-sm text-muted-foreground space-y-3 bg-muted/30 p-4 rounded-md border border-border/50">
                <p>An approval request has been sent to the system administrator.</p>
                <p>You will receive an email notification once your account is active.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/login")}>
                Return to Login
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
          <h1 className="text-3xl font-display font-bold tracking-tight">ComplianceAI</h1>
          <p className="text-muted-foreground">Create your Enterprise Account</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>Enter your details to request access</CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
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
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@company.com" 
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org">Organization</Label>
                <div className="relative">
                  <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="org" 
                    placeholder="Company Name" 
                    className="pl-9"
                    value={formData.org}
                    onChange={(e) => setFormData({...formData, org: e.target.value})}
                    required 
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
                    className="pl-9"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div className="pt-2">
                <Captcha />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button className="w-full group" disabled={isLoading}>
                {isLoading ? "Submitting..." : "Request Access"} 
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login">
                  <a className="font-medium text-primary hover:underline underline-offset-4">Sign in</a>
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
