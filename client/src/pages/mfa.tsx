import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, ArrowRight, Smartphone, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function MFAPage() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    
    setIsLoading(true);
    // Simulate verification
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2 border border-blue-100">
             <Smartphone className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Two-Factor Authentication</h1>
          <p className="text-muted-foreground">We sent a verification code to your registered device ending in **88</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-center">Enter 6-digit code</CardTitle>
          </CardHeader>
          <form onSubmit={handleVerify}>
            <CardContent className="flex flex-col items-center space-y-6">
              <div className="flex justify-center w-full max-w-[240px]">
                <Input 
                  className="text-center text-2xl tracking-[1em] font-mono h-14" 
                  maxLength={6} 
                  value={code} 
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
              </div>
              
              <div className="text-sm text-center">
                <p className="text-muted-foreground mb-1">Didn't receive the code?</p>
                {timeLeft > 0 ? (
                  <span className="text-muted-foreground text-xs font-mono">Resend in {timeLeft}s</span>
                ) : (
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-primary" 
                    type="button"
                    onClick={() => setTimeLeft(30)}
                  >
                    Resend Code
                  </Button>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button className="w-full" disabled={code.length !== 6 || isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Sign In"
                )}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setLocation("/login")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
