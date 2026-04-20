import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Role, useAuth } from "@/context/AuthContext";

export default function RequireRole({ role, children }: { role?: Role; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to="/projects" replace />;
  return <>{children}</>;
}