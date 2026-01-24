import { createFileRoute } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/sidebar/sidebar";
import { AdminLayout } from "@/components/admin/admin-layout";
import { UserManagement } from "@/components/admin/user-management";

function AdminUsersRoute() {
  return (
    <SidebarProvider>
      <AdminLayout>
        <UserManagement />
      </AdminLayout>
    </SidebarProvider>
  );
}

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersRoute,
});
