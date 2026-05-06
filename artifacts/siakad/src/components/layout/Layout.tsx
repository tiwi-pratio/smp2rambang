import { useState, useEffect } from "react";
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
  School,
  X,
  ChevronRight,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
  UserCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const getRoleBadgeStyle = (role?: string) => {
  switch (role) {
    case "admin": return "bg-blue-500/20 text-blue-200 border-blue-400/30";
    case "guru": return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
    case "siswa": return "bg-orange-500/20 text-orange-200 border-orange-400/30";
    default: return "bg-white/10 text-white/60 border-white/20";
  }
};

const getRoleLabel = (role?: string) => {
  switch (role) {
    case "admin": return "Administrator";
    case "guru": return "Guru";
    case "siswa": return "Siswa";
    default: return role;
  }
};

const getAdminMenu = () => [
  { group: "Utama", items: [
    { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  ]},
  { group: "Manajemen", items: [
    { title: "Siswa", icon: Users, url: "/siswa" },
    { title: "Guru", icon: Users2, url: "/guru" },
    { title: "Kelas", icon: School, url: "/kelas" },
    { title: "Mata Pelajaran", icon: BookOpen, url: "/mata-pelajaran" },
  ]},
  { group: "Akademik", items: [
    { title: "Jadwal", icon: Calendar, url: "/jadwal" },
    { title: "Absensi", icon: ClipboardCheck, url: "/absensi" },
    { title: "Nilai", icon: FileText, url: "/nilai" },
    { title: "Raport", icon: GraduationCap, url: "/raport" },
  ]},
  { group: "Sistem", items: [
    { title: "Manajemen Akun", icon: KeyRound, url: "/akun" },
  ]},
];

const getGuruMenu = () => [
  { group: "Utama", items: [
    { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  ]},
  { group: "Akademik", items: [
    { title: "Jadwal", icon: Calendar, url: "/jadwal" },
    { title: "Absensi", icon: ClipboardCheck, url: "/absensi" },
    { title: "Nilai", icon: FileText, url: "/nilai" },
    { title: "Raport", icon: GraduationCap, url: "/raport" },
  ]},
];

const getSiswaMenu = () => [
  { group: "Utama", items: [
    { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  ]},
  { group: "Akademik", items: [
    { title: "Jadwal", icon: Calendar, url: "/jadwal" },
    { title: "Absensi", icon: ClipboardCheck, url: "/absensi" },
    { title: "Nilai", icon: FileText, url: "/nilai" },
    { title: "Raport", icon: GraduationCap, url: "/raport" },
  ]},
  { group: "Akun", items: [
    { title: "Profil Saya", icon: UserCircle, url: "/profil" },
  ]},
];

const getMenuGroups = (role?: string) => {
  if (role === "admin") return getAdminMenu();
  if (role === "guru") return getGuruMenu();
  if (role === "siswa") return getSiswaMenu();
  return [];
};

const getPageTitle = (pathname: string) => {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/siswa": "Data Siswa",
    "/guru": "Data Guru",
    "/kelas": "Manajemen Kelas",
    "/mata-pelajaran": "Mata Pelajaran",
    "/jadwal": "Jadwal Pelajaran",
    "/absensi": "Absensi",
    "/nilai": "Data Nilai",
    "/raport": "Raport Siswa",
    "/profil/edit": "Edit Profil",
    "/profil": "Profil Saya",
  };
  for (const key of Object.keys(map)) {
    if (pathname.startsWith(key)) return map[key];
  }
  return "SIAKAD";
};

const getInitials = (name?: string) => {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
};

interface SidebarNavProps {
  user: any;
  location: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

function SidebarNav({ user, location, collapsed, onNavigate, onLogout }: SidebarNavProps) {
  const menuGroups = getMenuGroups(user?.role);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`border-b border-white/10 flex items-center shrink-0 ${collapsed ? "px-0 py-5 justify-center h-16" : "px-5 py-5"}`}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <School className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <School className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">SMP Negeri 2</p>
              <p className="text-white/50 text-xs leading-tight">Rambang</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation — scrollbar hidden */}
      <div
        className={`flex-1 overflow-y-auto py-4 space-y-5 ${collapsed ? "px-2" : "px-3"}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`.sidebar-scroll::-webkit-scrollbar { display: none; }`}</style>
        {menuGroups.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5">
                {group.group}
              </p>
            )}
            {collapsed && <div className="h-px bg-white/10 my-2 mx-1" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.startsWith(item.url);
                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    onClick={onNavigate}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                    title={collapsed ? item.title : undefined}
                    className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 group
                      ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}
                      ${isActive
                        ? "bg-white text-[hsl(231,59%,26%)] shadow-sm"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                  >
                    <item.icon
                      className={`h-4 w-4 shrink-0 ${isActive ? "text-[hsl(231,59%,26%)]" : "text-white/50 group-hover:text-white"}`}
                    />
                    {!collapsed && <span>{item.title}</span>}
                    {!collapsed && isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer */}
      {user && (
        <div className={`border-t border-white/10 py-4 ${collapsed ? "px-2" : "px-3"}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center" title={user.full_name}>
                <span className="text-xs font-bold text-white">{getInitials(user.full_name)}</span>
              </div>
              <button
                onClick={onLogout}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Logout"
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">{getInitials(user.full_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate leading-tight">{user.full_name}</p>
                <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${getRoleBadgeStyle(user.role)}`}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7 text-white/40 hover:text-white hover:bg-white/10"
                onClick={onLogout}
                title="Logout"
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isProfileComplete(data: any) {
  return (
    data?.nisn && data.nisn !== "" &&
    data?.tanggal_lahir && data.tanggal_lahir !== "2000-01-01" &&
    data?.tempat_lahir && data.tempat_lahir !== "" &&
    data?.agama && data.agama !== "" &&
    data?.alamat && data.alamat !== "" &&
    data?.no_hp_ortu && data.no_hp_ortu !== ""
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: user } = useGetMe();
  const logoutMutation = useLogout();
  const [showProfileNotif, setShowProfileNotif] = useState(false);

  useEffect(() => {
    if (user?.role !== "siswa") return;
    const alreadyShown = sessionStorage.getItem("profil_notif_shown");
    if (alreadyShown) return;
    const token = localStorage.getItem("siakad_token");
    if (!token) return;
    fetch(`/api/auth/me/siswa`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (!isProfileComplete(data)) {
          setShowProfileNotif(true);
          sessionStorage.setItem("profil_notif_shown", "1");
        }
      })
      .catch(() => {});
  }, [user?.role]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("siakad_token");
        localStorage.removeItem("siakad_user");
        localStorage.removeItem("siakad_siswa_kelas_id");
        localStorage.removeItem("siakad_siswa_id");
        sessionStorage.removeItem("profil_notif_shown");
        setLocation("/login");
      },
    });
  };

  const pageTitle = getPageTitle(location);

  return (
    <div className="flex h-screen bg-[hsl(210,40%,98%)] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out ${collapsed ? "w-16" : "w-64"}`}
        style={{ background: "hsl(231,59%,26%)" }}
      >
        <SidebarNav
          user={user}
          location={location}
          collapsed={collapsed}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 h-full w-64 flex flex-col shadow-2xl"
            style={{ background: "hsl(231,59%,26%)" }}
          >
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setMobileOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav
              user={user}
              location={location}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 h-16 bg-white border-b border-[hsl(214,32%,91%)] flex items-center px-5 gap-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
          {/* Desktop toggle */}
          <button
            className="hidden lg:flex w-9 h-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setCollapsed((v) => !v)}
            data-testid="button-sidebar-toggle"
            title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen className="h-5 w-5" />
              : <PanelLeftClose className="h-5 w-5" />
            }
          </button>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page title */}
          <div className="flex-1">
            <h1 className="text-base font-semibold text-foreground tracking-tight">{pageTitle}</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Bell className="h-[18px] w-[18px]" />
            </button>
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                style={{ background: "hsl(231,59%,26%)" }}
              >
                {getInitials(user?.full_name)}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-foreground leading-tight">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground leading-tight capitalize">{getRoleLabel(user?.role)}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Incomplete profile notification modal — siswa only */}
      <Dialog open={showProfileNotif} onOpenChange={setShowProfileNotif}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl p-0 gap-0">
          <div className="p-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <DialogHeader className="text-center space-y-1">
              <DialogTitle className="text-base">Lengkapi Data Pribadimu</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Data profilmu belum lengkap. Segera isi NISN, tanggal lahir, alamat, dan nomor HP orang tua agar data akademikmu tercatat dengan benar.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-5 pb-5 flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => {
                setShowProfileNotif(false);
                setLocation("/profil");
              }}
            >
              <UserCircle className="h-4 w-4 mr-2" />
              Lengkapi Sekarang
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setShowProfileNotif(false)}
            >
              Nanti Saja
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
