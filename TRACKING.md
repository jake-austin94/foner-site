# foner.uk tracking: what we collect and how

Last updated 19 Nov 2026. The cookie-free beacon is live on foner.uk (PR #5 merged, site registered as slug `foner`). Dashboard token for the `stats` function is in `web_sites`.

## Two systems, both in Supabase project `foner` (lkfriflskqyvwaknzbet)

### 1. Ad attribution (live now) — `assets/track.js` → tables `site_events`, `site_leads`
| Data | Where | Notes |
|---|---|---|
| utm_source / medium / campaign / content / term | site_events, site_leads | Last ad click wins, remembered 30 days in the browser |
| Was there an fbclid (Facebook click id) | has_fbclid (true/false) | The id itself is not stored |
| Visitor id (random, per browser) | visitor_id | Stored in localStorage `foner_vid`. Links visits from the same browser across days |
| Events: visit, cta_click, tel_click, form_submit | site_events.event | detail = button text/href, phone number or form source |
| Page, referrer (first visit event only) | site_events | |
| Sign-ups: name, email, website, form source, first_seen_at | site_leads | Has stage columns for call booked, trial, paid, lost, monthly value |
| Weekly ad spend (entered by hand) | ad_spend | View `ad_performance` joins spend to leads |
| Scan tool: url scanned, utm, hashed IP | website_scans | |

### 2. Cookie-free website analytics (the same system Tim, KAT and Roof & Render use) — edge function `track` → `web_*` tables
Added by this branch for foner.uk. No cookies, no localStorage, no raw IP. A visitor is a salted hash of IP + browser, which resets every night, so the same person on two days counts as two visitors.

| Data | Source | Table |
|---|---|---|
| Visit start, last seen (visit length) | server clock | web_visits |
| Entry page, exit page, pages viewed | beacon | web_visits |
| Referrer site, channel (Paid: meta, Google, Direct…) | referrer + utm | web_visits |
| utm_* | beacon | web_visits |
| Device (mobile/tablet/desktop), browser, OS | user agent, server side | web_visits |
| Country (2-letter code; IP looked up once per new visit via ipwho.is, then discarded) | server side, added 19 Nov 2026 | web_visits.country |
| Page title, time on page | beacon | web_pageviews |
| Active time, deepest scroll %, sections seen | beacon `engagement` event on leaving | web_events (detail `secs=42;scroll=75;sections=hero,deal,hear`) |
| Demo audio played, demo tab, app tab, FAQ opened, calculator used, form started | beacon | web_events |
| Sign-up completed | beacon `enquiry` | web_visits.converted = true |
| Bots filtered | user agent | not stored |

## Known gaps
1. **Country** was never recorded before 19 Nov 2026 (header Supabase does not send). The `track` function now looks it up. Applies to all sites using the function. City is possible the same way but not stored.
2. **Returning visitors**: system 2 cannot tell, by design. System 1 can, using the localStorage id.
3. **Meta Pixel** installed 19 Nov 2026 (ID 1876911170006176), loads only after the visitor accepts the cookie banner. Events: PageView, Contact (phone tap), Lead (sign-up).
4. **Server-side Meta events (Conversions API)** not built; needs the Pixel/dataset id and an access token.
5. **fbclid value** not stored (only whether present).
6. Consent: the localStorage visitor id in system 1 may need a consent choice under UK PECR. The beacon (system 2) is designed not to. Not legal advice.

## Checking it works
Open foner.uk in a private tab, scroll, play a demo, close the tab, then look in `web_visits`, `web_pageviews` and `web_events` for site `foner`.


## Engagement heartbeat (25 Nov 2026)
The page now reports the running active-time total at 5s, 15s, 30s, 1m, 2m and 5m as well as on exit, because in-app browsers (Instagram/Facebook) often close without firing pagehide. The `track` edge function (v10) keeps one `engagement` row per visit and only ever raises its `secs` value. Visits before this date mostly have no engagement data.
