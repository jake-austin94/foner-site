/* foner ad tracking
   - Remembers which ad (UTM tags) brought a visitor here, for 30 days
   - Logs visits, button taps and phone taps to Supabase (insert-only, nobody can read them from the site)
   - Saves every sign-up to Supabase with the ad it came from
   - Fires Meta Pixel events once META_PIXEL_ID is set and the visitor accepts the cookie
   - Optional: shows a different demo-line number per ad (DEMO_NUMBERS) */
(function () {
  'use strict';

  // ---- Settings -----------------------------------------------------------
  var SUPABASE_URL = 'https://lkfriflskqyvwaknzbet.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_5U5tHfl4OZwQdv63cVDTAg_ttYhhtdJ'; // publishable key, safe in the browser
  var META_PIXEL_ID = ''; // paste your Pixel ID from Meta Events Manager, e.g. '123456789012345'

  // Per-ad demo line numbers. Key is the ad name (utm_content), or the campaign name,
  // or 'default'. Any element with data-demo-number gets the matching number.
  // e.g. { 'missed-calls-stat-v1': '01638 000001', default: '01638 000000' }
  var DEMO_NUMBERS = {};

  var ATTRIBUTION_DAYS = 30;
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  // ---- Storage helpers (never let storage errors break the page) --------
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function visitorId() {
    var id = get('foner_vid');
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      set('foner_vid', id);
    }
    return id;
  }

  // ---- Attribution --------------------------------------------------------
  // The most recent ad click wins. Kept for 30 days so someone who comes back
  // a few days later and signs up is still credited to the ad.
  function readAttribution() {
    var params = new URLSearchParams(location.search);
    var fromUrl = {};
    var hasUtm = false;
    UTM_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) { fromUrl[k] = v.slice(0, 150); hasUtm = true; }
    });
    var hasFbclid = params.has('fbclid');
    if (hasUtm || hasFbclid) {
      fromUrl.has_fbclid = hasFbclid;
      fromUrl.first_seen_at = new Date().toISOString();
      set('foner_attr', JSON.stringify(fromUrl));
      return fromUrl;
    }
    try {
      var saved = JSON.parse(get('foner_attr') || 'null');
      if (saved && saved.first_seen_at &&
          Date.now() - Date.parse(saved.first_seen_at) < ATTRIBUTION_DAYS * 864e5) {
        return saved;
      }
    } catch (e) {}
    return {};
  }

  var vid = visitorId();
  var attr = readAttribution();

  function utmFields() {
    var o = {};
    UTM_KEYS.forEach(function (k) { o[k] = attr[k] || null; });
    o.has_fbclid = !!attr.has_fbclid;
    return o;
  }

  // ---- Supabase -----------------------------------------------------------
  function insert(table, row) {
    return fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      keepalive: true,
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    }).catch(function () {});
  }

  function logEvent(event, detail) {
    var row = utmFields();
    row.visitor_id = vid;
    row.event = event;
    row.detail = detail ? String(detail).slice(0, 200) : null;
    row.page = (location.pathname + location.hash).slice(0, 300);
    row.referrer = event === 'visit' && document.referrer ? document.referrer.slice(0, 500) : null;
    return insert('site_events', row);
  }

  // ---- Meta Pixel (only after consent) ------------------------------------
  function loadPixel() {
    if (!META_PIXEL_ID || window.fbq) return;
    /* Standard Meta Pixel base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }
  function pixel(event, data) {
    if (window.fbq) window.fbq('track', event, data || {});
  }

  function consentBanner() {
    if (!META_PIXEL_ID) return;
    var choice = get('foner_consent');
    if (choice === 'yes') { loadPixel(); return; }
    if (choice === 'no') return;
    var bar = document.createElement('div');
    bar.className = 'consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie choice');
    bar.innerHTML =
      '<p>We use a Meta cookie to see which of our adverts are worth paying for. Is that OK?</p>' +
      '<div><button type="button" class="c-no">No thanks</button>' +
      '<button type="button" class="c-yes">That’s fine</button></div>';
    var css = document.createElement('style');
    css.textContent =
      '.consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:50;max-width:560px;margin:0 auto;' +
      'background:#0E1A2D;color:#C3CCDA;border:1px solid #1E2B42;border-radius:16px;padding:14px 16px;' +
      'display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.35);font-size:14px;line-height:1.4}' +
      '.consent p{margin:0;flex:1 1 240px}.consent div{display:flex;gap:8px}' +
      '.consent button{font:inherit;font-weight:600;border-radius:999px;padding:8px 14px;cursor:pointer;border:1px solid #26344D;background:transparent;color:#fff}' +
      '.consent .c-yes{border:0;background:linear-gradient(135deg,#1A64E8 0%,#5B3CF5 100%)}';
    document.head.appendChild(css);
    document.body.appendChild(bar);
    bar.querySelector('.c-yes').addEventListener('click', function () {
      set('foner_consent', 'yes'); bar.remove(); loadPixel();
    });
    bar.querySelector('.c-no').addEventListener('click', function () {
      set('foner_consent', 'no'); bar.remove();
    });
  }

  // ---- Per-ad demo numbers -----------------------------------------------
  function swapNumbers() {
    var number = DEMO_NUMBERS[attr.utm_content] || DEMO_NUMBERS[attr.utm_campaign] || DEMO_NUMBERS['default'];
    if (!number) return;
    var tel = '+44' + number.replace(/\D/g, '').replace(/^0/, '');
    document.querySelectorAll('[data-demo-number]').forEach(function (el) {
      if (el.tagName === 'A') el.href = 'tel:' + tel;
      if (!el.children.length) el.textContent = number;
    });
  }

  // ---- Clicks -------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      logEvent('tel_click', href.slice(4));
      pixel('Contact');
    } else if (a.classList.contains('btn')) {
      logEvent('cta_click', (a.textContent || '').trim() + ' ' + href);
    }
  }, true);

  // ---- Public API used by the sign-up forms ------------------------------
  window.fonerTrack = {
    // UTM fields to add to the sign-up email, so each email says which ad it came from
    emailFields: function () {
      return {
        ad_campaign: attr.utm_campaign || 'None',
        ad_name: attr.utm_content || 'None',
        ad_source: attr.utm_source || (attr.has_fbclid ? 'facebook (untagged)' : 'None')
      };
    },
    // Call when a sign-up form is submitted (saved even if the email step fails)
    lead: function (d) {
      var row = utmFields();
      row.name = (d.name || '').slice(0, 200);
      row.email = (d.email || '').slice(0, 320);
      row.website = d.website ? d.website.slice(0, 500) : null;
      row.form_source = d.source ? String(d.source).slice(0, 50) : null;
      row.visitor_id = vid;
      row.first_seen_at = attr.first_seen_at || null;
      insert('site_leads', row);
      logEvent('form_submit', d.source);
      pixel('Lead');
    }
  };

  // ---- Start --------------------------------------------------------------
  function start() {
    swapNumbers();
    consentBanner();
    logEvent('visit');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
