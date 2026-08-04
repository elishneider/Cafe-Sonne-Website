import { SiteHeader } from "@/components/SiteHeader";
import { WaitlistForm } from "@/components/WaitlistForm";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Sunny outdoor seating, mapped in real time</p>
              <h1>
                Find the London cafés catching the sun <em>right now.</em>
              </h1>
              <p className="hero-sub">
                Café Sonne tracks the sun&apos;s position through the day and matches it against
                outdoor seating layouts, so you always know which nearby cafés have a table
                that&apos;s actually in the sun — not just outside.
              </p>
              <WaitlistForm defaultNote="Free to join. We'll email you when Café Sonne launches in London." />
              <div className="hero-trust">
                <span>☕ Real cafés</span>
                <span>☀️ Live sun tracking</span>
                <span>📍 Sorted by distance</span>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="phone-mock">
                <div className="phone-notch"></div>
                <div className="phone-screen">
                  <div className="phone-topbar">
                    <span className="phone-time">Now near you</span>
                    <span className="sun-chip">
                      <span className="sun-dot"></span>Sunny · 4:12pm
                    </span>
                  </div>
                  <div className="mini-card mini-card--sun">
                    <div className="mini-card-top">
                      <span className="mini-card-name">Fig &amp; Ash</span>
                      <span className="badge badge-sun">☀️ In the sun</span>
                    </div>
                    <div className="mini-card-meta">3 min walk · Outdoor tables free</div>
                    <div className="sun-bar">
                      <span style={{ width: "88%" }}></span>
                    </div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-card-top">
                      <span className="mini-card-name">The Roasted Leaf</span>
                      <span className="badge badge-sun">☀️ In the sun</span>
                    </div>
                    <div className="mini-card-meta">6 min walk · Terrace seating</div>
                    <div className="sun-bar">
                      <span style={{ width: "64%" }}></span>
                    </div>
                  </div>
                  <div className="mini-card mini-card--shade">
                    <div className="mini-card-top">
                      <span className="mini-card-name">Corner &amp; Vine</span>
                      <span className="badge badge-shade">🌥️ In shade</span>
                    </div>
                    <div className="mini-card-meta">2 min walk · Outdoor tables free</div>
                    <div className="sun-bar">
                      <span style={{ width: "12%" }}></span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="sun-glow"></div>
            </div>
          </div>
        </section>

        <section className="pain">
          <div className="container">
            <h2>Sound familiar?</h2>
            <div className="pain-grid">
              <div className="pain-card">
                <div className="pain-icon">🧭</div>
                <h3>You walk past three cafés</h3>
                <p>...before finding one with an outdoor table that isn&apos;t sitting in a building&apos;s shadow.</p>
              </div>
              <div className="pain-card">
                <div className="pain-icon">🕑</div>
                <h3>The sun keeps moving</h3>
                <p>That sunny terrace at 12pm is fully shaded by 3pm. Maps don&apos;t know that. We do.</p>
              </div>
              <div className="pain-card">
                <div className="pain-icon">📵</div>
                <h3>Google Maps won&apos;t tell you</h3>
                <p>&quot;Outdoor seating: yes&quot; doesn&apos;t mean sunny. It just means there are chairs outside.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="how" id="how-it-works">
          <div className="container">
            <p className="eyebrow center">How it works</p>
            <h2 className="center">Three steps to your next sunny coffee</h2>
            <div className="steps">
              <div className="step">
                <div className="step-num">01</div>
                <h3>Share your location</h3>
                <p>We look at London cafés within walking distance of wherever you are.</p>
              </div>
              <div className="step">
                <div className="step-num">02</div>
                <h3>We check the sun, live</h3>
                <p>
                  Using the sun&apos;s real-time position and each café&apos;s outdoor layout, we
                  work out which tables are actually lit.
                </p>
              </div>
              <div className="step">
                <div className="step-num">03</div>
                <h3>See what&apos;s sunny, nearby</h3>
                <p>
                  Get a ranked list of cafés with sunny outdoor seating right now — updated as the
                  sun moves.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="preview" id="preview">
          <div className="container">
            <p className="eyebrow center">Right now, near Shoreditch</p>
            <h2 className="center">A preview of what you&apos;ll see</h2>
            <p className="section-sub center">
              Sample data — this is what Café Sonne will show once we launch.
            </p>

            <div className="card-grid">
              <article className="cafe-card">
                <div className="cafe-card-photo photo-1"></div>
                <div className="cafe-card-body">
                  <div className="cafe-card-head">
                    <h3>Fig &amp; Ash</h3>
                    <span className="badge badge-sun">☀️ In the sun</span>
                  </div>
                  <p className="cafe-card-meta">0.2 mi · Outdoor tables free · Closes 6pm</p>
                  <div className="sun-bar">
                    <span style={{ width: "88%" }}></span>
                  </div>
                  <p className="sun-label">Sunny for ~2h 40m more</p>
                </div>
              </article>

              <article className="cafe-card">
                <div className="cafe-card-photo photo-2"></div>
                <div className="cafe-card-body">
                  <div className="cafe-card-head">
                    <h3>The Roasted Leaf</h3>
                    <span className="badge badge-sun">☀️ In the sun</span>
                  </div>
                  <p className="cafe-card-meta">0.4 mi · Terrace seating · Closes 5:30pm</p>
                  <div className="sun-bar">
                    <span style={{ width: "64%" }}></span>
                  </div>
                  <p className="sun-label">Sunny for ~1h 15m more</p>
                </div>
              </article>

              <article className="cafe-card">
                <div className="cafe-card-photo photo-3"></div>
                <div className="cafe-card-body">
                  <div className="cafe-card-head">
                    <h3>Corner &amp; Vine</h3>
                    <span className="badge badge-shade">🌥️ In shade</span>
                  </div>
                  <p className="cafe-card-meta">0.1 mi · Outdoor tables free · Closes 7pm</p>
                  <div className="sun-bar">
                    <span style={{ width: "12%" }}></span>
                  </div>
                  <p className="sun-label">Back in the sun ~9:30am tomorrow</p>
                </div>
              </article>

              <article className="cafe-card">
                <div className="cafe-card-photo photo-4"></div>
                <div className="cafe-card-body">
                  <div className="cafe-card-head">
                    <h3>Marlowe&apos;s</h3>
                    <span className="badge badge-partial">⛅ Partial sun</span>
                  </div>
                  <p className="cafe-card-meta">0.6 mi · Pavement tables · Closes 6pm</p>
                  <div className="sun-bar">
                    <span style={{ width: "45%" }}></span>
                  </div>
                  <p className="sun-label">Half the terrace is lit</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="container">
            <p className="eyebrow center">FAQ</p>
            <h2 className="center">Good questions</h2>
            <div className="faq-list">
              <details>
                <summary>How do you know if a table is actually in the sun?</summary>
                <p>
                  We combine each café&apos;s outdoor seating layout with real-time sun position
                  and nearby building/tree shadow data for that spot in London, so we can tell
                  whether a table is lit or shaded at any given moment.
                </p>
              </details>
              <details>
                <summary>Is this only for London?</summary>
                <p>We&apos;re starting with London. If there&apos;s demand, other cities are on the roadmap.</p>
              </details>
              <details>
                <summary>Will it cost anything?</summary>
                <p>Café Sonne will be free to use when it launches. Joining the waitlist is free too.</p>
              </details>
              <details>
                <summary>When does it launch?</summary>
                <p>We&apos;re building it right now. Join the waitlist and we&apos;ll email you the moment it&apos;s ready.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="cta" id="waitlist">
          <div className="container cta-inner">
            <p className="eyebrow center">Be first to know</p>
            <h2 className="center">Never sit in the shade again.</h2>
            <p className="section-sub center">
              Join the waitlist and we&apos;ll let you know the moment Café Sonne launches in
              London.
            </p>
            <WaitlistForm variant="cta" defaultNote="No spam. Just one email when we launch." />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="logo">
            <span className="logo-mark">☀️</span>
            <span>Café Sonne</span>
          </div>
          <p>&copy; 2026 Café Sonne. Made for coffee-lovers who chase the light, in London.</p>
        </div>
      </footer>
    </>
  );
}
