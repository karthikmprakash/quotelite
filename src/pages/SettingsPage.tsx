import { useEffect, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatPercent } from "../../shared/money.ts";
import { Banner, useTitle } from "../components/ui.tsx";
import { saveBusiness, type Business, type SessionUser } from "../lib/actions.ts";
import { db } from "../lib/db.ts";
import { readPhoto } from "../lib/photos.ts";

export function Settings() {
  useTitle("Settings · QuoteLite");
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const session = useLiveQuery(async () => (await db.meta.get("session"))?.value as SessionUser | undefined, []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [people, setPeople] = useState<{ id: string; name: string; email: string; role: string }[]>([]);

  useEffect(() => {
    if (!navigator.onLine) return;
    void fetch("/api/team", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { people?: { id: string; name: string; email: string; role: string }[] }) => setPeople(data.people || []))
      .catch(() => undefined);
  }, [business?.name]);

  if (!business) return <div className="skeleton" />;

  async function onBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const tax = formatPercent(business!.taxBps);
    const nextTax = String(form.get("tax") || tax);
    const bps = Math.round(Number(nextTax) * 100);
    if (!Number.isInteger(bps) || bps < 0 || bps > 3000) {
      setError("Tax should be a percent, like 8.25.");
      return;
    }
    let logoMime = business!.logoMime;
    let logoBase64 = business!.logoBase64;
    const file = form.get("logo");
    if (file instanceof File && file.size > 0) {
      const photo = await readPhoto(file);
      logoMime = photo.mime;
      logoBase64 = photo.dataBase64;
    }
    await saveBusiness({
      ...business!,
      name: String(form.get("name") || business!.name),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      terms: String(form.get("terms") || ""),
      taxBps: bps,
      logoMime,
      logoBase64,
    });
    setNotice("Saved.");
  }

  async function onTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/team", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("person"), email: form.get("personEmail"), password: form.get("personPassword") }),
    });
    const data = (await res.json()) as { error?: string; person?: { id: string; name: string; email: string; role: string } };
    if (!res.ok || !data.person) {
      setError(data.error || "Could not add that person.");
      return;
    }
    setPeople((current) => [...current, data.person!]);
    event.currentTarget.reset();
  }

  async function onStripe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/settings/stripe", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: form.get("secret"), publishable: form.get("publishable") }),
    });
    const data = (await res.json()) as { error?: string; payments?: string };
    if (!res.ok) {
      setError(data.error || "Could not connect payments.");
      return;
    }
    await saveBusiness({ ...business!, payments: "test" });
    setNotice("Test card account connected.");
    event.currentTarget.reset();
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      <p className="muted">Plan label: {business.plan}. People and quotes are not capped. Subscription billing is not collected in this build.</p>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      <form className="stack" onSubmit={(event) => void onBusiness(event)}>
        <h2>Business</h2>
        <label className="field">
          Business name
          <input name="name" defaultValue={business.name} />
        </label>
        <label className="field">
          Phone
          <input name="phone" defaultValue={business.phone} />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" defaultValue={business.email} />
        </label>
        <label className="field">
          Tax %
          <input name="tax" defaultValue={formatPercent(business.taxBps)} />
        </label>
        <label className="field">
          Terms
          <textarea name="terms" defaultValue={business.terms} />
        </label>
        <label className="field">
          Logo
          <input name="logo" type="file" accept="image/*" />
        </label>
        <button className="btn btn-primary" type="submit">
          Save business
        </button>
      </form>
      <form className="stack" onSubmit={(event) => void onTeam(event)}>
        <h2>People</h2>
        <ul>
          {people.map((person) => (
            <li key={person.id}>
              {person.name} · {person.role}
            </li>
          ))}
          {session ? <li>{session.name} · {session.role}</li> : null}
        </ul>
        <label className="field">
          Name
          <input name="person" />
        </label>
        <label className="field">
          Email
          <input name="personEmail" type="email" />
        </label>
        <label className="field">
          Password
          <input name="personPassword" type="password" />
        </label>
        <button className="btn btn-secondary" type="submit">
          Add person
        </button>
      </form>
      <form className="stack" onSubmit={(event) => void onStripe(event)}>
        <h2>Card payments</h2>
        <p className="muted">
          {business.payments === "test" ? "A test account is connected." : "Not connected."} Paste your own Stripe test keys. Live keys are refused, and no fee is added.
        </p>
        <label className="field">
          Test secret key
          <input name="secret" type="password" autoComplete="off" />
        </label>
        <label className="field">
          Test publishable key
          <input name="publishable" autoComplete="off" />
        </label>
        <button className="btn btn-secondary" type="submit">
          Connect test account
        </button>
      </form>
      <a className="btn btn-secondary" href="/api/export.csv">
        Download invoice CSV
      </a>
    </div>
  );
}
