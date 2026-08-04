"use client";

import Link from "next/link";
import { useState } from "react";

export function SiteHeader() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#" className="logo">
          <span className="logo-mark">☀️</span>
          <span>Café Sonne</span>
        </a>
        <nav className={`nav-links ${navOpen ? "open" : ""}`}>
          <a href="#how-it-works" onClick={() => setNavOpen(false)}>
            How it works
          </a>
          <a href="#preview" onClick={() => setNavOpen(false)}>
            Cafés
          </a>
          <a href="#faq" onClick={() => setNavOpen(false)}>
            FAQ
          </a>
          <Link href="/dashboard" onClick={() => setNavOpen(false)}>
            Dashboard
          </Link>
        </nav>
        <a href="#waitlist" className="btn btn-primary btn-small">
          Get early access
        </a>
        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
