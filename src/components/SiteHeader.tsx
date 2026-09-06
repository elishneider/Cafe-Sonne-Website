import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">☀️</span>
          <span>Café Sonne</span>
        </Link>
      </div>
    </header>
  );
}
