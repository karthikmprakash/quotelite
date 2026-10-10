import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell.tsx";
import { Login, Start } from "./pages/AuthPages.tsx";
import { CustomerDetail, Customers } from "./pages/CustomerPages.tsx";
import { DesignPage } from "./pages/DesignPage.tsx";
import { Home, Unpaid } from "./pages/HomePages.tsx";
import { InvoiceDetail } from "./pages/InvoicePages.tsx";
import { Landing } from "./pages/Landing.tsx";
import { PublicInvoice, PublicQuote } from "./pages/PublicPages.tsx";
import { QuoteDetail, QuoteForm } from "./pages/QuotePages.tsx";
import { Settings } from "./pages/SettingsPage.tsx";

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
          <Route path="quotes/:id" element={<QuoteDetail />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="unpaid" element={<Unpaid />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
