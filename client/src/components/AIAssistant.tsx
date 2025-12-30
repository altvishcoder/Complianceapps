import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/mfa'];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function formatInlineContent(text: string, onNavigate?: (url: string) => void): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/);
  
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const [, linkText, linkUrl] = linkMatch;
      if (linkUrl.startsWith('/') && onNavigate) {
        return (
          <button 
            key={i} 
            className="text-primary underline hover:text-primary/80 cursor-pointer"
            onClick={() => onNavigate(linkUrl)}
          >
            {linkText}
          </button>
        );
      }
      return (
        <a key={i} href={linkUrl} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
          {linkText}
        </a>
      );
    }
    return part;
  });
}

function formatMessage(text: string, onNavigate?: (url: string) => void): React.ReactNode {
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ');
    const isNumbered = /^\d+[\.\)]\s/.test(line.trim());
    
    if (isBullet) {
      const content = line.trim().replace(/^[-•]\s*/, '');
      return (
        <div key={lineIndex} className="flex gap-2 ml-2">
          <span>•</span>
          <span>{formatInlineContent(content, onNavigate)}</span>
        </div>
      );
    }
    
    if (isNumbered) {
      return (
        <div key={lineIndex} className="ml-2">
          {formatInlineContent(line, onNavigate)}
        </div>
      );
    }
    
    return (
      <div key={lineIndex} className={line.trim() === '' ? 'h-2' : ''}>
        {formatInlineContent(line, onNavigate)}
      </div>
    );
  });
}

function useAuthState() {
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('user_id'));
  
  useEffect(() => {
    const handleStorageChange = () => {
      setUserId(localStorage.getItem('user_id'));
    };
    
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  return userId;
}

export function AIAssistant() {
  const [location, setLocation] = useLocation();
  const userId = useAuthState();
  
  const handleNavigate = (url: string) => {
    setLocation(url);
  };
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isPublicRoute = PUBLIC_ROUTES.includes(location);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessageWithContent = async (content: string, existingMessages: ChatMessage[]) => {
    if (!content.trim() || isLoading || !userId) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...existingMessages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch (error) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageWithContent(inputValue, messages);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "Show properties with compliance issues",
    "What are C1, C2, C3 defect codes?",
    "Find components needing attention",
    "How do I upload a certificate?",
  ];

  if (!userId || isPublicRoute) {
    return null;
  }

  return (
    <>
      <Button
        data-testid="button-open-ai-assistant"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          isOpen && "hidden"
        )}
        aria-label="Open AI Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {isOpen && (
        <div
          data-testid="container-ai-assistant"
          className="fixed bottom-6 right-6 w-96 h-[500px] bg-background border rounded-lg shadow-xl z-50 flex flex-col"
          role="dialog"
          aria-label="AI Assistant"
        >
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold">ComplianceAI Assistant</span>
            </div>
            <Button
              data-testid="button-close-ai-assistant"
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              aria-label="Close AI Assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  👋 Hi! I help with <strong>UK social housing compliance</strong> and ComplianceAI.
                </p>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      data-testid={`button-suggested-question-${index}`}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto py-2 px-3 text-xs"
                      onClick={() => {
                        sendMessageWithContent(question, messages);
                      }}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    data-testid={`message-${message.role}-${index}`}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2 max-w-[80%] text-sm",
                        message.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === 'assistant' ? (
                        <div className="space-y-1">{formatMessage(message.content, handleNavigate)}</div>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted flex items-center gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                data-testid="input-ai-assistant-message"
                placeholder="Ask about compliance..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
                aria-label="Type your message"
              />
              <Button
                data-testid="button-send-message"
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
