"use client";

import { useState } from "react";
import type { CafeSunSummary } from "@/lib/cafeSunSummary";
import { SUN_STATUS_BADGE_CLASS, SUN_STATUS_LABEL } from "@/lib/sunStatusPresentation";
import { SunTimeline } from "@/components/SunTimeline";

export function CafeCard({ summary }: { summary: CafeSunSummary }) {
  const { cafe, status, todayTimeline, tomorrowTimeline } = summary;
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);

  return (
    <article className="cafe-card">
      {photoFailed ? (
        <div className={`cafe-card-photo cafe-card-photo--${status}`} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/cafe-photo/${cafe.id}`}
          alt={cafe.name}
          className="cafe-card-photo"
          onError={() => setPhotoFailed(true)}
        />
      )}
      <div className="cafe-card-body">
        <div className="cafe-card-head">
          <h3>{cafe.name}</h3>
          <span className={`badge ${SUN_STATUS_BADGE_CLASS[status]}`}>{SUN_STATUS_LABEL[status]}</span>
        </div>
        <p className="cafe-card-meta">
          {cafe.seatingNotes} · Open {cafe.opens}–{cafe.closes}
        </p>
        <div className="sun-timeline-row">
          {showTomorrow ? (
            <SunTimeline segments={tomorrowTimeline} startLabel="Open" />
          ) : (
            <SunTimeline segments={todayTimeline} />
          )}
          <button
            type="button"
            className="sun-timeline-nav"
            onClick={() => setShowTomorrow((v) => !v)}
            aria-label={showTomorrow ? "Show today" : "Show tomorrow"}
            title={showTomorrow ? "Show today" : "Show tomorrow"}
          >
            <span className="sun-timeline-nav-arrow">{showTomorrow ? "‹" : "›"}</span>
            <span className="sun-timeline-nav-label">{showTomorrow ? "Today" : "Tomorrow"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
