import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CloudSlash,
  CurrencyDollar,
  DeviceMobile,
  Lightning,
  Receipt,
  ShareNetwork,
  WifiSlash,
} from "@phosphor-icons/react";
import { useTitle } from "../components/ui.tsx";
import { enterDemo } from "./AuthPages.tsx";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-in" : ""} ${className}`.trim()}
      style={{ transitionDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Write the quote",
    body: "Lines, photos, tax, and notes from the job site.",
    icon: DeviceMobile,
  },
  {
    n: "02",
    title: "Send the link",
    body: "Text, WhatsApp, or email. No customer account needed.",
    icon: ShareNetwork,
  },
  {
    n: "03",
    title: "Invoice and get paid",
    body: "One tap to convert. Card payments through your account.",
    icon: Receipt,
  },
] as const;

export function Landing() {
  useTitle("QuoteLite · Quote, invoice, get paid");
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [navSolid, setNavSolid] = useState(false);
  const heroEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroEnd.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNavSolid(entry.boundingClientRect.top < 80), {
      threshold: [0, 1],
      rootMargin: "-80px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function onDemo() {
    setDemoError("");
    setDemoBusy(true);
    try {
      await enterDemo();
      navigate("/app");
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Could not open the demo.");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="site">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <div className="site-atmosphere" aria-hidden="true">
        <div className="site-orb site-orb-a" />
        <div className="site-orb site-orb-b" />
        <div className="site-orb site-orb-c" />
        <div className="site-grain" />
      </div>

      <header className={navSolid ? "site-nav is-solid" : "site-nav"}>
        <div className="site-nav-glass">
          <Link className="site-nav-brand" to="/" translate="no">
            <img src="/favicon.svg" alt="" width={32} height={32} />
            <span>QuoteLite</span>
          </Link>
          <nav className="site-nav-links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="site-nav-actions">
            <Link className="site-link" to="/login">
              Log in
            </Link>
            <Link className="site-btn site-btn-primary" to="/start">
              Start a crew
              <ArrowRight weight="bold" size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="site-hero" aria-labelledby="hero-heading">
          <div className="site-hero-media" aria-hidden="true">
            <img
              src="/images/hero-field.jpg"
              alt=""
              width={2000}
              height={1333}
              fetchPriority="high"
            />
            <div className="site-hero-scrim" />
          </div>

          <div className="site-hero-stage">
            <div className="site-glass site-hero-panel">
              <h1 id="hero-heading">Quote on the driveway. Invoice when they say yes.</h1>
              <p className="site-hero-support">
                For a one to three person trade crew. Works offline in a basement with no signal.
              </p>
              <div className="site-hero-actions">
                <Link className="site-btn site-btn-primary site-btn-lg" to="/start">
                  Start a crew
                  <ArrowRight weight="bold" size={18} aria-hidden="true" />
                </Link>
                <button
                  className="site-btn site-btn-glass site-btn-lg"
                  type="button"
                  disabled={demoBusy}
                  aria-busy={demoBusy}
                  onClick={() => void onDemo()}
                >
                  {demoBusy ? "Opening demo…" : "Try the demo"}
                </button>
              </div>
              {demoError ? (
                <p className="site-hero-error" role="alert">
                  {demoError}
                </p>
              ) : null}
            </div>
          </div>
          <div ref={heroEnd} className="site-hero-end" aria-hidden="true" />
        </section>

        <section className="site-strip" aria-label="Product facts">
          <div className="site-strip-glass">
            <div className="site-strip-item">
              <WifiSlash size={20} weight="duotone" aria-hidden="true" />
              <div>
                <strong>Offline first</strong>
                <span>Saves without signal</span>
              </div>
            </div>
            <div className="site-strip-item">
              <Lightning size={20} weight="duotone" aria-hidden="true" />
              <div>
                <strong>One tap to invoice</strong>
                <span>No retyping lines</span>
              </div>
            </div>
            <div className="site-strip-item">
              <CurrencyDollar size={20} weight="duotone" aria-hidden="true" />
              <div>
                <strong>Your payment account</strong>
                <span>We take none of the job</span>
              </div>
            </div>
          </div>
        </section>

        <section className="site-band" id="how" aria-labelledby="how-heading">
          <div className="site-band-media" aria-hidden="true">
            <img src="/images/feature-site.jpg" alt="" width={1400} height={900} loading="lazy" />
            <div className="site-band-scrim" />
          </div>
          <div className="site-section site-band-content">
            <div className="site-how">
              <Reveal className="site-glass site-how-intro">
                <h2 id="how-heading">From driveway to paid, without retyping.</h2>
                <p className="site-lead">
                  Write once on your phone, send a link, convert to an invoice when the job is on.
                </p>
              </Reveal>

              <ol className="site-steps">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title}>
                      <Reveal className="site-glass site-step" delay={i * 80}>
                        <span className="site-step-n" aria-hidden="true">
                          {step.n}
                        </span>
                        <span className="site-step-icon" aria-hidden="true">
                          <Icon size={22} weight="duotone" />
                        </span>
                        <div>
                          <strong>{step.title}</strong>
                          <p>{step.body}</p>
                        </div>
                      </Reveal>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section className="site-section" id="features" aria-labelledby="features-heading">
          <Reveal>
            <h2 id="features-heading">Built for the truck, not the desk.</h2>
          </Reveal>

          <div className="site-bento">
            <Reveal className="site-glass site-bento-photo site-bento-wide">
              <img
                src="/images/feature-site.jpg"
                alt="Trade professional working on site with tools"
                width={1400}
                height={900}
                loading="lazy"
              />
              <div className="site-glass-caption">
                <CloudSlash size={22} weight="duotone" aria-hidden="true" />
                <div>
                  <strong>Offline by default</strong>
                  <p>Quotes still save with no signal, then sync when you are back.</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={70} className="site-glass site-bento-fill">
              <Lightning size={28} weight="duotone" aria-hidden="true" />
              <strong>Quote to invoice in one tap</strong>
              <p>No retyping line items when the customer says yes.</p>
            </Reveal>

            <Reveal delay={120} className="site-glass site-bento-panel">
              <CurrencyDollar size={28} weight="duotone" aria-hidden="true" />
              <strong>No cut of the job</strong>
              <p>Card payments go through your own account. We take none of the work.</p>
            </Reveal>

            <Reveal delay={160} className="site-glass site-bento-photo site-bento-crew">
              <img
                src="/images/feature-crew.jpg"
                alt="Small construction crew on a job site"
                width={1400}
                height={900}
                loading="lazy"
              />
              <div className="site-glass-caption">
                <div>
                  <strong>Crew pricing stays flat</strong>
                  <p>Add people on the truck without a per-seat climb.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="site-section" id="pricing" aria-labelledby="pricing-heading">
          <Reveal className="site-pricing-intro">
            <h2 id="pricing-heading">Two prices. No cut of the job.</h2>
            <p className="site-lead">
              Both plans send quotes, invoices, and card payments through your own account.
            </p>
          </Reveal>

          <div className="site-price-grid">
            <Reveal className="site-glass site-price">
              <h3>Solo</h3>
              <p className="site-price-amount">
                <span className="money">$19</span>
                <span>a month</span>
              </p>
              <p className="site-muted">$180 a year. Same tools, as many quotes as the work needs.</p>
              <Link className="site-btn site-btn-ghost site-btn-block" to="/start?plan=solo">
                Choose Solo
              </Link>
            </Reveal>
            <Reveal delay={90} className="site-glass site-price site-price-featured">
              <h3>Crew</h3>
              <p className="site-price-amount">
                <span className="money">$29</span>
                <span>a month</span>
              </p>
              <p className="site-muted">
                $290 a year. Add the people on the truck. Price does not climb per person.
              </p>
              <Link className="site-btn site-btn-primary site-btn-block" to="/start?plan=crew">
                Choose Crew
                <ArrowRight weight="bold" size={16} aria-hidden="true" />
              </Link>
            </Reveal>
          </div>
        </section>

        <section className="site-close" aria-labelledby="close-heading">
          <div className="site-close-media" aria-hidden="true">
            <img src="/images/feature-crew.jpg" alt="" width={1400} height={900} loading="lazy" />
            <div className="site-close-scrim" />
          </div>
          <Reveal className="site-glass site-close-panel">
            <h2 id="close-heading">Ready for the next driveway quote?</h2>
            <p className="site-lead">Open a crew account and send your first link today.</p>
            <Link className="site-btn site-btn-primary site-btn-lg" to="/start">
              Start a crew
              <ArrowRight weight="bold" size={18} aria-hidden="true" />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-glass site-footer-glass">
          <div>
            <p className="site-footer-brand" translate="no">
              QuoteLite
            </p>
            <p className="site-muted">Quotes and invoices for a small trade crew.</p>
          </div>
          <div className="site-footer-links">
            <Link to="/login">Log in</Link>
            <Link to="/start">Start a crew</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
