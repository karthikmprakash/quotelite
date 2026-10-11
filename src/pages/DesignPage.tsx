import { useTitle } from "../components/ui.tsx";

export function DesignPage() {
  useTitle("Primitives · QuoteLite");
  return (
    <main className="content stack">
      <h1>Primitives</h1>
      <div className="row">
        <button className="btn btn-primary" type="button">Primary</button>
        <button className="btn btn-secondary" type="button">Secondary</button>
        <button className="btn btn-ghost" type="button">Ghost</button>
        <button className="btn btn-danger" type="button">Danger</button>
        <button className="btn btn-primary" type="button" disabled>Disabled</button>
        <button className="btn btn-primary" type="button" aria-busy="true">Saving…</button>
      </div>
      <label className="field">
        Label
        <input placeholder="Type here…" />
      </label>
      <p className="banner banner-error" role="alert">Something needs a fix.</p>
      <p className="banner banner-ok">Saved on this phone.</p>
      <button className="chip" type="button">Saved item</button>
    </main>
  );
}
