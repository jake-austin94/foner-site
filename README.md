# foner.uk site

Landing page for foner, the AI phone receptionist for UK trades. Plain HTML and CSS, hosted on GitHub Pages.

## Email logos

Hosted PNGs for HTML emails (480 px wide; display at 240 px for sharp retina rendering):

| File | Use |
|---|---|
| `email/foner-logo-light-bg.png` | Navy wordmark, for white or light email backgrounds |
| `email/foner-logo-dark-bg.png` | White wordmark, for navy or dark backgrounds |
| `email/foner-mark.png` | Icon only (192 px; display at 48–96 px) |

Example:

```html
<img src="https://jake-austin94.github.io/foner-site/email/foner-logo-light-bg.png"
     alt="foner" width="240" height="62" style="display:block;border:0">
```

## Logo pack (original renders, JPG on navy)

| File | What it is |
|---|---|
| `brand/foner-horizontal-tagline.jpg` | Icon + "foner" + "NEVER MISS A CALL", side by side, navy background (label removed) |
| `brand/foner-horizontal.jpg` | Original horizontal render; has a "HORIZONTAL LOGO" caption baked in |
| `brand/foner-vertical.jpg` | Stacked: icon above "foner" and tagline, navy background |
| `brand/foner-mark.jpg` | Icon only, navy background |
| `brand/foner-app-icon.jpg` | Icon in a rounded-square app tile |
| `brand/foner-favicon-ring.jpg` | Icon inside a gradient circle |
| `brand/foner-monochrome.jpg` | One-colour navy logo with tagline, white background |

## Transparent PNGs

| File | What it is |
|---|---|
| `assets/foner-logo-horizontal.png` | Icon + white "foner", full size (1344 px), dark backgrounds |
| `assets/foner-mark.png` | Icon only, full size (402 px) |
| `assets/foner-wordmark.png` | White "foner" text only (902 px), dark backgrounds |
| `assets/favicon.png`, `assets/apple-touch-icon.png` | Site icons |

## Ad tracking

`assets/track.js` records which advert brought each visitor and sign-up, and saves it to the foner Supabase project (insert-only from the site).

- **Meta ad URL parameters** (paste into each ad's "URL parameters" box):
  `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`
- **Tables:** `site_events` (visits, button and phone taps), `site_leads` (sign-ups with their ad, plus stage dates: `call_booked_at`, `call_held_at`, `trial_started_at`, `paid_at`, `lost_at`, and `monthly_value`), `ad_spend` (weekly spend per ad, entered by hand).
- **Report:** the `ad_performance` view gives spend, funnel counts and cost per visitor, lead, booked call, trial and customer for each ad.
- **Meta Pixel:** set `META_PIXEL_ID` at the top of `track.js`. The Pixel only loads after the visitor accepts the cookie banner, which appears once an ID is set.
- **Per-ad demo numbers:** fill in `DEMO_NUMBERS` and add `data-demo-number` to any phone link or number on the page.

## Website scanner (`/scan/`)

`foner.uk/scan/` lets a visitor enter their website, name and email. The `scan-site` Supabase edge function (source in `supabase/functions/scan-site/`) reads up to 10 pages of the site, has Gemini fill in a foner business profile, screens every value (prices, offers, links, phone numbers, promises and instruction-like text are removed) and saves it to the `website_scans` table. The visitor sees what their receptionist would know, then taps **Start my free month**. That saves the lead to `site_leads`, marks `trial_requested_at` on the scan and emails foner.uk@gmail.com via FormSubmit.

- **Secret needed:** `GEMINI_API_KEY` in Supabase → Edge Functions → Secrets. Optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).
- **Limits:** 5 scans per visitor IP per day, 3 per website per day, 200 in total per day. A site scanned in the last 24 hours reuses that scan for free.
- **Agent templates:** the scan sorts each business into `trades-quote`, `trades-callout` (plumbers, electricians and other repair trades) or `appointments` (salons). Each has its own shared demo agent, switched on by its id in `app_settings` (`demo_agent_trades_quote`, `demo_agent_trades_callout`, `demo_agent_appointments`). The wording of each template is kept privately in the `agent_templates` table (admins only).
- **Viewing scans:** `website_scans` is admin-only (RLS). `profile` matches the trades-quote template's profile shape; `removed` lists anything the screening dropped; `kb_text` is cleaned material for the knowledge base.
