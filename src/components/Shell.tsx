import { useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Gear, House, Plus, Receipt, SignOut, Users } from "@phosphor-icons/react";
import { db } from "../lib/db.ts";
import { logoutLocal, unsyncedCount, type Business, type SessionUser } from "../lib/actions.ts";
import { dismissSyncIssue, syncNow, type SyncIssue } from "../lib/sync.ts";
import { Banner, useOnline } from "./ui.tsx";

export function useLogout() {
  const navigate = useNavigate();
  return async () => {
    await syncNow();
    const left = await unsyncedCount();
    if (left > 0) {
      const noun = left === 1 ? "1 change has" : `${left} changes have`;
      const ok = window.confirm(`${noun} not synced yet. Logging out now deletes them from this phone. Log out anyway?`);
      if (!ok) return;
    }
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    await logoutLocal();
    navigate("/login", { replace: true });
  };
}

export function Shell() {
  const navigate = useNavigate();
  const logOut = useLogout();
  const onToday = useMatch({ path: "/app", end: true });
  const onNewQuote = useMatch("/app/quotes/new");
  const onEditQuote = useMatch("/app/quotes/:id/edit");
  const session = useLiveQuery(async () => {
    const row = await db.meta.get("session");
    return (row?.value as SessionUser | undefined) ?? null;
  }, []);
  const business = useLiveQuery(async () => {
    const row = await db.meta.get("business");
    return (row?.value as Business | undefined) ?? null;
  }, []);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const issue = useLiveQuery(async () => ((await db.meta.get("syncIssue"))?.value as SyncIssue | undefined) ?? null, []);
  const online = useOnline();

  useEffect(() => {
    if (!online) return;
    void syncNow();
    const timer = window.setInterval(() => void syncNow(), 4000);
    return () => window.clearInterval(timer);
  }, [online]);

  useEffect(() => {
    if (session === null) navigate("/login", { replace: true });
  }, [session, navigate]);

  if (session === undefined || session === null) {
    return (
      <main className="content" aria-busy="true" aria-label="Loading">
        <div className="skeleton skeleton-block" />
        <div className="skeleton" />
        <div className="skeleton" />
      </main>
    );
  }

  const syncState = !online ? "offline" : pending > 0 ? "pending" : "ok";
  const label = syncState === "offline" ? "On this phone" : syncState === "pending" ? "Waiting to sync…" : "Synced";
  const name = business?.name || session.businessName;

  return (
    <div className="app">
      <div className="app-atmosphere" aria-hidden="true">
        <div className="app-orb app-orb-a" />
        <div className="app-orb app-orb-b" />
        <div className="app-orb app-orb-c" />
        <div className="app-grain" />
      </div>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <nav className="nav" aria-label="Primary">
        <Link className="nav-brand" to="/app">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <span>{name}</span>
        </Link>
        <Link className="btn btn-primary nav-new" to="/app/quotes/new">
          <Plus size={18} weight="bold" aria-hidden="true" />
          New quote
        </Link>
        <NavItem to="/app" end icon={<House size={22} weight="duotone" aria-hidden="true" />}>
          Today
        </NavItem>
        <NavItem to="/app/unpaid" icon={<Receipt size={22} weight="duotone" aria-hidden="true" />}>
          Unpaid
        </NavItem>
        <NavItem to="/app/customers" icon={<Users size={22} weight="duotone" aria-hidden="true" />}>
          Customers
        </NavItem>
        <NavItem to="/app/settings" icon={<Gear size={22} weight="duotone" aria-hidden="true" />}>
          Settings
        </NavItem>
        <div className="nav-foot">
          <span className="nav-user">{session.name}</span>
          <button className="btn btn-ghost nav-logout" type="button" onClick={() => void logOut()}>
            <SignOut size={18} weight="bold" aria-hidden="true" />
            Log out
          </button>
        </div>
      </nav>
      <header className="topbar">
        <Link className="brand" to="/app">
          <img src="/favicon.svg" alt="" width={30} height={30} />
          <span>{name}</span>
        </Link>
        <div className="topbar-actions">
          <span className="sync-pill" data-state={syncState} role="status" aria-live="polite">
            {label}
          </span>
          {!onToday && !onNewQuote && !onEditQuote ? (
            <Link className="btn btn-primary topbar-new" to="/app/quotes/new" aria-label="New quote">
              <Plus size={18} weight="bold" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>
      <main id="main" className="content">
        {issue ? (
          <Banner
            kind="error"
            onDismiss={issue.kind === "rejected" ? () => void dismissSyncIssue() : undefined}
            action={
              issue.kind === "auth" ? (
                <Link className="btn btn-secondary banner-action" to="/login">
                  Log in
                </Link>
              ) : undefined
            }
          >
            {issue.message}
          </Banner>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, end, icon, children }: { to: string; end?: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink className="nav-item" to={to} end={end}>
      {icon}
      <span>{children}</span>
    </NavLink>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  return <main className="content">{children}</main>;
}
