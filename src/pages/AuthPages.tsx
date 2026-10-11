import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Banner, useTitle } from "../components/ui.tsx";
import { rememberSession, type SessionUser } from "../lib/actions.ts";
import { db } from "../lib/db.ts";

async function post(path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "include",
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      path === "/api/auth/demo"
        ? "Could not reach the API. Run npm run start:e2e in another terminal, then try again."
        : "Could not reach the API.",
    );
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; user?: Parameters<typeof rememberSession>[0] };
  if (!res.ok || !data.user) {
    if (path === "/api/auth/demo" && res.status === 401) {
      throw new Error("Demo login needs a current API. Restart with npm run start:e2e, then try again.");
    }
    throw new Error(data.error || "Could not sign you in.");
  }
  return data.user;
}

export async function enterDemo() {
  const user = await post("/api/auth/demo");
  await rememberSession(user);
  return user;
}

function AuthCard({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-card stack">
        <Link className="auth-brand" to="/" translate="no">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          QuoteLite
        </Link>
        <div className="auth-head">
          <h1>{title}</h1>
          {lede ? <p className="muted">{lede}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}

function useSignedIn() {
  return useLiveQuery(async () => ((await db.meta.get("session"))?.value as SessionUser | undefined) ?? null, []);
}

export function Start() {
  useTitle("Start a crew · QuoteLite");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const requested = params.get("plan") === "crew" ? "crew" : "solo";
  const [plan, setPlan] = useState<"solo" | "crew">(requested);

  useEffect(() => {
    setPlan(requested);
  }, [requested]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const user = await post("/api/auth/signup", {
        name: form.get("name"),
        businessName: form.get("businessName"),
        email: form.get("email"),
        password: form.get("password"),
        plan,
      });
      await rememberSession({ ...user, businessName: String(form.get("businessName") || user.businessName) });
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Start a crew" lede="Two minutes, no card. Your first quote can go out today.">
      <form className="stack" onSubmit={onSubmit}>
        {error ? <Banner kind="error">{error}</Banner> : null}
        <label className="field">
          Your name
          <input name="name" autoComplete="name" required placeholder="Jordan Lee…" />
        </label>
        <label className="field">
          Business name
          <input name="businessName" required placeholder="Lee Plumbing…" autoComplete="organization" />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="email" required spellCheck={false} placeholder="you@example.com…" />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters…" />
        </label>
        <fieldset className="plan-picker">
          <legend>Plan</legend>
          {(
            [
              { value: "solo", name: "Solo", price: "$19 a month", body: "Just you" },
              { value: "crew", name: "Crew", price: "$29 a month", body: "Everyone on the truck" },
            ] as const
          ).map((option) => (
            <label key={option.value} className="plan-option" data-checked={plan === option.value || undefined}>
              <input
                type="radio"
                name="plan"
                value={option.value}
                checked={plan === option.value}
                onChange={() => setPlan(option.value)}
              />
              <span className="plan-name">{option.name}</span>
              <span className="plan-price">{option.price}</span>
              <span className="plan-body muted">{option.body}</span>
            </label>
          ))}
          <p className="field-hint">Nothing is billed yet, and you can switch later.</p>
        </fieldset>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthCard>
  );
}

export function Login() {
  useTitle("Log in · QuoteLite");
  const navigate = useNavigate();
  const signedIn = useSignedIn();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const user = await post("/api/auth/login", { email: form.get("email"), password: form.get("password") });
      await rememberSession(user);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
    } finally {
      setBusy(false);
    }
  }

  async function onDemo() {
    setError("");
    setDemoBusy(true);
    try {
      await enterDemo();
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the demo.");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <AuthCard title="Log in" lede="Pick up where you left off. Quotes saved on this phone stay here.">
      {signedIn ? (
        <Link className="btn btn-secondary btn-block" to="/app">
          Continue as {signedIn.name}
        </Link>
      ) : null}
      <form className="stack" onSubmit={onSubmit}>
        {error ? <Banner kind="error">{error}</Banner> : null}
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="username" required spellCheck={false} placeholder="you@example.com…" />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="current-password" required placeholder="Your password…" />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || demoBusy} aria-busy={busy}>
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
      <div className="divider" role="presentation">
        <span>or</span>
      </div>
      <button
        className="btn btn-secondary btn-block"
        type="button"
        disabled={busy || demoBusy}
        aria-busy={demoBusy}
        onClick={() => void onDemo()}
      >
        {demoBusy ? "Opening demo…" : "Try the demo account"}
      </button>
      <p className="auth-foot">
        New here? <Link to="/start">Start a crew</Link>
      </p>
    </AuthCard>
  );
}
