import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { 
  BookOpen, 
  Calendar, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  Users, 
  Users2,
  FileText,
  ClipboardCheck,
  School
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const getRoleColor = (role?: string) => {
  switch(role) {
    case 'admin': return 'bg-blue-500 hover:bg-blue-600';
    case 'guru': return 'bg-green-500 hover:bg-green-600';
    case 'siswa': return 'bg-orange-500 hover:bg-orange-600';
    default: return 'bg-gray-500';
  }
};

const getRoleMenu = (role?: string) => {
  const commonMenu = [
    { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
    { title: "Jadwal", icon: Calendar, url: "/jadwal" },
    { title: "Absensi", icon: ClipboardCheck, url: "/absensi" },
    { title: "Nilai", icon: FileText, url: "/nilai" },
  ];

  if (role === 'admin') {
    return [
      { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
      { title: "Siswa", icon: Users, url: "/siswa" },
      { title: "Guru", icon: Users2, url: "/guru" },
      { title: "Kelas", icon: School, url: "/kelas" },
      { title: "Mata Pelajaran", icon: BookOpen, url: "/mata-pelajaran" },
      { title: "Jadwal", icon: Calendar, url: "/jadwal" },
      { title: "Absensi", icon: ClipboardCheck, url: "/absensi" },
      { title: "Nilai", icon: FileText, url: "/nilai" },
      { title: "Raport", icon: GraduationCap, url: "/raport" },
    ];
  }

  if (role === 'guru') {
    return [
      ...commonMenu,
      { title: "Raport", icon: GraduationCap, url: "/raport" },
    ];
  }

  if (role === 'siswa') {
    return [
      ...commonMenu,
      { title: "Raport", icon: GraduationCap, url: "/raport" },
    ];
  }

  return [];
};

function AppSidebar() {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logoutMutation = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem('siakad_token');
        localStorage.removeItem('siakad_user');
        setLocation('/login');
      }
    });
  };

  const menuItems = getRoleMenu(user?.role);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="flex flex-col p-4 border-b border-sidebar-border gap-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <div className="bg-white p-1 rounded-md shadow-sm">
            <School className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white leading-tight">SMP NEGERI 2</span>
            <span className="text-xs text-sidebar-primary-foreground/80 leading-tight">RAMBANG</span>
          </div>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex justify-center items-center h-8">
          <School className="h-6 w-6 text-white" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {user ? (
          <div className="flex items-center justify-between group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
            <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium text-white truncate max-w-[140px]">{user.full_name}</span>
              <div>
                <Badge variant="secondary" className={`${getRoleColor(user.role)} text-white border-transparent hover:text-white capitalize`}>
                  {user.role}
                </Badge>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0" 
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-secondary">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4 sm:px-6 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
