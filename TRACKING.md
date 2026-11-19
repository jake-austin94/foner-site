# foner.uk tracking: what we collect and how

Last updated 19 Nov 2026. Branch `tracking-upgrade` adds the cookie-free beacon (not live until merged and the setup steps below are done).

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
| Country | **not working today** (see gaps) | web_visits.country |
| Page title, time on page | beacon | web_pageviews |
| Active time, deepest scroll %, sections seen | beacon `engagement` event on leaving | web_events (detail `secs=42;scroll=75;sections=hero,deal,hear`) |
| Demo audio played, demo tab, app tab, FAQ opened, calculator used, form started | beacon | web_events |
| Sign-up completed | beacon `enquiry` | web_visits.converted = true |
| Bots filtered | user agent | not stored |

## Known gaps
1. **Country is never recorded** (0 of 127 existing visits have one). The function reads a Cloudflare header that Supabase does not send. Fix needs the function to look the country up from the IP (the IP would go to a third-party geo service, then be discarded). City is possible the same way.
2. **Returning visitors**: system 2 cannot tell, by design. System 1 can, using the localStorage id.
3. **Meta Pixel not installed**: `META_PIXEL_ID` is empty and the ad account has no dataset. Without it Meta cannot optimise for sign-ups or retarget.
4. **Server-side Meta events (Conversions API)** not built; needs the Pixel/dataset id and an access token.
5. **fbclid value** not stored (only whether present).
6. Consent: the localStorage visitor id in system 1 may need a consent choice under UK PECR. The beacon (system 2) is designed not to. Not legal advice.

## Setup needed before the beacon works (needs your OK)
1. Insert a `web_sites` row: slug `foner`, domain `foner.uk`, business name foner, notification email, digest on.
2. Merge `tracking-upgrade` so GitHub Pages deploys it.
3. Dashboard: the existing `stats` function and dashboard page work per site via the site's dashboard_token.

## Checking it works
Open foner.uk in a private tab, scroll, play a demo, close the tab, then look in `web_visits`, `web_pageviews` and `web_events` for site `foner`.
