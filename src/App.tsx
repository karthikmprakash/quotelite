import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell.tsx";
import { EmptyState, useTitle } from "./components/ui.tsx";
import { Login, Start } from "./pages/AuthPages.tsx";
import { CustomerDetail, Customers } from "./pages/CustomerPages.tsx";
import { DesignPage } from "./pages/DesignPage.tsx";
import { Home, Unpaid } from "./pages/HomePages.tsx";
import { InvoiceDetail } from "./pages/InvoicePages.tsx";
import { Landing } from "./pages/Landing.tsx";
import { PublicInvoice, PublicQuote } from "./pages/PublicPages.tsx";
import { QuoteDetail, QuoteForm } from "./pages/QuotePages.tsx";
import { Settings } from "./pages/SettingsPage.tsx";

function NotFound({ inApp }: { inApp?: boolean }) {
  useTitle("Not found · QuoteLite");
  const body = (
    <EmptyState
      title="That page does not exist"
      action={
        <Link className="btn btn-primary" to={inApp ? "/app" : "/"}>
          {inApp ? "Back to Today" : "Go to the home page"}
        </Link>
      }
    >
      The link may be old or mistyped.
    </EmptyState>
  );
  return inApp ? body : <main className="content">{body}</main>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/start" element={<Start />} />
        <Route path="/login" element={<Login />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/v/:token" element={<PublicQuote />} />
        <Route path="/i/:token" element={<PublicInvoice />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="quotes/new" element={<QuoteForm />} />
          <Route path="quotes/:id/edit" element={<QuoteForm />} />
          <Route path="quotes/:id" element={<QuoteDetail />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="unpaid" element={<Unpaid />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound inApp />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
