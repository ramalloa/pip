import { Switch, Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Home from "@/pages/home";
import OrdenesDia from "@/pages/ordenes-del-dia";
import NotFound from "@/pages/not-found";

const BASE_PATH = '/pip';

function AppRouter() {
  return (
    <Router base={BASE_PATH}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/expedientes" component={Home} />
        <Route path="/ordenes-del-dia" component={OrdenesDia} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
