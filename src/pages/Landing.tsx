import { Link } from "react-router-dom";
import { useTitle } from "../components/ui.tsx";

export function Landing() {
  useTitle("QuoteLite");
  return (
    <main className="hero stack">
      <img className="mark" src="/favicon.svg" alt="" />
      <h1>A quote from the driveway, then the invoice, then paid.</h1>
      <p className="muted">
        QuoteLite is for a one to three person trade crew. Write the quote on your phone, send the link, and turn a yes into an invoice without typing it twice. It keeps working in a basement with no signal.
      </p>
      <div className="price-grid">
        <article className="card stack">
          <h2>Solo</h2>
          <p className="price">$19 a month</p>
          <p className="muted">$180 a year. Same tools, as many quotes as the work needs.</p>
        </article>
        <article className="card stack">
          <h2>Crew</h2>
          <p className="price">$29 a month</p>
          <p className="muted">$290 a year. Add the people on the truck. The price does not climb per person.</p>
        </article>
      </div>
      <p>Both plans send quotes, invoices, and card payments through your own account. QuoteLite does not take a cut of the job.</p>
      <Link className="btn btn-primary" to="/start">
        Start a crew
      </Link>
      <p>
        Already set up? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
