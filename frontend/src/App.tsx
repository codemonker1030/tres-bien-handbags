import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { ThemeProvider } from "@/components/app-shell/theme-provider";
import { Layout } from "@/components/app-shell/layout";
import { Dashboard } from "@/pages/dashboard";
import { Inventory } from "@/pages/inventory";
import { ProductDetail } from "@/pages/product-detail";
import { Sales } from "@/pages/sales";
import { Debts } from "@/pages/debts";
import { Expenses } from "@/pages/expenses";
import { Tasks } from "@/pages/tasks";

// Data is considered "fresh" for 30s after fetching — navigating back to a page
// you just visited shows the cached data instantly instead of a loading skeleton.
// It still refetches quietly in the background to catch up, so nothing goes stale
// for long; mutations (creating a sale, paying a debt, etc.) also explicitly
// invalidate the relevant queries so those updates always show immediately,
// regardless of this timer.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/inventory/:id" component={ProductDetail} />
        <Route path="/sales" component={Sales} />
        <Route path="/debts" component={Debts} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/tasks" component={Tasks} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
