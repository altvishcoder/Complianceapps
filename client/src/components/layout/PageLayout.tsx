import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface PageLayoutProps {
  title: string;
  pageTitle?: string;
  children: React.ReactNode;
}

export function PageLayout({ title, pageTitle, children }: PageLayoutProps) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} - ComplianceAI` : `${title} - ComplianceAI`;
  }, [title, pageTitle]);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title} />
        <main id="main-content" className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
