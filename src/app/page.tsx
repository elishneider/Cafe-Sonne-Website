import { SiteHeader } from "@/components/SiteHeader";
import { AppHome } from "@/components/AppHome";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <AppHome />

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
