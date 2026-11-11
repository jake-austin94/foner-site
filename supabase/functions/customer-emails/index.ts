// customer-emails: foner's automated emails to customers.
//
//   usage_warn    ~10 minutes before the plan's included minutes run out (once a month)
//   usage_over    when the included minutes are used up (once a month)
//   trial_results 3 days before the free month ends: what foner caught, plus Monthly/Annual buttons
//
// POST { action: "run", dry?: true }
//   Checks every active client with auto_emails = true and sends what's due.
//   Each email goes once per client per period (email_log unique index).
// POST { action: "preview", kind, client_id, minutes? }
//   Builds the email from that client's real data and sends it ONLY to foner.uk@gmail.com.
//   `minutes` overrides minutes used, to see what a usage email looks like.
//
// Every request needs header x-foner-key. Emails are sent through the n8n
// workflow "foner - customer emails" (Gmail, foner.uk@gmail.com).
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "http://localhost", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "x", {
  auth: { persistSession: false },
});

const PREVIEW_TO = "foner.uk@gmail.com";
const PORTAL = "https://app.foner.uk";
const SITE = "https://foner.uk";
const LOGO = "https://foner.uk/assets/foner-logo-horizontal.png";
const WARN_BEFORE = 10; // minutes before the allowance runs out

type Client = {
  id: string; business_name: string; owner_name: string | null; notification_email: string | null;
  plan_name: string | null; plan_minutes: number | null; monthly_price: number | null;
  trial_started_at: string | null; trial_ends_at: string | null; auto_emails: boolean; active: boolean;
};
type Usage = { period: string; month_name: string; minutes: number; calls: number; enquiries: number };
type Results = { calls: number; enquiries: number; messages: number; quoted: number; quotes: number; won: number; wins: number; waiting: number };
type Mail = { kind: string; period: string; subject: string; html: string };

let cfg: { mail_key: string; mail_webhook: string } | null = null;
async function config() {
  if (!cfg) {
    const { data, error } = await db.rpc("mail_config");
    if (error || !data?.mail_key) throw new Error("mail config missing");
    cfg = data;
  }
  return cfg!;
}
async function settings(): Promise<Record<string, string | null>> {
  const { data } = await db.from("app_settings").select("key,value");
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value]));
}

// ---------- helpers ----------
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const firstName = (c: Client) => (c.owner_name ?? "").trim().split(/\s+/)[0] || "there";
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const longDate = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
const inTrial = (c: Client, today: string) => !!c.trial_ends_at && today <= c.trial_ends_at;
const mailto = (subject: string) => `mailto:${PREVIEW_TO}?subject=${encodeURIComponent(subject)}`;

// ---------- layout ----------
function button(href: string, label: string, primary = true) {
  const bg = primary ? "#1A64E8" : "#ffffff";
  const fg = primary ? "#ffffff" : "#1A64E8";
  const border = primary ? "#1A64E8" : "#1A64E8";
  return `<a href="${esc(href)}" style="display:block;background:${bg};color:${fg};border:2px solid ${border};text-decoration:none;font-weight:600;font-size:16px;line-height:1.2;padding:14px 18px;border-radius:12px;text-align:center">${label}</a>`;
}

function layout(opts: { preheader: string; body: string; preview?: string }) {
  const banner = opts.preview
    ? `<tr><td style="background:#FFF4CE;color:#5C4400;font-size:13px;padding:10px 24px;text-align:center">${esc(opts.preview)}</td></tr>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>foner</title></head>
<body style="margin:0;padding:0;background:#F5F5F7;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7"><tr><td align="center" style="padding:16px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F">
${banner}
<tr><td style="background:#070F1C;padding:22px 24px"><img src="${LOGO}" width="120" alt="foner" style="display:block;width:120px;height:auto;border:0;color:#ffffff;font-size:24px;font-weight:700"></td></tr>
<tr><td style="padding:28px 24px 8px 24px;font-size:16px;line-height:1.55">${opts.body}</td></tr>
<tr><td style="padding:8px 24px 28px 24px;font-size:13px;line-height:1.5;color:#6E6E73;border-top:1px solid #EDEDF0">
Questions? Just reply to this email.<br>
<a href="${PORTAL}" style="color:#6E6E73">Your foner portal</a> · <a href="${SITE}" style="color:#6E6E73">foner.uk</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function bar(used: number, total: number) {
  const pct = Math.max(2, Math.min(100, Math.round((used / Math.max(total, 1)) * 100)));
  const colour = used >= total ? "#D9480F" : "#1A64E8";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px 0"><tr><td style="background:#E9EAF0;border-radius:8px;height:12px;line-height:12px;font-size:0">
<div style="width:${pct}%;background:${colour};height:12px;border-radius:8px"></div></td></tr></table>`;
}

function stat(value: string, label: string) {
  return `<td width="50%" valign="top" style="padding:6px"><div style="background:#F5F5F7;border-radius:12px;padding:16px 14px">
<div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#1D1D1F">${value}</div>
<div style="font-size:13px;color:#6E6E73;margin-top:2px">${label}</div></div></td>`;
}

// ---------- emails ----------
function usageEmail(c: Client, u: Usage, s: Record<string, string | null>, today: string): Mail {
  const total = c.plan_minutes ?? 60;
  const over = u.minutes >= total;
  const left = Math.max(0, total - u.minutes);
  const trial = inTrial(c, today);
  const kind = over ? "usage_over" : "usage_warn";
  const subject = over
    ? `You've used your ${total} foner minutes for ${u.month_name}`
    : `You've used ${u.minutes} of your ${total} foner minutes`;
  const callsLine = u.calls === 1 ? "1 call" : `${u.calls} calls`;
  const enqLine = u.enquiries > 0 ? `, including ${u.enquiries === 1 ? "1 new enquiry" : `${u.enquiries} new enquiries`}` : "";

  let next: string;
  if (trial) {
    next = `<p style="margin:0 0 16px 0"><strong>Nothing to pay.</strong> You're in your free month, so any minutes over ${total} are on us. foner will keep answering every call.</p>`;
  } else {
    const topup = s.topup_url || mailto(`Top up 30 minutes - ${c.business_name}`);
    next = `<p style="margin:0 0 16px 0"><strong>foner never stops answering.</strong> ${over ? "You're over your" : "If you go over your"} ${total} minutes, that's fine. Expecting a busy few weeks? Top up 30 minutes for £10.</p>
<div style="margin:0 0 20px 0">${button(topup, "Top up 30 minutes for £10")}</div>`;
  }

  const body = `<p style="margin:0 0 16px 0">Hi ${esc(firstName(c))},</p>
<p style="margin:0 0 18px 0">${over ? "Busy month!" : "Good news, the phone's been busy."} foner has answered ${callsLine} for ${esc(c.business_name)} so far in ${esc(u.month_name)}${enqLine}.</p>
<div style="font-size:15px;font-weight:600">${u.minutes} of ${total} minutes used</div>
${bar(u.minutes, total)}
<div style="font-size:13px;color:#6E6E73;margin:0 0 20px 0">${over ? `${u.minutes - total} over your ${total}` : `${left} left this month`}. Minutes reset on the 1st.</div>
${next}
<p style="margin:0 0 8px 0">You can see every call in <a href="${PORTAL}" style="color:#1A64E8">your portal</a>.</p>
<p style="margin:0 0 20px 0">The foner team</p>`;
  return { kind, period: u.period, subject, html: layout({ preheader: subject, body }) };
}

function resultsEmail(c: Client, r: Results, s: Record<string, string | null>, today: string): Mail {
  const ends = c.trial_ends_at ?? today;
  const daysLeft = Math.max(0, daysBetween(today, ends));
  const endsText = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `on ${longDate(ends)}`;
  const price = 49;
  const multiple = r.won / price;

  const headline = r.won > 0
    ? `foner helped you win ${money(r.won)} of work`
    : r.enquiries > 0
      ? `foner took ${r.enquiries} new ${r.enquiries === 1 ? "enquiry" : "enquiries"} for you`
      : `Your free month with foner`;
  const subject = r.won > 0
    ? `Your free month: ${money(r.won)} won from ${r.enquiries} ${r.enquiries === 1 ? "enquiry" : "enquiries"}`
    : `Your free month with foner ends ${daysLeft <= 1 ? endsText : "soon"}`;

  const roi = r.won >= price
    ? `<p style="margin:0 0 18px 0">That's <strong>${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}×</strong> what foner costs in a month.</p>`
    : "";
  const waiting = r.waiting > 0
    ? `<p style="margin:0 0 18px 0;background:#EEF4FF;border-radius:12px;padding:14px 16px">${r.waiting === 1 ? "1 enquiry is" : `${r.waiting} enquiries are`} still waiting for a quote. <a href="${PORTAL}" style="color:#1A64E8">Open your portal</a> to follow ${r.waiting === 1 ? "it" : "them"} up.</p>`
    : "";

  const monthly = s.stripe_monthly_url || mailto(`Keep foner - Monthly - ${c.business_name}`);
  const annual = s.stripe_annual_url || mailto(`Keep foner - Annual - ${c.business_name}`);

  const walk = r.won < 100
    ? `<p style="margin:0 0 14px 0;font-size:14px;color:#6E6E73"><strong style="color:#1D1D1F">Our promise:</strong> if foner hasn't brought you at least £100 of new work this month, you can walk away and pay nothing. Just reply and we'll switch it off.</p>`
    : `<p style="margin:0 0 14px 0;font-size:14px;color:#6E6E73">Not for you? Reply to this email and we'll switch it off. You won't pay anything for your free month.</p>`;

  const body = `<p style="margin:0 0 16px 0">Hi ${esc(firstName(c))},</p>
<p style="margin:0 0 6px 0">Your free month ends ${esc(endsText)}. Here's what foner did for ${esc(c.business_name)}.</p>
<h1 style="font-size:24px;line-height:1.25;letter-spacing:-0.4px;margin:18px 0 14px 0">${esc(headline)}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0">
<tr>${stat(String(r.calls), "calls answered")}${stat(String(r.enquiries), r.enquiries === 1 ? "new enquiry" : "new enquiries")}</tr>
<tr>${stat(money(r.quoted), r.quotes === 1 ? "quoted from 1 job" : `quoted from ${r.quotes} jobs`)}${stat(money(r.won), r.wins === 1 ? "won from 1 job" : `won from ${r.wins} jobs`)}</tr>
</table>
${roi}${waiting}
<h2 style="font-size:19px;margin:22px 0 6px 0">Keep foner answering</h2>
<p style="margin:0 0 16px 0">Pick a plan and your receptionist carries on without a break. Same number, same set-up, 60 minutes a month included.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px 0">
<tr><td style="padding:0 0 10px 0">${button(annual, "Annual · £490 a year (2 months free)")}</td></tr>
<tr><td style="padding:0 0 16px 0">${button(monthly, "Monthly · £49 a month", false)}</td></tr>
</table>
<p style="margin:0 0 14px 0;font-size:14px;color:#6E6E73"><strong style="color:#1D1D1F">Every month after:</strong> if foner doesn't take a single new enquiry for you, that month is free.</p>
${walk}
<p style="margin:18px 0 20px 0">The foner team</p>`;
  return { kind: "trial_results", period: ends, subject, html: layout({ preheader: `${r.calls} calls, ${r.enquiries} enquiries, ${money(r.won)} won`, body }) };
}

// ---------- sending ----------
async function send(to: string, mail: Mail) {
  const { mail_key, mail_webhook } = await config();
  const res = await fetch(mail_webhook, {
    method: "POST",
    headers: { "content-type": "application/json", "x-foner-key": mail_key },
    body: JSON.stringify({ to, subject: mail.subject, html: mail.html }),
  });
  const text = await res.text();
  if (!res.ok || /"ok"\s*:\s*false/.test(text)) throw new Error(`send failed (${res.status}): ${text.slice(0, 200)}`);
}

async function alreadySent(clientId: string, kind: string, period: string) {
  const { count } = await db.from("email_log").select("id", { count: "exact", head: true })
    .eq("client_id", clientId).eq("kind", kind).eq("period", period).eq("status", "sent").eq("preview", false);
  return (count ?? 0) > 0;
}

async function log(c: Client, mail: Mail, to: string, preview: boolean, status: string, error?: string) {
  await db.from("email_log").insert({
    client_id: c.id, kind: mail.kind, period: mail.period, to_email: to, subject: mail.subject, status, error: error ?? null, preview,
  });
}

async function dueFor(c: Client, s: Record<string, string | null>, today: string): Promise<Mail[]> {
  const out: Mail[] = [];
  const total = c.plan_minutes ?? 60;
  const { data: u } = await db.rpc("email_usage", { p_client: c.id });
  const usage = u as Usage;
  if (usage.minutes >= total) {
    if (!(await alreadySent(c.id, "usage_over", usage.period))) out.push(usageEmail(c, usage, s, today));
  } else if (usage.minutes >= total - WARN_BEFORE) {
    if (!(await alreadySent(c.id, "usage_warn", usage.period))) out.push(usageEmail(c, usage, s, today));
  }
  if (c.trial_ends_at) {
    const d = daysBetween(today, c.trial_ends_at);
    if (d >= 0 && d <= 3 && !(await alreadySent(c.id, "trial_results", c.trial_ends_at))) {
      const { data: r } = await db.rpc("email_results", { p_client: c.id, p_until: c.trial_ends_at });
      out.push(resultsEmail(c, r as Results, s, today));
    }
  }
  return out;
}

const CLIENT_COLS =
  "id,business_name,owner_name,notification_email,plan_name,plan_minutes,monthly_price,trial_started_at,trial_ends_at,auto_emails,active";

export { usageEmail, resultsEmail };

// Only serve when running on Supabase (lets the email builders be rendered locally for checking).
if (Deno.env.get("SUPABASE_URL")) Deno.serve(async (req) => {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { mail_key } = await config();
    if ((req.headers.get("x-foner-key") ?? "") !== mail_key) return json({ error: "unauthorised" }, 401);
    const body = await req.json().catch(() => ({}));
    const today = ukToday();
    const s = await settings();

    if (body.action === "preview") {
      const { data: c } = await db.from("clients").select(CLIENT_COLS).eq("id", body.client_id).single();
      if (!c) return json({ error: "client not found" }, 404);
      let mail: Mail;
      if (body.kind === "trial_results") {
        const until = c.trial_ends_at ?? today;
        const { data: r } = await db.rpc("email_results", { p_client: c.id, p_until: until });
        mail = resultsEmail(c, r as Results, s, body.today ?? today);
      } else {
        const { data: u } = await db.rpc("email_usage", { p_client: c.id });
        const usage = { ...(u as Usage) };
        if (typeof body.minutes === "number") usage.minutes = body.minutes;
        if (typeof body.calls === "number") usage.calls = body.calls;
        if (typeof body.enquiries === "number") usage.enquiries = body.enquiries;
        mail = usageEmail(c, usage, s, body.today ?? today);
      }
      const note = `Preview for ${c.business_name}. This would go to ${c.notification_email ?? "(no email set)"}. It has only been sent to you.`;
      mail.html = mail.html.replace("<tr><td style=\"background:#070F1C", `<tr><td style="background:#FFF4CE;color:#5C4400;font-size:13px;padding:10px 24px;text-align:center">${esc(note)}</td></tr><tr><td style="background:#070F1C`);
      mail.subject = `[Preview] ${mail.subject}`;
      try {
        await send(PREVIEW_TO, mail);
        await log(c, mail, PREVIEW_TO, true, "sent");
        return json({ ok: true, subject: mail.subject });
      } catch (e) {
        await log(c, mail, PREVIEW_TO, true, "failed", String(e));
        return json({ ok: false, error: String(e) }, 502);
      }
    }

    if (body.action === "run") {
      const { data: clients } = await db.from("clients").select(CLIENT_COLS).eq("active", true).eq("auto_emails", true);
      const report: unknown[] = [];
      for (const c of (clients ?? []) as Client[]) {
        if (!c.notification_email) { report.push({ client: c.business_name, skipped: "no email" }); continue; }
        for (const mail of await dueFor(c, s, today)) {
          if (body.dry) { report.push({ client: c.business_name, would_send: mail.kind, subject: mail.subject }); continue; }
          try {
            await send(c.notification_email, mail);
            await log(c, mail, c.notification_email, false, "sent");
            report.push({ client: c.business_name, sent: mail.kind });
          } catch (e) {
            await log(c, mail, c.notification_email, false, "failed", String(e));
            report.push({ client: c.business_name, failed: mail.kind, error: String(e) });
          }
        }
      }
      return json({ ok: true, today, report });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
