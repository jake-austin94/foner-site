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
