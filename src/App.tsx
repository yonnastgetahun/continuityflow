import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OwnerGuard } from "@/components/OwnerGuard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
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
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/restricted" element={<Restricted />} />
            <Route path="/upload" element={<OwnerGuard><Upload /></OwnerGuard>} />
            <Route path="/review" element={<OwnerGuard><Review /></OwnerGuard>} />
            <Route path="/records" element={<OwnerGuard><Records /></OwnerGuard>} />
            <Route path="/generate" element={<OwnerGuard><Generate /></OwnerGuard>} />
            <Route path="/exported" element={<OwnerGuard><Exported /></OwnerGuard>} />
            <Route path="/upgrade" element={<OwnerGuard><Upgrade /></OwnerGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
