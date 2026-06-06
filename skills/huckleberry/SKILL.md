---
name: huckleberry
description: >-
  Log and read baby-tracking data (sleep, feeds, nursing, bottle, pump, solids,
  diapers, potty, growth) through the Huckleberry MCP server. Use whenever the
  user wants to record a baby event or ask about their baby's history/patterns.
---

# Huckleberry baby tracking

This skill drives the **Huckleberry MCP** tools. Follow these rules so tool calls
are correct on the first try.

## 1. Resolve the child first

Most tools need a `child_uid`. At the start of a session (or if unknown), call
**`get_user`** — it returns the child list and `lastChild`. Reuse that uid for
subsequent calls. If the account has exactly one child, use it without asking.
Only ask the user which child if there are several and it's ambiguous.

## 2. Times are epoch seconds, in the configured timezone

Every `start`/`end` argument is a **Unix timestamp in seconds** (not ms, not a
date string). The server applies the timezone from `HUCKLEBERRY_TIMEZONE`.

Convert the user's natural language to epoch seconds:

- "just now" / no time given → now
- "a 40-minute nap that ended 20 minutes ago" → end = now − 20min, start = end − 40min
- "at 2pm" → 2pm **today** in the user's timezone

## 3. Units & enums

| Tool                     | Field                              | Allowed                                                |
| ------------------------ | ---------------------------------- | ------------------------------------------------------ |
| `log_bottle`, `log_pump` | `units`                            | `ml` or `oz`                                           |
| `log_bottle`             | `bottle_type`                      | free text: "Breast Milk", "Formula", "Cow Milk"        |
| `log_growth`             | `units`                            | `metric` or `imperial`                                 |
| `log_diaper`             | `mode`                             | `pee` / `poo` / `both` / `dry`                         |
| `log_diaper`             | `pee_amount` / `poo_amount`        | `little` / `medium` / `big`                            |
| `log_potty`              | `mode`                             | `pee` / `poo`                                          |
| `log_nursing`            | `left_duration` / `right_duration` | seconds                                                |
| `log_pump`               | amounts                            | give `total_amount`, or `left_amount` + `right_amount` |

## 4. There are no live timers

You log **completed** events. `log_sleep` takes both `start` and `end`. There is
no start/pause/resume — if the user says "baby just went down", either wait until
they wake to log it, or ask for the expected end / log it when known.

## 5. Reads answer questions

Use the history tools for "how did baby sleep?", "how many feeds today?", etc.:
`get_sleep_history`, `get_feed_history`, `get_diaper_history`,
`list_pump_intervals`, `get_latest_growth`, `get_growth_history`. Each takes
`child_uid` and an optional `limit`, newest first.

## 6. Notes, and editing past entries

Every `log_*` tool takes an optional `notes` string (free text) — use it for any
qualitative detail the user mentions ("spit up after the bottle", "woke up
crying", "first solid food"). The note is saved on the entry and comes back in
the matching history/`get_*` read.

To **change** an existing entry, every tracker now has an `edit_*` tool:
`edit_sleep`, `edit_feed` (nursing/bottle/solids), `edit_pump`, `edit_diaper`
(diaper + potty), `edit_growth`. The flow is always: read first to get the
entry's `id` (every history/`get_*` result includes it), then call the `edit_*`
tool with that id (`interval_id` for sleep/feed/pump/diaper, `entry_id` for
growth) and only the fields you want to change. Editing never requires re-logging.

## 7. Confirm before writing

Writes go to the user's **real** Huckleberry account. Before any `log_*` call,
echo back the child, the resolved time, and the values, then make the call.

## Examples

- "Log a 30-min nap that ended at 3pm" → `log_sleep` with start = 14:30, end = 15:00 (epoch s).
- "120ml formula bottle just now" → `log_bottle` { amount: 120, units: "ml", bottle_type: "Formula", start: now }.
- "Poo diaper, medium, yellow" → `log_diaper` { mode: "poo", poo_amount: "medium", color: "yellow", start: now }.
- "Weighed 3.4 kg today" → `log_growth` { weight: 3.4, units: "metric", start: now }.
- "How much did she sleep yesterday?" → `get_sleep_history`, filter to yesterday, sum durations.

The server also exposes MCP **prompts** for the same flows: `huckleberry_usage`,
`daily_summary`, and `log_event`.
