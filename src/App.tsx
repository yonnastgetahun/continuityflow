import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TestModeProvider } from "@/hooks/useTestMode";
import { OwnerGuard } from "@/components/OwnerGuard";
import { AccessGuard } from "@/components/AccessGuard";

const queryClient = new QueryClient();
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Restricted = lazy(() => import("./pages/Restricted"));
const Upload = lazy(() => import("./pages/Upload"));
const Review = lazy(() => import("./pages/Review"));
const Records = lazy(() => import("./pages/Records"));
const Generate = lazy(() => import("./pages/Generate"));
const Exported = lazy(() => import("./pages/Exported"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TestModeProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/restricted" element={<Restricted />} />
                <Route path="/upload" element={<AccessGuard><Upload /></AccessGuard>} />
                <Route path="/review" element={<AccessGuard><Review /></AccessGuard>} />
                <Route path="/records" element={<AccessGuard><Records /></AccessGuard>} />
                <Route path="/generate" element={<AccessGuard><Generate /></AccessGuard>} />
                <Route path="/exported" element={<AccessGuard><Exported /></AccessGuard>} />
                <Route path="/upgrade" element={<OwnerGuard><Upgrade /></OwnerGuard>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </TestModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
