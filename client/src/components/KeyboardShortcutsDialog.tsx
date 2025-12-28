import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Tab"], description: "Move to next focusable element" },
      { keys: ["Shift", "Tab"], description: "Move to previous focusable element" },
      { keys: ["Enter", "Space"], description: "Activate focused button or link" },
      { keys: ["Escape"], description: "Close dialogs and menus" },
      { keys: ["Arrow Keys"], description: "Navigate within menus and lists" },
    ],
  },
  {
    title: "Skip Links",
    shortcuts: [
      { keys: ["Tab"], description: "First Tab reveals skip link to main content" },
    ],
  },
  {
    title: "Tables",
    shortcuts: [
      { keys: ["Arrow Keys"], description: "Navigate between table cells" },
      { keys: ["Home"], description: "Go to first cell in row" },
      { keys: ["End"], description: "Go to last cell in row" },
    ],
  },
  {
    title: "Forms",
    shortcuts: [
      { keys: ["Tab"], description: "Move between form fields" },
      { keys: ["Space"], description: "Toggle checkbox or radio button" },
      { keys: ["Enter"], description: "Submit form" },
    ],
  },
  {
    title: "Dialog & Modals",
    shortcuts: [
      { keys: ["Escape"], description: "Close dialog" },
      { keys: ["Tab"], description: "Cycle through dialog controls" },
    ],
  },
  {
    title: "Help",
    shortcuts: [
      { keys: ["?"], description: "Open this keyboard shortcuts dialog" },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || 
                       target.tagName === "TEXTAREA" || 
                       target.isContentEditable;
        
        if (!isInput) {
          e.preventDefault();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        aria-labelledby="keyboard-shortcuts-title"
        aria-describedby="keyboard-shortcuts-description"
      >
        <DialogHeader>
          <DialogTitle id="keyboard-shortcuts-title">Keyboard Shortcuts</DialogTitle>
          <DialogDescription id="keyboard-shortcuts-description">
            Use these keyboard shortcuts to navigate the application more efficiently.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <Kbd>{key}</Kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
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

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <Kbd>?</Kbd> anywhere to open this dialog. Press <Kbd>Escape</Kbd> to close.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
