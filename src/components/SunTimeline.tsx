import { formatSegmentTime, type TimelineSegment } from "@/lib/sunTimeline";

const SEGMENT_ICON: Record<string, string> = {
  sun: "☀️",
  partial: "⛅",
  shade: "☁️",
};

const SEGMENT_TOOLTIP_LABEL: Record<string, string> = {
  sun: "Sunny",
  partial: "Partly sunny",
  shade: "Shade",
  closed: "Closed",
};

// "Closed" hours aren't the interesting part of this widget — each closed minute only
// counts for a fraction of its real width, so a café that's closed for 8 hours doesn't
// crowd out the (much more useful) open/sun hours into an unreadable sliver. Real
// timestamps are untouched; this only affects how much horizontal space a segment draws.
const CLOSED_WEIGHT_FACTOR = 0.12;

const MIN_CONTENT_PCT = 6;
// "Closed" is a whole word, not a single glyph like the weather icons — it needs
// noticeably more room before it fits without clipping into its neighbor.
const MIN_CLOSED_TEXT_PCT = 18;
const ROW_HEIGHT_PX = 18;
const TICK_BASE_HEIGHT_PX = 6;
// Space a label's text takes below its tick (margin-top + line height) — used to size
// the labels row to only as many stacked rows as are actually in use, instead of always
// reserving room for the worst case (3 rows), which left a lot of empty space below.
const LABEL_TEXT_BLOCK_PX = 20;

// Conservative estimate of a card's inner content width, used to convert label text
// length into a percentage of the bar so "tomorrow 06:30" (long) gets more breathing
// room than "18:30" (short) instead of a flat gap that only works for the short case.
const ASSUMED_CONTENT_WIDTH_PX = 170;
const CHAR_WIDTH_PX = 6.3;
const LABEL_MARGIN_PX = 10;

function weightOf(segment: TimelineSegment): number {
  const durationMs = segment.end.getTime() - segment.start.getTime();
  return segment.status === "closed" ? durationMs * CLOSED_WEIGHT_FACTOR : durationMs;
}

function estimateHalfWidthPct(text: string) {
  const widthPx = text.length * CHAR_WIDTH_PX + LABEL_MARGIN_PX;
  return (widthPx / 2 / ASSUMED_CONTENT_WIDTH_PX) * 100;
}

type Label = { pct: number; text: string; row: number; isEnd: boolean };

// The first/last labels are anchored to the bar's edges (so they can't spill past the
// card), which means their visual centre sits half their width in from that edge.
function layoutLabels(points: { pct: number; text: string; isEnd?: boolean }[]): Label[] {
  const lastPctByRow = [-Infinity, -Infinity, -Infinity];
  const lastHalfWidthByRow = [0, 0, 0];
  return points.map(({ pct, text, isEnd = false }) => {
    const halfWidth = estimateHalfWidthPct(text);
    const centre = isEnd ? pct - halfWidth : pct === 0 ? halfWidth : pct;
    const row = lastPctByRow.findIndex(
      (lastPct, r) => centre - lastPct >= lastHalfWidthByRow[r] + halfWidth,
    );
    const chosenRow = row === -1 ? 0 : row;
    lastPctByRow[chosenRow] = centre;
    lastHalfWidthByRow[chosenRow] = halfWidth;
    return { pct, text, row: chosenRow, isEnd };
  });
}

// "Today" runs to the very end of the day, which would read as an odd "23:59".
function formatEndLabel(end: Date, from: Date) {
  if (end.getHours() === 23 && end.getMinutes() === 59) return "00:00";
  return formatSegmentTime(end, from);
}

export function SunTimeline({
  segments,
  startLabel = "Now",
  endLabel,
}: {
  segments: TimelineSegment[];
  startLabel?: string;
  // Defaults to the end time; pass text (e.g. "Close") to override, or null to hide it.
  endLabel?: string | null;
}) {
  if (segments.length === 0) return null;

  const from = segments[0].start;
  const weights = segments.map(weightOf);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return null;

  const cumulative: number[] = [];
  let runningTotal = 0;
  for (const w of weights) {
    runningTotal += w;
    cumulative.push(runningTotal);
  }

  const labels = layoutLabels([
    { pct: 0, text: startLabel },
    ...segments.slice(0, -1).map((segment, i) => ({
      pct: (cumulative[i] / totalWeight) * 100,
      text: formatSegmentTime(segment.end, from),
    })),
    ...(endLabel === null
      ? []
      : [
          {
            pct: 100,
            text: endLabel ?? formatEndLabel(segments[segments.length - 1].end, from),
            isEnd: true,
          },
        ]),
  ]);
  const maxLabelRow = Math.max(0, ...labels.map((label) => label.row));

  return (
    <div className="sun-timeline">
      <div className="sun-timeline-track">
        {segments.map((segment, i) => {
          const pct = (weights[i] / totalWeight) * 100;
          return (
            <div
              key={i}
              className={`sun-timeline-segment sun-timeline-segment--${segment.status}`}
              // Fixed percentage basis, no grow/shrink — must render at exactly `pct`, the
              // same number the tick/label below is positioned at, or the two drift apart
              // (flex-grow alone lets a segment's own icon/text nudge its width off-ratio).
              style={{ flexBasis: `${pct}%`, flexGrow: 0, flexShrink: 0 }}
              title={`${SEGMENT_TOOLTIP_LABEL[segment.status]}, ${formatSegmentTime(segment.start, from)}–${formatSegmentTime(segment.end, from)}`}
            >
              {segment.status === "closed"
                ? pct >= MIN_CLOSED_TEXT_PCT && <span className="sun-timeline-text">Closed</span>
                : pct >= MIN_CONTENT_PCT && (
                    <span className="sun-timeline-icon">{SEGMENT_ICON[segment.status]}</span>
                  )}
            </div>
          );
        })}
      </div>
      <div
        className="sun-timeline-labels"
        style={{ height: TICK_BASE_HEIGHT_PX + maxLabelRow * ROW_HEIGHT_PX + LABEL_TEXT_BLOCK_PX }}
      >
        {labels.map((label, i) => (
          <div
            key={i}
            className={`sun-timeline-tick-group${label.pct === 0 ? " sun-timeline-tick-group--now" : ""}${label.isEnd ? " sun-timeline-tick-group--end" : ""}`}
            style={label.isEnd ? { right: 0 } : { left: `${label.pct}%` }}
          >
            <span
              className="sun-timeline-tick"
              style={{ height: TICK_BASE_HEIGHT_PX + label.row * ROW_HEIGHT_PX }}
            />
            <span className="sun-timeline-label">{label.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
