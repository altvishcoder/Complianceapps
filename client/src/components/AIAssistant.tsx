import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
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

function formatMessage(text: string): React.ReactNode {
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    let formatted: React.ReactNode = line;
    
    formatted = line.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ');
    const isNumbered = /^\d+[\.\)]\s/.test(line.trim());
    
    if (isBullet) {
      const content = line.trim().replace(/^[-•]\s*/, '');
      return (
        <div key={lineIndex} className="flex gap-2 ml-2">
          <span>•</span>
          <span>{content.split(/(\*\*[^*]+\*\*)/).map((part, i) => 
            part.startsWith('**') && part.endsWith('**') 
              ? <strong key={i}>{part.slice(2, -2)}</strong> 
              : part
          )}</span>
        </div>
      );
    }
    
    if (isNumbered) {
      return (
        <div key={lineIndex} className="ml-2">
          {line.split(/(\*\*[^*]+\*\*)/).map((part, i) => 
            part.startsWith('**') && part.endsWith('**') 
              ? <strong key={i}>{part.slice(2, -2)}</strong> 
              : part
          )}
        </div>
      );
    }
    
    return (
      <div key={lineIndex} className={line.trim() === '' ? 'h-2' : ''}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, i) => 
          part.startsWith('**') && part.endsWith('**') 
            ? <strong key={i}>{part.slice(2, -2)}</strong> 
            : part
        )}
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
  const [location] = useLocation();
  const userId = useAuthState();
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

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !userId) return;

    const userMessage: ChatMessage = { role: 'user', content: inputValue.trim() };
    const newMessages = [...messages, userMessage];
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "What gas safety requirements apply to social housing?",
    "How do I upload a certificate?",
    "What are C1, C2, C3 defect codes?",
    "When does an EICR need renewing?",
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hello! I'm your ComplianceAI assistant. I can help you with:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>UK social housing compliance requirements</li>
                  <li>Certificate types and renewal schedules</li>
                  <li>Defect classifications and remedial actions</li>
                  <li>Platform features and navigation</li>
                </ul>
                <div className="pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      data-testid={`button-suggested-question-${index}`}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto py-2 px-3 text-xs"
                      onClick={() => {
                        setInputValue(question);
                        setTimeout(() => {
                          const userMessage: ChatMessage = { role: 'user', content: question };
                          const newMessages = [...messages, userMessage];
                          setMessages(newMessages);
                          setInputValue('');
                          setIsLoading(true);
                          
                          fetch('/api/assistant/chat', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'X-User-Id': userId!,
                            },
                            body: JSON.stringify({ messages: newMessages }),
                          })
                            .then(res => res.json())
                            .then(data => {
                              setMessages([...newMessages, { role: 'assistant', content: data.message }]);
                            })
                            .catch(() => {
                              setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
                            })
                            .finally(() => setIsLoading(false));
                        }, 0);
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
                        <div className="space-y-1">{formatMessage(message.content)}</div>
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
                    <div className="rounded-lg px-4 py-2 bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
