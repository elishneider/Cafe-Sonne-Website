"use client";

import { useEffect, useRef, useState } from "react";
import type { SunStatus } from "@/lib/sunStatus";
import { SUN_STATUS_ICON } from "@/lib/sunStatusPresentation";
import {
  NOW,
  describeWhen,
  formatHour,
  getHourOptions,
  type MapDay,
  type MapWhen,
} from "@/lib/mapWhen";

const CONDITIONS: { status: SunStatus; label: string }[] = [
  { status: "sun", label: "Sunny" },
  { status: "partial", label: "Partly sunny" },
  { status: "shade", label: "Shade" },
];

export function MapFilterMenu({
  when,
  onWhenChange,
  conditions,
  onToggleCondition,
  onReset,
}: {
  when: MapWhen;
  onWhenChange: (when: MapWhen) => void;
  conditions: SunStatus[];
  onToggleCondition: (status: SunStatus) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hours = getHourOptions(when.day, new Date());
  const whenLabel = describeWhen(when);
  const activeCount = conditions.length + (whenLabel ? 1 : 0);
  const noTimeValue = when.day === "today" ? "now" : "any";

  function changeDay(day: MapDay) {
    if (day === when.day) return;
    onWhenChange(day === "today" ? NOW : { day, hour: null });
  }

  return (
    <div className="map-filter-menu" ref={rootRef}>
      <div className="map-filter-bar">
        <button
          type="button"
          className="map-filter-trigger"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((value) => !value)}
        >
          Filters
          {activeCount > 0 && <span className="map-filter-count">{activeCount}</span>}
          {whenLabel && <span className="map-filter-when">{whenLabel}</span>}
          <span className="map-filter-caret" aria-hidden="true">▾</span>
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            className="map-filter-clear"
            onClick={onReset}
            aria-label="Clear filters"
            title="Clear filters"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="map-filter-panel" role="dialog" aria-label="Filters">
          <div className="map-filter-section">
            <p className="map-filter-heading">When</p>
            {(["today", "tomorrow"] as const).map((day) => (
              <label key={day} className="map-filter-option">
                <input
                  type="radio"
                  name="map-filter-day"
                  checked={when.day === day}
                  onChange={() => changeDay(day)}
                />
                <span className="map-filter-mark map-filter-mark--radio" aria-hidden="true" />
                {day === "today" ? "Today" : "Tomorrow"}
              </label>
            ))}
            <select
              className="map-filter-select"
              aria-label="Time"
              value={when.hour === null ? noTimeValue : String(when.hour)}
              onChange={(e) =>
                onWhenChange({ day: when.day, hour: e.target.value === noTimeValue ? null : Number(e.target.value) })
              }
            >
              <option value={noTimeValue}>{when.day === "today" ? "Now" : "Any time"}</option>
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </div>

          <div className="map-filter-section">
            <p className="map-filter-heading">Conditions</p>
            {CONDITIONS.map(({ status, label }) => (
              <label key={status} className="map-filter-option">
                <input
                  type="checkbox"
                  checked={conditions.includes(status)}
                  onChange={() => onToggleCondition(status)}
                />
                <span className="map-filter-mark map-filter-mark--check" aria-hidden="true" />
                <span aria-hidden="true">{SUN_STATUS_ICON[status]}</span> {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
