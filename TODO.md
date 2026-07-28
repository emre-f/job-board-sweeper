# TODO / ideas

## Repost & "fake job" detection (higher risk - deliberately not in v0.1)

The idea: flag jobs that look perpetually open / reposted rather than real openings.

Possible signals, roughly in order of reliability:

- **Repost tracking**: track a fuzzy key (`company + normalized title + location`)
  and count how many distinct job ids appeared under it within a window (needs
  per-job seen tracking, which was removed in 0.4 - would have to come back for
  this). Company+title reappearing with fresh ids N times in M weeks →
  "likely repost" badge.
- **Posted-date vs. first-seen**: if a site says "Posted 2 days ago" but we first
  saw the identical listing 6 weeks ago, it's a repost. Needs per-site posted-date
  extraction in the adapters.
- **Ghost-job heuristics**: same company posting the identical title in 20+ cities,
  "always hiring" staffing patterns, etc.

Risk: false positives hide real jobs - so this should launch as a **badge only**
("⚠ reposted 4× in 30 days"), never a default-hide, with a per-rule toggle.

## Other ideas

- More sites: Glassdoor, ZipRecruiter, Google Jobs, Wellfound, Dice.
- Per-site enable/disable toggles.
- Title-based filters (e.g. block "commission only", "unpaid").
- Show a collapsed "N jobs hidden - show" bar inline in the list instead of the
  toolbar-badge-only approach.
- Community blocklists: import a list from a URL (would add a network permission -
  keep opt-in).
- Options page: search/filter within the blocklist textarea once lists get big.
- Publish to the Chrome Web Store; add screenshots to the README.
