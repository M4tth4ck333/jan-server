import { useEffect, useState } from "react";
import { useRouter, Link, useLocation } from "@tanstack/react-router";
import {
  Box,
  FileText,
  Flag,
  LayoutDashboard,
  Loader2,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset } from "@/components/sidebar/sidebar";
import { NavHeader } from "@/components/sidebar/nav-header";
import { useAuth } from "@/stores/auth-store";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  {
    title: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "User Management",
    href: "/admin/users",
    icon: Users,
    children: [
      { title: "Users", href: "/admin/users" },
      { title: "Feature Flags", href: "/admin/users/feature-flags" },
    ],
  },
  {
    title: "Model Management",
    href: "/admin/models",
    icon: Box,
    children: [
      { title: "Overview", href: "/admin/models" },
      { title: "Providers", href: "/admin/models/providers" },
      { title: "Provider Models", href: "/admin/models/provider-models" },
      { title: "Model Catalogs", href: "/admin/models/catalogs" },
    ],
  },
  {
    title: "Prompt Templates",
    href: "/admin/prompt-templates",
    icon: FileText,
  },
  {
    title: "MCP Tools",
    href: "/admin/mcp-tools",
    icon: Wrench,
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const location = useLocation();
  const user = useAuth((state) => state.user);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const isGuest = useAuth((state) => state.isGuest);
  const { isAdmin, isLoading, checkAdminStatus } = useAdminStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function verifyAccess() {
      if (!isAuthenticated || isGuest) {
        router.navigate({ to: "/" });
        return;
      }

      setIsChecking(true);
      const adminStatus = await checkAdminStatus();
      setIsChecking(false);

      if (!adminStatus) {
        router.navigate({ to: "/" });
      }
    }

    verifyAccess();
  }, [isAuthenticated, isGuest, checkAdminStatus, router]);

  if (isChecking || isLoading || isAdmin === null) {
    return (
      <>
        <AppSidebar />
        <SidebarInset>
          <NavHeader />
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying admin access...
              </p>
            </div>
          </div>
        </SidebarInset>
      </>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const pathname = location.pathname;

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <NavHeader />
        <div className="flex flex-1 overflow-hidden">
          {/* Admin Sidebar */}
          <aside className="w-64 bg-card border-r border-border h-full overflow-y-auto shrink-0">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-6 px-2">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Admin Panel</h2>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/") ||
                    (item.children &&
                      item.children.some((c) => pathname === c.href));
                  const Icon = item.icon;

                  return (
                    <div key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </Link>

                      {item.children && isActive && (
                        <div className="ml-7 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                to={child.href}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
                                  isChildActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                )}
                              >
                                {child.title}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </SidebarInset>
    </>
  );
}
