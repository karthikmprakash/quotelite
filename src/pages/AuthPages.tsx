import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banner, useTitle } from "../components/ui.tsx";
import { rememberSession } from "../lib/actions.ts";

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; user?: Parameters<typeof rememberSession>[0] };
  if (!res.ok || !data.user) throw new Error(data.error || "Could not sign you in.");
  return data.user;
}

export function Start() {
  useTitle("Start a crew · QuoteLite");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        plan: form.get("plan"),
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
    <main className="content">
      <h1>Start a crew</h1>
      <form className="stack" onSubmit={onSubmit}>
        {error ? <Banner kind="error">{error}</Banner> : null}
        <label className="field">
          Your name
          <input name="name" autoComplete="name" required />
        </label>
        <label className="field">
          Business name
          <input name="businessName" required />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        <fieldset>
          <legend>Plan label</legend>
          <label>
            <input type="radio" name="plan" value="solo" defaultChecked /> Solo, $19
          </label>
          <label>
            <input type="radio" name="plan" value="crew" /> Crew, $29
          </label>
          <p className="muted">The label is the price you would pay. Nothing in the app locks if you pick one or the other.</p>
        </fieldset>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating account" : "Create account"}
        </button>
      </form>
      <p>
        <Link to="/login">I already have an account</Link>
      </p>
    </main>
  );
}

export function Login() {
  useTitle("Log in · QuoteLite");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <main className="content">
      <h1>Log in</h1>
      <form className="stack" onSubmit={onSubmit}>
        {error ? <Banner kind="error">{error}</Banner> : null}
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Checking" : "Log in"}
        </button>
      </form>
      <p>
        <Link to="/start">Start a crew</Link>
      </p>
    </main>
  );
}
