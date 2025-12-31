import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutCategory {
  name: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const KEYBOARD_SHORTCUTS: ShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'P'], description: 'Go to Properties' },
      { keys: ['G', 'C'], description: 'Go to Certificates' },
      { keys: ['G', 'A'], description: 'Go to Actions' },
      { keys: ['G', 'M'], description: 'Go to Maps' },
      { keys: ['G', 'H'], description: 'Go to Help' },
    ]
  },
  {
    name: 'Actions',
    shortcuts: [
      { keys: ['N'], description: 'New item (context-dependent)' },
      { keys: ['/', 'Ctrl', 'K'], description: 'Open global search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close dialog/modal' },
    ]
  },
  {
    name: 'Table & List',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate rows' },
      { keys: ['Enter'], description: 'Open selected item' },
      { keys: ['Ctrl', 'A'], description: 'Select all' },
    ]
  },
];

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className={cn(
      "inline-flex items-center justify-center",
      "min-w-[24px] h-6 px-1.5",
      "text-xs font-medium",
      "bg-muted border border-border rounded",
      "shadow-sm"
    )}>
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsGuide() {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          setIsOpen(true);
        }
      }
      
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="keyboard-shortcuts-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster. Press <KeyboardKey>?</KeyboardKey> anytime to see this guide.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {KEYBOARD_SHORTCUTS.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <KeyboardKey>{key}</KeyboardKey>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="mx-0.5 text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center text-xs text-muted-foreground pt-2 border-t">
          Press <KeyboardKey>Esc</KeyboardKey> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useKeyboardNavigation() {
  useEffect(() => {
    let keySequence: string[] = [];
    let lastKeyTime = 0;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      const now = Date.now();
      if (now - lastKeyTime > 1000) {
        keySequence = [];
      }
      lastKeyTime = now;
      
      keySequence.push(e.key.toUpperCase());
      
      if (keySequence.length >= 2) {
        const combo = keySequence.slice(-2).join('');
        
        switch (combo) {
          case 'GD':
            window.location.href = '/dashboard';
            keySequence = [];
            break;
          case 'GP':
            window.location.href = '/properties';
            keySequence = [];
            break;
          case 'GC':
            window.location.href = '/certificates';
            keySequence = [];
            break;
          case 'GA':
            window.location.href = '/actions';
            keySequence = [];
            break;
          case 'GM':
            window.location.href = '/maps';
            keySequence = [];
            break;
          case 'GH':
            window.location.href = '/help';
            keySequence = [];
            break;
        }
      }
      
      if (keySequence.length > 2) {
        keySequence = keySequence.slice(-2);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
