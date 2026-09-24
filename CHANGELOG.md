# Changelog

## 0.5.0 - 2026-09-25

### New

- **Timeout bucket** - hide a company for a number of days, for example after
  you apply there, so you don't apply to its reposts again (many companies
  limit how often you can apply - 90 days is common).
  - Add a company from the **Label company** dialog on any job card
    (hover button, right-click menu, or "Pick a job" in the popup), from the
    popup's add box (pick "Timeout" in the category list), or from the options
    page.
  - Default length is **90 days**. You can type any number of days each time,
    and change the default on the options page (suggestions: 30 / 60 / 90 /
    180 / 365).
  - On the options page you can **change the days left** for each company, or
    **remove** it from the bucket. The popup also lists the bucket.
  - When a timeout ends, the company leaves the bucket by itself and its jobs
    show again.
  - Timed-out jobs are hidden or dimmed like blocked companies (the dim badge
    shows the days left). Works on **LinkedIn, Indeed and Jobright**.
  - The bucket syncs through your Chrome profile, like your categories, and is
    included in export/import.
- The popup status line and the toolbar badge now count all filtered jobs
  (blocked + timeout), with a breakdown in the popup.
- The popup now tells you to refresh a job-site tab that was open before the
  extension was installed or updated (the filter can't run there until you
  do).

### Upgrading

- **Fully backwards compatible - nothing to do.** Your categories, blocked
  companies and settings are kept as they are. The update only adds new
  storage (`jpfTimeouts`) and one new setting (`timeoutDays`), which starts at
  its default.
- Settings files exported from older versions still import normally.
- After pulling: click ↻ on the extension card in `chrome://extensions`, then
  refresh your job-site tabs.

## 0.4.0 - 2026-07-28

- Removed the seen-job / duplicate detection feature. The extension now only
  does category-based company blocking. Old seen-job history is cleared on
  update.
- 2026-08-11: support for LinkedIn's new 2026 job search UI.

## 0.3.0 - 2026-07-28

- Initial public release: category-based blocklist, label dialog, reveal
  mode, badge counter, sync, import/export.
