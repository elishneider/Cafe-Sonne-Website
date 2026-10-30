# Manual check of Gemini's seating answers (30 cafés, Oct 2026)

Checked by hand in the chat against Google Maps photos.

- Gemini "yes" (20 checked: 10 rarer types, 6 where OSM said no, 4 controls): **20/20 right**, including the seating type (garden, courtyard, terrace, pavement).
- Gemini "no" (6 checked, all where Google or OSM said yes): **5 right, 1 wrong**.
  - Wrong: Costa Coffee, 37 Melcombe St — has pavement seating; Gemini only saw interior photos.
  - Edge case: Compane (Princes Arcade) — seats are outside the shop but in a roofed arcade, so no sun; counts as "no" for our purposes.
- Gemini "unclear" (4 checked): all four turned out to have no outdoor seating; one (Water Cooler Coffee) is not a café at all.

Takeaways: "yes" answers can be trusted; "no" answers based only on interior photos can miss pavement seating; treat "unclear" as "no"; the candidate list contains some non-cafés; covered arcades should count as "no".
