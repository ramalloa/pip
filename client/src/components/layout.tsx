import { ReactNode } from "react";
import { Link } from "wouter";
import { Building2, FileText, FileCheck } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-none tracking-tight">S.I.L.</h1>
              <p className="text-xs text-muted-foreground font-medium">Sistema de Información Legislativa</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Expedientes
            </Link>
            <Link 
              href="/ordenes-del-dia" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <FileCheck className="h-4 w-4" />
              Órdenes del Día
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground border border-border">
              AR
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t mt-auto py-6 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; 2024 Congreso de la Nación Argentina. Uso interno.
        </div>
      </footer>
    </div>
  );
}
