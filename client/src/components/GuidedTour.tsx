import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  X, ChevronLeft, ChevronRight, LayoutDashboard, Building2, 
  FileCheck, Radar, Bot, HelpCircle, Sparkles, Play
} from 'lucide-react';
import { useLocation } from 'wouter';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  icon: React.ElementType;
  route?: string;
  action?: 'click' | 'hover';
  highlight?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    description: 'This is your main navigation hub. All platform features are organized into clear sections: Command Centre for dashboards, Asset Management for properties, Operations for daily tasks, and Administration for settings. On mobile devices, tap the menu icon in the top-left to open it.',
    targetSelector: '[data-testid="sidebar-content"]',
    position: 'right',
    icon: LayoutDashboard,
    route: '/dashboard',
    highlight: true
  },
  {
    id: 'dashboard',
    title: 'Command Centre',
    description: 'Your compliance overview at a glance. Here you\'ll see: total properties and their compliance status, certificates expiring soon, outstanding remedial actions, and risk scores across your portfolio. The charts update in real-time as you add new data.',
    targetSelector: '[data-testid="nav-item-overview"]',
    position: 'right',
    icon: LayoutDashboard,
    route: '/dashboard'
  },
  {
    id: 'properties',
    title: 'Property Management',
    description: 'Manage your entire property portfolio here. Properties are organized following UK Housing Data Standards (UKHDS): Schemes (estates/developments) contain Blocks (buildings), which contain Properties (individual dwellings). You can add, edit, and view compliance status for each level.',
    targetSelector: '[data-testid="nav-item-properties"]',
    position: 'right',
    icon: Building2,
    route: '/properties'
  },
  {
    id: 'certificates',
    title: 'Certificates',
    description: 'Upload and manage all compliance certificates here. Simply drag and drop PDF documents - our AI will automatically extract key details like certificate type, issue date, expiry date, and compliance outcomes. Supports gas safety, electrical, fire risk, asbestos, and 80+ other certificate types.',
    targetSelector: '[data-testid="nav-item-certificates"]',
    position: 'right',
    icon: FileCheck,
    route: '/certificates'
  },
  {
    id: 'risk-radar',
    title: 'Risk Radar',
    description: 'Monitor compliance risks with our ML-powered predictive analysis. The radar shows properties ranked by risk score, predicts when certificates will expire, and highlights areas needing immediate attention. Red items are high priority, amber need review, and green are compliant.',
    targetSelector: '[data-testid="nav-item-risk-radar"]',
    position: 'right',
    icon: Radar,
    route: '/risk-radar'
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    description: 'Your intelligent compliance helper is always available via this chat button. Ask questions like "Which properties have expired gas certificates?" or "What are the requirements for HMO fire safety?" The assistant can search your data, explain regulations, and guide you through complex compliance topics.',
    targetSelector: '[data-testid="button-open-ai-assistant"]',
    position: 'top',
    icon: Bot,
    highlight: true
  },
  {
    id: 'help',
    title: 'Help & Resources',
    description: 'Need more guidance? The Help section contains detailed written guides, video tutorials for common tasks, and links to official UK legislation and standards. You can also restart this tour anytime from the Help menu.',
    targetSelector: '[data-testid="nav-item-help-guide"]',
    position: 'right',
    icon: HelpCircle,
    route: '/help'
  }
];

const TOUR_STORAGE_KEY = 'complianceai_guided_tour_complete';
const TOUR_STARTED_KEY = 'complianceai_guided_tour_started';

export function GuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [, navigate] = useLocation();

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  const findTarget = useCallback(() => {
    if (!step) return null;
    const element = document.querySelector(step.targetSelector);
    if (element) {
      return element.getBoundingClientRect();
    }
    return null;
  }, [step]);

  useEffect(() => {
    if (!isActive) return;

    const updatePosition = () => {
      const rect = findTarget();
      setTargetRect(rect);
    };

    updatePosition();
    
    const interval = setInterval(updatePosition, 100);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, currentStep, findTarget]);

  useEffect(() => {
    if (isActive && step?.route) {
      const currentPath = window.location.pathname;
      if (currentPath !== step.route) {
        navigate(step.route);
        setTimeout(() => {
          const rect = findTarget();
          setTargetRect(rect);
        }, 300);
      }
    }
  }, [isActive, step, navigate, findTarget]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.setItem(TOUR_STARTED_KEY, 'true');
    if (TOUR_STEPS[0]?.route) {
      navigate(TOUR_STEPS[0].route);
    }
  }, [navigate]);

  const endTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    window.dispatchEvent(new CustomEvent('guided-tour-complete'));
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  }, [currentStep, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  useEffect(() => {
    const handleStartTour = () => startTour();
    window.addEventListener('start-guided-tour', handleStartTour);
    return () => window.removeEventListener('start-guided-tour', handleStartTour);
  }, [startTour]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      if (e.key === 'Escape') endTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
      if (e.key === 'ArrowLeft') prevStep();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, endTour]);

  if (!isActive) return null;

  const Icon = step.icon;

  const getTooltipPosition = () => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const padding = 16;
    const tooltipWidth = 384;
    const tooltipHeight = 280;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
    }

    top = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, top));
    left = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, left));

    return { top: `${top}px`, left: `${left}px` };
  };

  const tooltipStyle = getTooltipPosition();

  return createPortal(
    <div className="fixed inset-0 z-[100]" data-testid="guided-tour-overlay">
      {targetRect ? (
        <>
          <div 
            className="absolute bg-black/50 transition-all duration-300"
            style={{ top: 0, left: 0, right: 0, height: targetRect.top - 8 }}
            onClick={endTour}
          />
          <div 
            className="absolute bg-black/50 transition-all duration-300"
            style={{ top: targetRect.bottom + 8, left: 0, right: 0, bottom: 0 }}
            onClick={endTour}
          />
          <div 
            className="absolute bg-black/50 transition-all duration-300"
            style={{ 
              top: targetRect.top - 8, 
              left: 0, 
              width: targetRect.left - 8,
              height: targetRect.height + 16
            }}
            onClick={endTour}
          />
          <div 
            className="absolute bg-black/50 transition-all duration-300"
            style={{ 
              top: targetRect.top - 8, 
              left: targetRect.right + 8, 
              right: 0,
              height: targetRect.height + 16
            }}
            onClick={endTour}
          />
          <div
            className="absolute rounded-xl ring-4 ring-primary ring-offset-4 ring-offset-transparent transition-all duration-300 pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          />
        </>
      ) : (
        <div 
          className="absolute inset-0 bg-black/50 transition-opacity duration-300"
          onClick={endTour}
        />
      )}

      <Card 
        className="absolute w-96 shadow-2xl border-primary/20 bg-background/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={tooltipStyle}
        data-testid="tour-tooltip"
      >
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <Badge variant="secondary" className="text-xs mt-1">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </Badge>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 -mr-2 -mt-2"
              onClick={endTour}
              data-testid="tour-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>

          <Progress value={progress} className="h-1.5" />

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="gap-1"
              data-testid="tour-prev"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={endTour}
                data-testid="tour-skip"
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={nextStep}
                className="gap-1"
                data-testid="tour-next"
              >
                {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}

const ONBOARDING_KEY = 'complianceai_onboarding_complete';

export function TourTriggerButton() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  
  useEffect(() => {
    const checkAndShowPrompt = () => {
      const tourComplete = localStorage.getItem(TOUR_STORAGE_KEY);
      const tourStarted = localStorage.getItem(TOUR_STARTED_KEY);
      const onboardingComplete = localStorage.getItem(ONBOARDING_KEY);
      
      setHasCompleted(tourComplete === 'true');
      
      if (!tourComplete && !tourStarted && onboardingComplete === 'true') {
        setShowPrompt(true);
      }
    };
    
    checkAndShowPrompt();
    
    const interval = setInterval(checkAndShowPrompt, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleTourComplete = () => {
      setHasCompleted(true);
      setShowPrompt(false);
    };
    
    window.addEventListener('guided-tour-complete', handleTourComplete);
    return () => window.removeEventListener('guided-tour-complete', handleTourComplete);
  }, []);

  const startTour = () => {
    setShowPrompt(false);
    window.dispatchEvent(new CustomEvent('start-guided-tour'));
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem(TOUR_STARTED_KEY, 'true');
  };

  if (hasCompleted) return null;

  return (
    <>
      {showPrompt && createPortal(
        <Card 
          className="fixed bottom-24 right-6 z-[200] w-80 shadow-2xl border-primary/20 animate-in slide-in-from-right-5 duration-500"
          data-testid="tour-prompt"
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Welcome to ComplianceAI!</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Would you like a quick tour of the platform?
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 -mr-1 -mt-1"
                onClick={dismissPrompt}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={dismissPrompt}
              >
                Maybe later
              </Button>
              <Button 
                size="sm" 
                className="flex-1 gap-1"
                onClick={startTour}
                data-testid="start-tour-button"
              >
                <Play className="h-4 w-4" />
                Start Tour
              </Button>
            </div>
          </CardContent>
        </Card>,
        document.body
      )}
    </>
  );
}

export function useTour() {
  const startTour = useCallback(() => {
    window.dispatchEvent(new CustomEvent('start-guided-tour'));
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.removeItem(TOUR_STARTED_KEY);
  }, []);

  return { startTour, resetTour };
}
