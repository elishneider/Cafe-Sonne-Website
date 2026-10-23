import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AppHome } from "@/components/AppHome";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <AppHome />
      <SiteFooter />
    </>
  );
}
