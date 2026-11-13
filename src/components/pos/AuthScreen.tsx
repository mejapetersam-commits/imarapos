import { Boxes, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthMode } from "./types";

type Props = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  busy: boolean;
  confirmation: boolean;
  onBack: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const points = [
  ["Know your stock", "Live quantities, low-stock alerts and a full movement history."],
  ["See the full picture", "Sales, profit and credit in one clear dashboard."],
  ["Built for Kenya", "KES pricing, M-Pesa payments and offline selling are on the way."],
];

export function AuthScreen(p: Props) {
  const signup = p.mode === "signup";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-teal-300/10 blur-3xl" />
        <Brand light />
        <div className="relative max-w-md">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-200">
            Smart POS for SMEs
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Make every business day count.
          </h1>
          <ul className="mt-10 space-y-5">
            {points.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-sm text-emerald-100/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-emerald-100/60">
          © {new Date().getFullYear()} Kioo POS
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          {p.confirmation ? (
            <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check />
              </span>
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to{" "}
                <strong className="text-foreground">{p.email}</strong>. Confirm your address, then
                sign in.
              </p>
              <Button className="mt-6 w-full" variant="outline" onClick={p.onBack}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
                <ShieldCheck size={14} /> Secure sign-in
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {signup ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {signup
                  ? "Set up your business in a couple of minutes."
                  : "Sign in to see how your business is doing."}
              </p>
              <form onSubmit={p.onSubmit} className="mt-6 space-y-4">
                {signup && (
                  <Labelled label="Your name">
                    <Input
                      value={p.name}
                      onChange={(e) => p.setName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Jane Wanjiru"
                    />
                  </Labelled>
                )}
                <Labelled label="Email">
                  <Input
                    type="email"
                    value={p.email}
                    onChange={(e) => p.setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@business.co.ke"
                  />
                </Labelled>
                <Labelled label="Password">
                  <Input
                    type="password"
                    value={p.password}
                    onChange={(e) => p.setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={signup ? "new-password" : "current-password"}
                    placeholder="At least 8 characters"
                  />
                </Labelled>
                <Button type="submit" className="h-11 w-full" disabled={p.busy}>
                  {p.busy && <LoaderCircle className="animate-spin" />}{" "}
                  {signup ? "Create account" : "Sign in"}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {signup ? "Already have an account?" : "New to Kioo POS?"}{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => p.setMode(signup ? "signin" : "signup")}
                >
                  {signup ? "Sign in" : "Create an account"}
                </button>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="relative flex items-center gap-2.5">
      <span
        className={`flex size-9 items-center justify-center rounded-xl ${light ? "bg-white/15" : "bg-primary text-primary-foreground"}`}
      >
        <Boxes size={20} />
      </span>
      <span className="text-lg font-semibold tracking-tight">
        Kioo<span className={light ? "text-emerald-200" : "text-primary"}>POS</span>
      </span>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
