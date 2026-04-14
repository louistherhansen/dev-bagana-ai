import { AppNav } from "./AppNav";
import { Logo } from "./Logo";
import { AppFooter } from "./AppFooter";

type PageLayoutProps = {
  children: React.ReactNode;
  currentPath?: string;
  dynamicMenu?: boolean;
  dynamicLogo?: boolean;
};

export function PageLayout({ 
  children, 
  currentPath, 
  dynamicMenu = true,
  dynamicLogo = true 
}: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur shrink-0 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Logo dynamic={dynamicLogo} />
          <AppNav currentPath={currentPath} dynamic={dynamicMenu} />
        </div>
      </header>
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
      <AppFooter />
    </div>
  );
}
