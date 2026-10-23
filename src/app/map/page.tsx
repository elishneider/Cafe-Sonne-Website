import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { MapPage } from "@/components/MapPage";

export const metadata: Metadata = { title: "Map — Sonnen Café London" };

export default function Map() {
  return (
    <>
      <SiteHeader />
      <MapPage />
    </>
  );
}
