import {
  ChevronsUpDown,
  LogOut,
  SettingsIcon,
  FlagIcon,
  User,
  Shield,
  BookOpen,
} from "lucide-react";
import { useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@janhq/interfaces/avatar";

declare const VITE_REPORT_ISSUE_URL: string;
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerItem,
  DropDrawerLabel,
  DropDrawerSeparator,
  DropDrawerTrigger,
} from "@janhq/interfaces/dropdrawer";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/sidebar/sidebar";
import { useAuth } from "@/stores/auth-store";
import { useAdminStore } from "@/stores/admin-store";
import { useRouter, Link } from "@tanstack/react-router";
import { getInitialsAvatar } from "@/lib/utils";
import { URL_PARAM, SETTINGS_SECTION } from "@/constants";
import { cn } from "@janhq/interfaces/lib";

export function NavUser() {
  const user = useAuth((state) => state.user);
  const isGuest = useAuth((state) => state.isGuest);
  const logout = useAuth((state) => state.logout);
  const router = useRouter();
  const { state, setOpenMobile, isMobile } = useSidebar();

  // Admin status
  const isAdmin = useAdminStore((state) => state.isAdmin);
  const checkAdminStatus = useAdminStore((state) => state.checkAdminStatus);

  // Check admin status on mount
  useEffect(() => {
    if (user && !isGuest) {
      checkAdminStatus();
    }
  }, [user, isGuest, checkAdminStatus]);

  if (!user || isGuest) {
    return null;
  }

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleOpenSettings = (section: string = SETTINGS_SECTION.GENERAL) => {
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM.SETTING, section);
    router.navigate({ to: url.pathname + url.search });
  };

  return (
    <SidebarMenu className={cn(state === "collapsed" && "md:items-center")}>
      <SidebarMenuItem>
        <DropDrawer>
          <DropDrawerTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary text-background font-medium">
                  {getInitialsAvatar(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {/* temporary till we have manage billing */}
                  {/* {user.pro ? 'Pro Plan' : 'Free Plan'} */}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropDrawerTrigger>
          <DropDrawerContent
            className="md:w-56"
            side={state === "collapsed" ? "right" : "top"}
            align="center"
            sideOffset={4}
          >
            <DropDrawerLabel className="lg:p-0 font-normal">
              <div className="flex items-center gap-2 px-3 py-1.5 text-left text-sm">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground mt-1">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropDrawerLabel>
            <DropDrawerItem asChild>
              <Link
                to="/profile"
                onClick={handleNavigation}
                className="flex gap-2 items-center"
              >
                <User className="text-muted-foreground" />
                Profile & API Keys
              </Link>
            </DropDrawerItem>
            <DropDrawerItem
              onClick={() => handleOpenSettings(SETTINGS_SECTION.GENERAL)}
            >
              <div className="flex gap-2 items-center justify-center">
                <SettingsIcon className="text-muted-foreground" />
                Settings
              </div>
            </DropDrawerItem>
            <DropDrawerItem asChild>
              <Link
                to="/docs"
                onClick={handleNavigation}
                className="flex gap-2 items-center"
              >
                <BookOpen className="text-muted-foreground" />
                Documentation
              </Link>
            </DropDrawerItem>
            {isAdmin && (
              <DropDrawerItem asChild>
                <Link
                  to="/admin"
                  onClick={handleNavigation}
                  className="flex gap-2 items-center"
                >
                  <Shield className="text-muted-foreground" />
                  Admin Panel
                </Link>
              </DropDrawerItem>
            )}
            <DropDrawerSeparator />
            <DropDrawerItem asChild>
              <a
                href={VITE_REPORT_ISSUE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2 items-center"
              >
                <FlagIcon className="text-muted-foreground" />
                Report Issue
              </a>
            </DropDrawerItem>
            <DropDrawerItem
              onClick={async () => {
                await logout();
                router.navigate({
                  to: "/",
                  replace: true,
                });
              }}
            >
              <div className="flex gap-2 items-center justify-center">
                <LogOut className="text-muted-foreground ml-0.5" />
                Log out
              </div>
            </DropDrawerItem>
          </DropDrawerContent>
        </DropDrawer>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
