import type { Metadata } from "next";
import { Jost, Josefin_Sans, Lexend, Outfit, Syne } from "next/font/google";
import "./globals.css";

// Jost for page headings, Lexend for café names; Josefin Sans is kept for the logo's
// light "SONNEN".
const headingFont = Jost({ subsets: ["latin"], variable: "--font-heading", weight: ["400", "500"] });
const subheadingFont = Lexend({ subsets: ["latin"], variable: "--font-subheading", weight: ["400", "500"] });
const logoLightFont = Josefin_Sans({ subsets: ["latin"], variable: "--font-logo-light", weight: ["300"] });
const bodyFont = Outfit({ subsets: ["latin"], variable: "--font-body" });
const logoFont = Syne({ subsets: ["latin"], variable: "--font-logo" });

export const metadata: Metadata = {
  title: "Sonnen Café London — Find sunny outdoor seating in London",
  description:
    "Sonnen Café London shows you which London cafés have outdoor seating that's actually in the sun, right now.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☀️</text></svg>",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable} ${logoFont.variable} ${logoLightFont.variable} ${subheadingFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
