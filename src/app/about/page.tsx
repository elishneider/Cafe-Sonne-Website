import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "About — Sonnen Café London" };

export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="container app-main about-page">
        <p className="eyebrow">About</p>
        <h2>Chasing the sun, one café at a time</h2>
        <p className="about-lead">
          Sonnen Café London shows you which London cafés have outdoor seating that&apos;s actually in the sun
          &mdash; right now, later today or tomorrow.
        </p>

        <h3>Cafés with outdoor seating</h3>
        <p>
          We don&apos;t list every café &mdash; only ones with outdoor seating. For each one we look at what
          kind of seating it is, because that decides how much sun it can get:
        </p>
        <ul>
          <li>
            <strong>Pavement seating</strong> &mdash; tables right outside the front, on the pavement or on the
            café&apos;s own space in front of the shop.
          </li>
          <li>
            <strong>Terrace</strong> &mdash; a raised or clearly defined outdoor area.
          </li>
          <li>
            <strong>Courtyard</strong> &mdash; a space enclosed by surrounding buildings.
          </li>
          <li>
            <strong>Garden</strong> &mdash; a planted outdoor area.
          </li>
        </ul>

        <h3>How we work out the sun</h3>
        <p>For every café we combine three things:</p>
        <ul>
          <li>
            <strong>The sun&apos;s position.</strong> We calculate exactly where the sun is in the sky &mdash;
            its direction and how high it is &mdash; for any time of day.
          </li>
          <li>
            <strong>The café&apos;s surroundings.</strong> Which way its seating faces and how much of the sky
            nearby buildings block. A courtyard needs the sun to be high enough to clear the rooftops around
            it.
          </li>
          <li>
            <strong>The weather forecast.</strong> Hour-by-hour cloud cover and rain, so a sunny spot under a
            grey sky isn&apos;t reported as sunny.
          </li>
        </ul>
        <p>
          Putting these together, we draw a timeline for each café showing how its seating changes through
          today and tomorrow.
        </p>

        <h3>What the labels mean</h3>
        <ul>
          <li>
            <strong>In the sun</strong> &mdash; direct sun reaches the seating and the sky is mostly clear.
          </li>
          <li>
            <strong>Partly sunny</strong> &mdash; the sun reaches the seating, but cloud makes it come and go.
          </li>
          <li>
            <strong>In shade</strong> &mdash; buildings block the sun, or it&apos;s too cloudy or rainy.
          </li>
        </ul>

        <h3>A work in progress</h3>
        <p>
          These are estimates, not guarantees &mdash; real life has trees, awnings and passing clouds we can&apos;t
          see. We&apos;re starting with a small group of cafés and checking each one carefully before we add
          more.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
