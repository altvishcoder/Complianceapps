import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getIcon, getActionIcon, getStatusIcon, getNavigationIcon } from '@/config/icons';

const Building2 = getIcon('Building2');
const FileCheck = getNavigationIcon('certificates');
const AlertTriangle = getStatusIcon('warning');
const Map = getNavigationIcon('maps');
const Users = getIcon('Users');
const Settings = getIcon('Settings');
const ChevronRight = getActionIcon('next');
const ChevronLeft = getActionIcon('previous');
const CheckCircle2 = getStatusIcon('compliant');
const Sparkles = getIcon('Activity');
const Shield = getIcon('Shield');

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ComplianceAI',
    description: 'Your intelligent compliance management platform for UK social housing.',
    icon: <Sparkles className="h-12 w-12 text-primary" />,
    tips: [
      'Track all your compliance certificates in one place',
      'AI-powered document extraction saves hours of manual data entry',
      'Get alerts before certificates expire'
    ]
  },
  {
    id: 'properties',
    title: 'Manage Properties',
    description: 'Organize your portfolio by schemes, blocks, and properties.',
    icon: <Building2 className="h-12 w-12 text-blue-500" />,
    tips: [
      'Properties are grouped by schemes and blocks',
      'Each property can have multiple units and components',
      'Track compliance status at every level'
    ]
  },
  {
    id: 'certificates',
    title: 'Upload Certificates',
    description: 'Upload compliance certificates and let AI extract the details.',
    icon: <FileCheck className="h-12 w-12 text-green-500" />,
    tips: [
      'Drag and drop PDFs or images to upload',
      'AI extracts key information automatically',
      'Review and approve extracted data before saving'
    ]
  },
  {
    id: 'actions',
    title: 'Track Remedial Actions',
    description: 'Never miss a follow-up with automatic action tracking.',
    icon: <AlertTriangle className="h-12 w-12 text-amber-500" />,
    tips: [
      'Defects create remedial actions automatically',
      'Set priorities: Immediate, Urgent, Priority, or Routine',
      'Assign actions to contractors and track progress'
    ]
  },
  {
    id: 'maps',
    title: 'Visualize Compliance',
    description: 'See your compliance status on interactive maps.',
    icon: <Map className="h-12 w-12 text-purple-500" />,
    tips: [
      'Risk heatmaps show high-priority areas',
      'Click properties for detailed compliance info',
      'Filter by compliance type or status'
    ]
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: 'Start managing your compliance with confidence.',
    icon: <Shield className="h-12 w-12 text-emerald-500" />,
    tips: [
      'Use the AI Assistant (bottom right) for help anytime',
      'Check the Dashboard for a quick overview',
      'Visit Help for detailed guides and tutorials'
    ]
  }
];

const ONBOARDING_KEY = 'complianceai_onboarding_complete';

export function OnboardingWizard() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
  };
  
  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
  };
  
  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg" data-testid="onboarding-wizard">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            {step.icon}
          </div>
          <DialogTitle className="text-center text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-center">
            {step.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-3">
            {step.tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 py-2">
          <Progress value={progress} className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {currentStep + 1}/{ONBOARDING_STEPS.length}
          </span>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="sm:mr-auto"
            data-testid="button-skip-onboarding"
          >
            Skip Tour
          </Button>
          
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                data-testid="button-previous-step"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              data-testid="button-next-step"
            >
              {currentStep === ONBOARDING_STEPS.length - 1 ? (
                'Get Started'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}
