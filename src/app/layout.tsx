import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Café Sonne — Find sunny outdoor seating in London",
  description:
    "Café Sonne shows you which London cafés have outdoor seating that's actually in the sun, right now.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☀️</text></svg>",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
