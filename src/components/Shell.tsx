import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db.ts";
import { logoutLocal, type Business, type SessionUser } from "../lib/actions.ts";
import { syncNow } from "../lib/sync.ts";

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Shell() {
  const navigate = useNavigate();
  const session = useLiveQuery(async () => {
    const row = await db.meta.get("session");
    return (row?.value as SessionUser | undefined) ?? null;
  }, []);
  const business = useLiveQuery(async () => {
    const row = await db.meta.get("business");
    return (row?.value as Business | undefined) ?? null;
  }, []);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const syncError = useLiveQuery(async () => {
    const row = await db.meta.get("syncError");
    return (row?.value as string | undefined) ?? "";
  }, []);
  const online = useOnline();

  useEffect(() => {
    if (!online) return;
    void syncNow();
    const timer = window.setInterval(() => void syncNow(), 4000);
    return () => window.clearInterval(timer);
  }, [online]);

  useEffect(() => {
    if (session === null) navigate("/login");
  }, [session, navigate]);

  if (session === undefined || session === null) {
    return (
      <main className="content" aria-busy="true">
        <div className="skeleton" />
        <div className="skeleton" />
      </main>
    );
  }

  const label = !online ? "On this phone" : pending > 0 ? "Waiting to sync" : "Synced";

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <nav aria-label="Primary">
        <NavLink to="/app" end>
          Today
        </NavLink>
        <NavLink to="/app/unpaid">Unpaid</NavLink>
        <NavLink to="/app/customers">Customers</NavLink>
        <NavLink to="/app/settings">Settings</NavLink>
      </nav>
      <header className="topbar">
        <a className="brand" href="/app">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          {business?.name || session.businessName}
        </a>
        <span role="status" aria-live="polite">
          {label}
        </span>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(async () => {
              await logoutLocal();
              navigate("/login");
            });
          }}
        >
          Log out
        </button>
      </header>
      <main id="main" className="content">
        {syncError ? (
          <p className="banner banner-error" role="alert">
            {syncError}
          </p>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  return <main className="content">{children}</main>;
}
