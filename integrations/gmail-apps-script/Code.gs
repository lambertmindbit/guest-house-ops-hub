/**
 * Gmail → Ops Hub — OTA email forwarder (Google Apps Script).
 *
 * No domain, no server, no Cloudflare. Runs inside your own Google account on a
 * timer. It finds OTA confirmation emails you've labelled, POSTs each to the Ops
 * Hub ingestion webhook (which stages them in the Inbox for REVIEW — nothing is
 * auto-booked), then re-labels them "done" so the same email is never sent twice.
 *
 * ---- PLUG IN (Project Settings → Script properties) ----
 *   INGEST_URL    = https://YOUR-APP.vercel.app/api/ingest/email
 *   INGEST_TOKEN  = (the SAME value as INGEST_TOKEN in Vercel)
 *   Optional:
 *   LABEL_TODO    = OTA-Ingest     (default — the label your Gmail filter applies)
 *   LABEL_DONE    = OTA-Ingested   (default — applied after a successful send)
 *
 * ---- ACTIVATE ----
 *   1. testConnection()  → check the Logs show 201 (token + URL are correct)
 *   2. setup()           → authorise + start the 5-minute timer
 * See README.md in this folder for the full walkthrough.
 */

function config_() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('INGEST_URL');
  var token = p.getProperty('INGEST_TOKEN');
  if (!url || !token) {
    throw new Error('Set INGEST_URL and INGEST_TOKEN in Project Settings → Script properties.');
  }
  return {
    url: url,
    token: token,
    labelTodo: p.getProperty('LABEL_TODO') || 'OTA-Ingest',
    labelDone: p.getProperty('LABEL_DONE') || 'OTA-Ingested',
  };
}

/** Run ONCE: authorise the script and install the recurring 5-minute trigger. */
function setup() {
  config_();                 // fail early if properties are missing
  getOrCreateLabel_('OTA-Ingest');

  // Replace any existing run() triggers with a single fresh one.
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'run'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('run').timeBased().everyMinutes(5).create();
  Logger.log('Setup complete — forwarding labelled OTA emails every 5 minutes.');
}

/** Main loop — called automatically by the trigger. */
function run() {
  var cfg = config_();
  var todo = getOrCreateLabel_(cfg.labelTodo);
  var done = getOrCreateLabel_(cfg.labelDone);

  // Threads still waiting (labelled TODO, not yet DONE). Cap per run for quotas.
  var query = 'label:' + cfg.labelTodo + ' -label:' + cfg.labelDone;
  var threads = GmailApp.search(query, 0, 25);

  threads.forEach(function (thread) {
    var allSent = true;
    thread.getMessages().forEach(function (msg) {
      if (!forwardMessage_(cfg, msg)) allSent = false;
    });
    if (allSent) {
      thread.removeLabel(todo);
      thread.addLabel(done);
    }
    // If a send failed, the thread keeps its TODO label and retries next run.
  });
}

/** POST one message's text to the webhook. Returns true on 2xx. */
function forwardMessage_(cfg, msg) {
  var raw =
    'From: ' + msg.getFrom() + '\n' +
    'Subject: ' + msg.getSubject() + '\n' +
    'Date: ' + msg.getDate() + '\n\n' +
    msg.getPlainBody();

  var res = UrlFetchApp.fetch(cfg.url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-token': cfg.token },
    payload: JSON.stringify({ raw: raw }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code >= 200 && code < 300) return true;
  Logger.log('Ingest failed (' + code + '): ' + res.getContentText());
  return false;
}

/** Smoke test — sends a fake email so you can confirm the token/URL work. */
function testConnection() {
  var cfg = config_();
  var raw = 'Booking.com\nGuest name: Test Guest\nCheck-in: 2026-07-12\n' +
            'Check-out: 2026-07-14\nRoom: Deluxe\nTotal: ₹4200\nConfirmation: TEST-123';
  var res = UrlFetchApp.fetch(cfg.url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-token': cfg.token },
    payload: JSON.stringify({ raw: raw }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
