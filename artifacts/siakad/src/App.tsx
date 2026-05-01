import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import SiswaPage from "@/pages/siswa";
import GuruPage from "@/pages/guru";
import KelasPage from "@/pages/kelas";
import MataPelajaranPage from "@/pages/mata-pelajaran";
import JadwalPage from "@/pages/jadwal";
import AbsensiPage from "@/pages/absensi";
import NilaiPage from "@/pages/nilai";
import RaportPage from "@/pages/raport";
import AkunPage from "@/pages/akun";

import Layout from "@/components/layout/Layout";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  const token = localStorage.getItem("siakad_token");
  
  if (!token) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      
      <Route path="/siswa">
        {() => <ProtectedRoute component={SiswaPage} />}
      </Route>

      <Route path="/guru">
        {() => <ProtectedRoute component={GuruPage} />}
      </Route>

      <Route path="/kelas">
        {() => <ProtectedRoute component={KelasPage} />}
      </Route>

      <Route path="/mata-pelajaran">
        {() => <ProtectedRoute component={MataPelajaranPage} />}
      </Route>

      <Route path="/jadwal">
        {() => <ProtectedRoute component={JadwalPage} />}
      </Route>

      <Route path="/absensi">
        {() => <ProtectedRoute component={AbsensiPage} />}
      </Route>

      <Route path="/nilai">
        {() => <ProtectedRoute component={NilaiPage} />}
      </Route>

      <Route path="/raport">
        {() => <ProtectedRoute component={RaportPage} />}
      </Route>

      <Route path="/akun">
        {() => <ProtectedRoute component={AkunPage} allowedRoles={["admin"]} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
