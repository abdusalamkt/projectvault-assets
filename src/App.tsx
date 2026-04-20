import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/dam/Layout";
import RequireRole from "./components/dam/RequireRole";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectForm from "./pages/ProjectForm";
import Import from "./pages/Import";
import Index from "./pages/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route element={<RequireRole><Layout /></RequireRole>}>
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
            </Route>
            <Route element={<RequireRole role="admin"><Layout /></RequireRole>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects/new" element={<ProjectForm />} />
              <Route path="/projects/:id/edit" element={<ProjectForm />} />
              <Route path="/import" element={<Import />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
