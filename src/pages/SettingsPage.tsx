import { useEffect, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DownloadSimple, SignOut, UserPlus } from "@phosphor-icons/react";
import { formatPercent, parseTaxPercent } from "../../shared/money.ts";
import { useLogout } from "../components/Shell.tsx";
import { Banner, PageHeader, useOnline, useTitle } from "../components/ui.tsx";
import { saveBusiness, type Business, type SessionUser } from "../lib/actions.ts";
import { db } from "../lib/db.ts";
import { readPhoto } from "../lib/photos.ts";

type Person = { id: string; name: string; email: string; role: string };
type Note = { kind: "ok" | "error"; text: string } | null;

function useNote(): [Note, (note: Note) => void] {
  const [note, setNote] = useState<Note>(null);
  useEffect(() => {
    if (note?.kind !== "ok") return;
    const timer = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);
  return [note, setNote];
}

function NoteBanner({ note, onDismiss }: { note: Note; onDismiss: () => void }) {
  if (!note) return null;
  return (
    <Banner kind={note.kind} onDismiss={onDismiss}>
      {note.text}
    </Banner>
  );
}

const PLAN_COPY: Record<string, string> = {
  solo: "Solo plan, $19 a month",
  crew: "Crew plan, $29 a month",
};

export function Settings() {
  useTitle("Settings · QuoteLite");
  const online = useOnline();
  const logOut = useLogout();
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const session = useLiveQuery(async () => (await db.meta.get("session"))?.value as SessionUser | undefined, []);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [businessNote, setBusinessNote] = useNote();
  const [teamNote, setTeamNote] = useNote();
  const [stripeNote, setStripeNote] = useNote();
  const [busy, setBusy] = useState<"business" | "team" | "stripe" | null>(null);

  useEffect(() => {
    if (!online) return;
    let live = true;
    void fetch("/api/team", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("team"))))
      .then((data: { people?: Person[] }) => live && setPeople(data.people || []))
      .catch(() => live && setPeople(null));
    return () => {
      live = false;
    };
  }, [online]);

  if (!business || !session) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading settings…">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-doc" />
      </div>
    );
  }
  const current = business;
  const team = people ?? [{ id: session.id, name: session.name, email: session.email, role: session.role }];

  async function onBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusinessNote(null);
    const form = new FormData(event.currentTarget);
    const bps = parseTaxPercent(String(form.get("tax") ?? ""));
    if (bps === null) {
      setBusinessNote({ kind: "error", text: "Tax should be a percent between 0 and 30, like 8.25." });
      return;
    }
    const name = String(form.get("name") || "").trim();
    if (!name) {
      setBusinessNote({ kind: "error", text: "The business needs a name. It goes on every quote." });
      return;
    }
    setBusy("business");
    try {
      let logoMime = current.logoMime;
      let logoBase64 = current.logoBase64;
      const file = form.get("logo");
      if (file instanceof File && file.size > 0) {
        const photo = await readPhoto(file);
        logoMime = photo.mime;
        logoBase64 = photo.dataBase64;
      }
      await saveBusiness({
        ...current,
        name,
        phone: String(form.get("phone") || "").trim(),
        email: String(form.get("email") || "").trim(),
        terms: String(form.get("terms") || "").trim(),
        taxBps: bps,
        logoMime,
        logoBase64,
      });
      setBusinessNote({ kind: "ok", text: "Saved. New quotes use these details." });
    } catch (err) {
      setBusinessNote({ kind: "error", text: err instanceof Error ? err.message : "Could not save the business details." });
    } finally {
      setBusy(null);
    }
  }

  async function onTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setTeamNote(null);
    setBusy("team");
    const form = new FormData(formEl);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("person"), email: form.get("personEmail"), password: form.get("personPassword") }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; person?: Person };
      if (!res.ok || !data.person) throw new Error(data.error || "Could not add that person.");
      const added = data.person;
      setPeople((list) => [...(list ?? team), added]);
      setTeamNote({ kind: "ok", text: `${added.name} can now log in with ${added.email}.` });
      formEl.reset();
    } catch (err) {
      setTeamNote({ kind: "error", text: err instanceof Error ? err.message : "Could not add that person." });
    } finally {
      setBusy(null);
    }
  }

  async function onStripe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setStripeNote(null);
    setBusy("stripe");
    const form = new FormData(formEl);
    try {
      const res = await fetch("/api/settings/stripe", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: form.get("secret"), publishable: form.get("publishable") }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not connect payments.");
      await saveBusiness({ ...current, payments: "test" });
      setStripeNote({ kind: "ok", text: "Test card account connected. Customers can now pay invoices by card." });
      formEl.reset();
    } catch (err) {
      setStripeNote({ kind: "error", text: err instanceof Error ? err.message : "Could not connect payments." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader title="Settings">
        <span className="muted">{PLAN_COPY[current.plan] ?? current.plan}. No limits on people or quotes.</span>
      </PageHeader>

      <form className="panel stack" onSubmit={(event) => void onBusiness(event)} aria-labelledby="business-heading">
        <div className="panel-head">
          <h2 id="business-heading">Business</h2>
          <p className="muted">Shown on every quote, invoice, and PDF.</p>
        </div>
        <NoteBanner note={businessNote} onDismiss={() => setBusinessNote(null)} />
        <label className="field">
          Business name
          <input name="name" defaultValue={current.name} autoComplete="organization" />
        </label>
        <div className="field-pair">
          <label className="field">
            Phone
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={current.phone} />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" spellCheck={false} defaultValue={current.email} />
          </label>
        </div>
        <label className="field field-narrow">
          Default tax %
          <input name="tax" inputMode="decimal" defaultValue={formatPercent(current.taxBps)} />
        </label>
        <label className="field">
          Terms
          <textarea name="terms" defaultValue={current.terms} />
        </label>
        <div className="logo-row">
          {current.logoBase64 ? (
            <img className="logo-preview" src={`data:${current.logoMime || "image/png"};base64,${current.logoBase64}`} alt="Current logo" />
          ) : (
            <span className="logo-preview logo-empty" aria-hidden="true">
              {current.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <label className="field">
            Logo
            <input name="logo" type="file" accept="image/*" />
          </label>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy === "business"} aria-busy={busy === "business"}>
          {busy === "business" ? "Saving…" : "Save business"}
        </button>
      </form>

      <form className="panel stack" onSubmit={(event) => void onTeam(event)} aria-labelledby="people-heading">
        <div className="panel-head">
          <h2 id="people-heading">People</h2>
          <p className="muted">Everyone on the truck shares the same quotes and customers.</p>
        </div>
        <ul className="people">
          {team.map((person) => (
            <li key={person.id}>
              <span className="avatar" aria-hidden="true">
                {person.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="row-main">
                <span className="row-title">
                  {person.name}
                  {person.id === session.id ? <span className="muted"> (you)</span> : null}
                </span>
                <span className="row-meta muted">{person.email}</span>
              </span>
              <span className="pill" data-tone={person.role === "owner" ? "accent" : "neutral"}>
                {person.role === "owner" ? "Owner" : "Helper"}
              </span>
            </li>
          ))}
        </ul>
        <NoteBanner note={teamNote} onDismiss={() => setTeamNote(null)} />
        {online ? (
          <fieldset className="subform stack">
            <legend>Add a person</legend>
            <label className="field">
              Name
              <input name="person" autoComplete="off" required />
            </label>
            <div className="field-pair">
              <label className="field">
                Email
                <input name="personEmail" type="email" autoComplete="off" spellCheck={false} required />
              </label>
              <label className="field">
                Password
                <input name="personPassword" type="password" autoComplete="new-password" minLength={8} required />
              </label>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={busy === "team"} aria-busy={busy === "team"}>
              <UserPlus size={18} weight="bold" aria-hidden="true" />
              {busy === "team" ? "Adding…" : "Add person"}
            </button>
          </fieldset>
        ) : (
          <p className="hint">Connect to the internet to add people.</p>
        )}
      </form>

      <form className="panel stack" onSubmit={(event) => void onStripe(event)} aria-labelledby="payments-heading">
        <div className="panel-head">
          <h2 id="payments-heading">Card payments</h2>
          <span className="pill" data-tone={current.payments === "test" ? "success" : "neutral"}>
            {current.payments === "test" ? "Test account connected" : "Not connected"}
          </span>
        </div>
        <p className="muted">Paste your own Stripe test keys. Money goes to your account, and QuoteLite adds no fee. Live keys are refused in this build.</p>
        <NoteBanner note={stripeNote} onDismiss={() => setStripeNote(null)} />
        <label className="field">
          Test secret key
          <input name="secret" type="password" autoComplete="off" spellCheck={false} placeholder="sk_test_…" />
        </label>
        <label className="field">
          Test publishable key
          <input name="publishable" autoComplete="off" spellCheck={false} placeholder="pk_test_…" />
        </label>
        <button className="btn btn-secondary" type="submit" disabled={busy === "stripe" || !online} aria-busy={busy === "stripe"}>
          {busy === "stripe" ? "Connecting…" : "Connect test account"}
        </button>
      </form>

      <section className="panel stack" aria-labelledby="data-heading">
        <div className="panel-head">
          <h2 id="data-heading">Your data</h2>
          <p className="muted">Every invoice with what was paid and what is still owed.</p>
        </div>
        <a className="btn btn-secondary" href="/api/export.csv">
          <DownloadSimple size={18} weight="bold" aria-hidden="true" />
          Download invoice CSV
        </a>
      </section>

      <section className="panel stack" aria-labelledby="account-heading">
        <div className="panel-head">
          <h2 id="account-heading">Account</h2>
          <p className="muted">
            Logged in as {session.name} ({session.email})
          </p>
        </div>
        <button className="btn btn-danger" type="button" onClick={() => void logOut()}>
          <SignOut size={18} weight="bold" aria-hidden="true" />
          Log out
        </button>
      </section>
    </div>
  );
}
