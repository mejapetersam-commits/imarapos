import { Ban, Check, LoaderCircle, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingInvite, TeamMember } from "@/api/functions";
import type { Role } from "./types";

type Props = {
  members: TeamMember[];
  invites: PendingInvite[];
  me: string;
  loading: boolean;
  isOwner: boolean;
  onInvite: () => void;
  onRevoke: (invite: PendingInvite) => void;
  onChangeRole: (member: TeamMember, role: Role) => void;
  onToggleActive: (member: TeamMember) => void;
};

const ROLE_INFO: [Role, string][] = [
  ["owner", "Full access, including team, roles and business settings."],
  ["manager", "Manage products, stock, suppliers and see all reports. Cannot change the team."],
  ["cashier", "Sell and look up products and customers. Cannot change stock, prices or the team."],
];

export function Team(p: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Team</h1>
          <p className="text-sm text-muted-foreground">
            {p.members.filter((m) => m.active).length} active{" "}
            {p.members.filter((m) => m.active).length === 1 ? "member" : "members"}
          </p>
        </div>
        {p.isOwner && (
          <Button onClick={p.onInvite}>
            <UserPlus /> Invite someone
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {p.loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Loading team…
          </div>
        ) : (
          <ul className="divide-y">
            {p.members.map((m) => {
              const self = m.user_id === p.me;
              return (
                <li
                  key={m.user_id}
                  className={`flex flex-wrap items-center gap-3 p-4 ${m.active ? "" : "opacity-60"}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                    {(m.name || m.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {m.name || m.email}{" "}
                      {self && (
                        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          You
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                  </span>
                  {p.isOwner ? (
                    <select
                      value={m.role}
                      disabled={!m.active}
                      onChange={(e) => p.onChangeRole(m, e.target.value as Role)}
                      className="h-9 rounded-lg border bg-background px-2 text-sm capitalize"
                      aria-label={`Role for ${m.name || m.email}`}
                    >
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                      {m.role}
                    </span>
                  )}
                  {!m.active && (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                      Deactivated
                    </span>
                  )}
                  {p.isOwner && !self && (
                    <Button size="sm" variant="outline" onClick={() => p.onToggleActive(m)}>
                      {m.active ? (
                        <>
                          <Ban /> Deactivate
                        </>
                      ) : (
                        <>
                          <Check /> Reactivate
                        </>
                      )}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {p.isOwner && p.invites.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Pending invites</h2>
          <ul className="mt-3 divide-y">
            {p.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Mail size={16} className="text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.role} · expires{" "}
                    {new Date(i.expires_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => p.onRevoke(i)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">What each role can do</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {ROLE_INFO.map(([role, text]) => (
            <div key={role} className="rounded-xl bg-muted/40 p-4">
              <dt className="text-sm font-medium capitalize">{role}</dt>
              <dd className="mt-1 text-xs text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
