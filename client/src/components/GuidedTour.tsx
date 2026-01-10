import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getIcon, getActionIcon, getNavigationIcon } from '@/config/icons';
import { useLocation } from 'wouter';

const X = getActionIcon('close');
const ChevronLeft = getActionIcon('previous');
const ChevronRight = getActionIcon('next');
const LayoutDashboard = getNavigationIcon('overview');
const Building2 = getIcon('Building2');
const FileCheck = getNavigationIcon('certificates');
const Radar = getNavigationIcon('risk');
const Bot = getIcon('Activity');
const HelpCircle = getIcon('HelpCircle');
const Sparkles = getIcon('Activity');
const Play = getIcon('Play');

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
  expandSection?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'sidebar-intro',
    title: 'Welcome to ComplianceAI',
    description: 'This sidebar is your navigation hub. The menu is organized into logical sections: OPERATE for daily tasks, ASSURE for compliance proof, UNDERSTAND for insights, ASSETS for property management, and RESOURCES for help. Let\'s walk through each section.',
    targetSelector: '[data-testid="sidebar-content"]',
    position: 'right',
    icon: LayoutDashboard,
    route: '/dashboard',
    highlight: true
  },
  {
    id: 'section-operate',
    title: 'OPERATE - Daily Operations',
    description: 'The OPERATE section is where you\'ll spend most of your time. It contains everything needed for day-to-day compliance management: uploading certificates, managing remedial actions, viewing the risk radar, and tracking your calendar. This is your Overview Hub for operational tasks.',
    targetSelector: '[data-testid="section-toggle-operate"]',
    position: 'right',
    icon: LayoutDashboard,
    route: '/dashboard',
    expandSection: 'operate'
  },
  {
    id: 'certificates',
    title: 'Certificates',
    description: 'Upload and manage all compliance certificates here. Simply drag and drop PDF documents - our AI automatically extracts key details like certificate type, dates, and outcomes. Supports gas safety, electrical (EICR), fire risk, asbestos, legionella, and 80+ other UK compliance certificate types.',
    targetSelector: '[data-testid="nav-item-certificates"]',
    position: 'right',
    icon: FileCheck,
    route: '/certificates',
    expandSection: 'operate'
  },
  {
    id: 'risk-radar',
    title: 'Risk Radar',
    description: 'Monitor compliance risks with ML-powered predictive analysis. Properties are ranked by risk score - red items need immediate attention, amber require review, and green are compliant. The radar predicts when certificates will expire before they become overdue.',
    targetSelector: '[data-testid="nav-item-risk-radar"]',
    position: 'right',
    icon: Radar,
    route: '/risk-radar',
    expandSection: 'operate'
  },
  {
    id: 'section-assure',
    title: 'ASSURE - Compliance Proof',
    description: 'The ASSURE section provides audit trails and evidence for regulatory inspections. Here you\'ll find detailed audit logs, compliance reports, and documentation that demonstrates your organization\'s compliance status to regulators and stakeholders.',
    targetSelector: '[data-testid="section-toggle-assure"]',
    position: 'right',
    icon: FileCheck,
    route: '/dashboard',
    expandSection: 'assure'
  },
  {
    id: 'section-understand',
    title: 'UNDERSTAND - Insights & Trends',
    description: 'The UNDERSTAND section provides analytics and reporting. View compliance trends over time, identify patterns in certificate failures, and generate reports for board meetings. This helps you make data-driven decisions about your compliance strategy.',
    targetSelector: '[data-testid="section-toggle-understand"]',
    position: 'right',
    icon: Radar,
    route: '/dashboard',
    expandSection: 'understand'
  },
  {
    id: 'section-assets',
    title: 'ASSETS - Property Management',
    description: 'The ASSETS section manages your property portfolio. Properties follow UK Housing Data Standards (UKHDS): Schemes (estates) contain Blocks (buildings), which contain Properties (dwellings). You can also track components like boilers, fire alarms, and other equipment requiring certification.',
    targetSelector: '[data-testid="section-toggle-assets"]',
    position: 'right',
    icon: Building2,
    route: '/dashboard',
    expandSection: 'assets'
  },
  {
    id: 'properties',
    title: 'Properties',
    description: 'View and manage your entire property portfolio. Add new properties, update addresses, link components, and see compliance status at a glance. You can filter by scheme, block, or search for specific addresses.',
    targetSelector: '[data-testid="nav-item-properties"]',
    position: 'right',
    icon: Building2,
    route: '/properties',
    expandSection: 'assets'
  },
  {
    id: 'section-resources',
    title: 'RESOURCES - Help & Training',
    description: 'The RESOURCES section provides help when you need it. Access detailed user guides, video tutorials for common tasks, and links to UK legislation and regulatory standards. You can restart this tour anytime from here.',
    targetSelector: '[data-testid="section-toggle-resources"]',
    position: 'right',
    icon: HelpCircle,
    route: '/dashboard',
    expandSection: 'resources'
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    description: 'Your intelligent compliance helper is always available via this chat button in the corner. Ask questions like "Which properties have expired gas certificates?" or "What are fire safety requirements for HMOs?" The assistant can search your data and explain UK regulations.',
    targetSelector: '[data-testid="button-open-ai-assistant"]',
    position: 'top',
    icon: Bot,
    highlight: true
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

  const expandSectionIfNeeded = useCallback(() => {
    if (!step?.expandSection) return;
    const sectionToggle = document.querySelector(`[data-testid="section-toggle-${step.expandSection}"]`);
    if (sectionToggle) {
      const isExpanded = sectionToggle.getAttribute('aria-expanded') === 'true';
      if (!isExpanded) {
        (sectionToggle as HTMLElement).click();
      }
    }
  }, [step]);

  const findTarget = useCallback((shouldScroll = false) => {
    if (!step) return null;
    if (!step.targetSelector) return null;
    const element = document.querySelector(step.targetSelector);
    if (element) {
      if (shouldScroll) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      return element.getBoundingClientRect();
    }
    return null;
  }, [step]);

  useEffect(() => {
    if (!isActive) return;

    const scrollAndUpdate = () => {
      expandSectionIfNeeded();
      setTimeout(() => {
        findTarget(true);
        setTimeout(() => {
          const rect = findTarget(false);
          setTargetRect(rect);
        }, 350);
      }, 150);
    };

    scrollAndUpdate();

    const updatePosition = () => {
      const rect = findTarget(false);
      setTargetRect(rect);
    };
    
    const interval = setInterval(updatePosition, 100);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, currentStep, findTarget, expandSectionIfNeeded]);

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
