"use client";

import { useEffect, useRef, useState } from "react";
import type { CafeSunSummary } from "@/lib/cafeSunSummary";
import { SUN_STATUS_BADGE_CLASS, SUN_STATUS_LABEL } from "@/lib/sunStatusPresentation";
import { formatHours } from "@/lib/cafeHours";
import { getGoogleMapsUrl } from "@/lib/mapsLink";
import { SEATING_TYPE_LABEL } from "@/lib/seatingTypePresentation";
import { SunTimeline } from "@/components/SunTimeline";

export function CafeCard({ summary }: { summary: CafeSunSummary }) {
  const { cafe, status, todayTimeline, tomorrowTimeline, todayHours, tomorrowHours } = summary;
  const [photoCount, setPhotoCount] = useState(1);
  const [activePhoto, setActivePhoto] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const todayPaneRef = useRef<HTMLDivElement>(null);
  const tomorrowPaneRef = useRef<HTMLDivElement>(null);
  // The carousel is only as tall as the pane being shown, so a busy Tomorrow bar (many
  // stacked time labels) doesn't leave empty space under a simpler Today bar.
  const [carouselHeight, setCarouselHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const pane = (showTomorrow ? tomorrowPaneRef : todayPaneRef).current;
    if (!pane) return;
    const observer = new ResizeObserver(() => setCarouselHeight(pane.offsetHeight));
    observer.observe(pane);
    return () => observer.disconnect();
  }, [showTomorrow]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cafe-photos/${cafe.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count: number } | null) => {
        if (!cancelled && data) setPhotoCount(Math.max(1, data.count));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cafe.id]);

  function showPrevPhoto(e: React.MouseEvent) {
    e.preventDefault();
    setPhotoFailed(false);
    setActivePhoto((i) => (i - 1 + photoCount) % photoCount);
  }

  function showNextPhoto(e: React.MouseEvent) {
    e.preventDefault();
    setPhotoFailed(false);
    setActivePhoto((i) => (i + 1) % photoCount);
  }

  return (
    <article className="cafe-card">
      <div className="cafe-card-photo-carousel">
        {photoFailed ? (
          <div className={`cafe-card-photo cafe-card-photo--${status}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/cafe-photo/${cafe.id}/${activePhoto}`}
            alt={cafe.name}
            className="cafe-card-photo"
            onError={() => setPhotoFailed(true)}
          />
        )}
        {photoCount > 1 && !photoFailed && (
          <>
            <button
              type="button"
              className="cafe-photo-nav cafe-photo-nav--prev"
              onClick={showPrevPhoto}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="cafe-photo-nav cafe-photo-nav--next"
              onClick={showNextPhoto}
              aria-label="Next photo"
            >
              ›
            </button>
            <div className="cafe-photo-dots">
              {Array.from({ length: photoCount }).map((_, i) => (
                <span
                  key={i}
                  className={`cafe-photo-dot${i === activePhoto ? " cafe-photo-dot--active" : ""}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="cafe-card-body">
        <div className="cafe-card-info">
          <div className="cafe-card-head">
            <h3>{cafe.name}</h3>
            <span className={`badge ${SUN_STATUS_BADGE_CLASS[status]}`}>{SUN_STATUS_LABEL[status]}</span>
          </div>
          <p className="cafe-card-meta">{SEATING_TYPE_LABEL[cafe.seatingType]}</p>
          <p className="cafe-card-meta">
            <a
              href={getGoogleMapsUrl(cafe)}
              target="_blank"
              rel="noopener noreferrer"
              className="cafe-card-address"
              title="Open in Google Maps"
            >
              {cafe.addressLine}
            </a>{" "}
            · {formatHours(todayHours)}
          </p>
        </div>

        <div className="sun-timeline-carousel" style={{ height: carouselHeight }}>
          <div
            className="sun-timeline-carousel-track"
            style={{ transform: showTomorrow ? "translateX(-50%)" : "translateX(0%)" }}
          >
            <div ref={todayPaneRef} className="sun-timeline-pane" aria-hidden={showTomorrow}>
              <p className="sun-timeline-day-label">Today</p>
              <div className="sun-timeline-row">
                <SunTimeline segments={todayTimeline} />
                <button
                  type="button"
                  className="sun-timeline-nav sun-timeline-nav--next"
                  onClick={() => setShowTomorrow(true)}
                  aria-label="Show tomorrow"
                  title="Show tomorrow"
                  tabIndex={showTomorrow ? -1 : 0}
                >
                  ›
                </button>
              </div>
            </div>
            <div ref={tomorrowPaneRef} className="sun-timeline-pane" aria-hidden={!showTomorrow}>
              <p className="sun-timeline-day-label">Tomorrow</p>
              <div className="sun-timeline-row">
                <button
                  type="button"
                  className="sun-timeline-nav sun-timeline-nav--prev"
                  onClick={() => setShowTomorrow(false)}
                  aria-label="Show today"
                  title="Show today"
                  tabIndex={showTomorrow ? 0 : -1}
                >
                  ‹
                </button>
                <SunTimeline
                  segments={tomorrowTimeline}
                  startLabel={tomorrowHours ? "Open" : "Closed all day"}
                  endLabel={tomorrowHours ? "Close" : null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
