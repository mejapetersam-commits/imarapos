import { useState } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import type { Business, Page } from "./types";

type NavItem = {
  id: Page | "sales" | "customers" | "payments" | "reports" | "settings";
  label: string;
  icon: typeof Boxes;
  ready: boolean;
};
const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { id: "inventory", label: "Inventory", icon: Boxes, ready: true },
  { id: "sales", label: "Sales & POS", icon: ShoppingCart, ready: false },
  { id: "customers", label: "Customers", icon: Users, ready: false },
  { id: "payments", label: "Payments", icon: CreditCard, ready: false },
  { id: "reports", label: "Reports", icon: BarChart3, ready: false },
  { id: "settings", label: "Settings", icon: Settings2, ready: false },
];

type Props = {
  page: Page;
  onNavigate: (page: Page) => void;
  businesses: Business[];
  active: Business | null;
  onSwitch: (id: string) => void;
  onNewBusiness: () => void;
  userName: string;
  userEmail: string;
  onSignOut: () => void;
  children: React.ReactNode;
};

export function AppShell(p: Props) {
  const [open, setOpen] = useState(false);
  const initials = (p.userName || p.userEmail || "?").trim().slice(0, 1).toUpperCase();
  const nav = (
    <nav className="flex-1 space-y-1 px-3">
      {NAV.map(({ id, label, icon: Icon, ready }) => {
        const current = ready && p.page === id;
        return (
          <button
            key={id}
            disabled={!ready}
            onClick={() => {
              if (ready) {
                p.onNavigate(id as Page);
                setOpen(false);
              }
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${current ? "bg-primary text-primary-foreground shadow-sm" : ready ? "text-foreground/80 hover:bg-muted" : "cursor-not-allowed text-muted-foreground/60"}`}
          >
            <Icon size={18} /> <span className="flex-1 text-left">{label}</span>
            {!ready && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
  const sidebar = (
    <div className="flex h-full flex-col gap-6 py-5">
      <div className="flex items-center gap-2.5 px-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Boxes size={20} />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          Kioo<span className="text-primary">POS</span>
        </span>
      </div>
      {nav}
      <div className="mx-3 flex items-center gap-3 rounded-xl border bg-card p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.userName || "Account"}</span>
          <span className="block truncate text-xs text-muted-foreground">{p.userEmail}</span>
        </span>
        <button
          onClick={p.onSignOut}
          aria-label="Sign out"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-card shadow-xl">
            <button
              className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-8">
          <button
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Building2 size={18} className="hidden text-muted-foreground sm:block" />
          {p.businesses.length > 1 ? (
            <select
              value={p.active?.id ?? ""}
              onChange={(e) => p.onSwitch(e.target.value)}
              className="max-w-[55%] rounded-lg border bg-card px-3 py-1.5 text-sm font-medium"
            >
              {p.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-sm font-medium">{p.active?.name}</span>
          )}
          <button
            onClick={p.onNewBusiness}
            className="ml-auto flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <Plus size={15} /> <span className="hidden sm:inline">New business</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{p.children}</main>
      </div>
    </div>
  );
}
