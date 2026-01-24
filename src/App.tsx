import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TestModeProvider } from "@/hooks/useTestMode";
import { OwnerGuard } from "@/components/OwnerGuard";
import { AccessGuard } from "@/components/AccessGuard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Restricted from "./pages/Restricted";
import Upload from "./pages/Upload";
import Review from "./pages/Review";
import Records from "./pages/Records";
import Generate from "./pages/Generate";
import Exported from "./pages/Exported";
import Upgrade from "./pages/Upgrade";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TestModeProvider>
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
          </TestModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
