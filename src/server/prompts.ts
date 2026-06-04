import { registerPrompt } from "./server.js";

// Shared conventions the model needs to drive the tools correctly. Kept in sync
// with SKILL.md and the README tool catalog.
export const HUCKLEBERRY_GUIDE = `You are logging and reading baby-tracking data via the Huckleberry MCP tools.

Conventions:
- CHILD: most tools need 'child_uid'. Call get_user first to get the child list and
  lastChild; reuse that uid. If the account has one child, use it automatically.
- TIME: every 'start'/'end' is a Unix epoch in SECONDS, interpreted in the server's
  configured timezone (HUCKLEBERRY_TIMEZONE). Convert the user's natural-language
  times ("a 40-min nap that ended 20 minutes ago") to epoch seconds.
- UNITS / ENUMS:
  - bottle & pump: units = "ml" | "oz"; bottle_type is free text ("Breast Milk", "Formula", "Cow Milk")
  - growth: units = "metric" | "imperial" (weight/height/head)
  - diaper: mode = pee | poo | both | dry; pee_amount/poo_amount = little | medium | big
  - nursing: left_duration / right_duration are in SECONDS
- NO LIVE TIMERS: log completed events (log_sleep takes start AND end; log_nursing,
  log_bottle, log_pump, log_solids, log_diaper, log_potty, log_growth).
- READS answer questions: get_sleep_history, get_feed_history, get_diaper_history,
  list_pump_intervals, get_latest_growth, get_growth_history.
- CONFIRM BEFORE WRITING: echo back the child, time, and values you're about to log,
  then call the tool. Writes go to the user's real Huckleberry account.`;

// Loads the conventions above into context so the model logs/reads reliably.
registerPrompt({
  name: "huckleberry_usage",
  description: "How to use the Huckleberry tools correctly (child resolution, time, units).",
  arguments: [],
  build: () => HUCKLEBERRY_GUIDE,
});

// Summarise a day from the history tools.
registerPrompt({
  name: "daily_summary",
  description: "Summarise a child's sleep, feeds, and diapers for a given day.",
  arguments: [
    {
      name: "date",
      description: 'Day to summarise, e.g. "today" or "2026-06-01".',
      required: false,
    },
  ],
  build: (args) => {
    const date = args.date?.trim() || "today";
    return `${HUCKLEBERRY_GUIDE}

Task: Summarise ${date} for the child. Resolve the child with get_user, then use
get_sleep_history, get_feed_history, and get_diaper_history (filter to ${date} in
the configured timezone). Report total sleep, number/breakdown of feeds
(nursing/bottle/solids), and diaper counts (pee/poo). Be concise.`;
  },
});

// Guide logging a described event end-to-end.
registerPrompt({
  name: "log_event",
  description: "Log a described baby event (sleep/feed/diaper/pump/growth) to Huckleberry.",
  arguments: [{ name: "event", description: "What happened, in plain language.", required: true }],
  build: (args) => {
    const event = args.event?.trim() || "(describe the event)";
    return `${HUCKLEBERRY_GUIDE}

Task: Log this event — "${event}". Pick the right tool, resolve the child, convert
any times to epoch seconds, choose sensible units, then CONFIRM the details back to
me before calling the tool.`;
  },
});
