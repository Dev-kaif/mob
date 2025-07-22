
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  AreaChart,
  Database,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { logout } from "@/app/actions";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/id-creation", label: "ID Creation", icon: FilePlus2 },
  { href: "/analytics", label: "Analytics", icon: AreaChart },
  { href: "/data-management", label: "Data Management", icon: Database },
];

export function MainNav() {
  const pathname = usePathname();

  const handleLogout = async () => {
    localStorage.removeItem("loggedInUser");
    await logout();
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href}
            tooltip={item.label}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
      <SidebarSeparator className="my-2" />
      <SidebarMenuItem>
        <SidebarMenuButton onClick={handleLogout} tooltip="Log Out">
          <LogOut />
          <span>Log Out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
