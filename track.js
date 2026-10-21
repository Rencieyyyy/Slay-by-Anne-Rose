/* Slay by Anne&Rose: "Track my booking" popup (no booking code needed).
   Add to index.html, after shop-live.js:  <script src="track.js"></script>
   Any link or button with class "js-track" opens it.
   Needs track-no-code.sql to be run once in Supabase. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rkwslciojefeouznmydb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_1yb-fa3isea2tDsnnqhEPw_wJPIQ1Ro';

  var $ = function (s) { return document.querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function niceDate(s) {
    if (!s) return '';
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-PH',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---------- styles (self-contained) ---------- */
  var st = document.createElement('style');
  st.textContent =
    'dialog.trk{width:min(460px,calc(100% - 24px));max-height:90vh;overflow-y:auto;border:0;border-bottom:3px solid #D4AF37;padding:26px 24px 22px;background:#fff;color:#2b1030;box-shadow:0 20px 60px rgba(26,10,27,.45);font-family:"Jost",Arial,sans-serif}' +
    'dialog.trk::backdrop{background:rgba(26,10,27,.7)}' +
    '.trk h3{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.9rem;font-weight:600;color:#4A154B;margin:0 0 4px}' +
    '.trk-sub{margin:0 0 6px;color:#6b5a6e;font-size:.9rem}' +
    '.trk-x{position:absolute;top:8px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:#f4e8f4;color:#4A154B;font-size:1.5rem;line-height:1;cursor:pointer}' +
    '.trk label{display:block;font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4A154B;margin:12px 0 0}' +
    '.trk input{display:block;width:100%;margin-top:4px;padding:10px;border:1px solid #e3cfe3;font:inherit;font-size:.95rem;letter-spacing:0;text-transform:none;color:#2b1030;background:#fff}' +
    '.trk-btn{width:100%;margin-top:14px;padding:13px;border:0;border-bottom:2px solid #D4AF37;background:#D81B8A;color:#fff;font:inherit;font-size:.78rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}' +
    '.trk-btn:hover{background:#6B1D70}' +
    '.trk-card{margin-top:14px;padding:14px;border:1px solid #ecdcec;background:#fbf4fb}' +
    '.trk-top{display:flex;justify-content:space-between;align-items:center;gap:8px}' +
    '.trk-top strong{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.45rem;color:#4A154B;line-height:1.1}' +
    '.trk-pill{padding:3px 10px;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:#f4e8f4;color:#4A154B;white-space:nowrap}' +
    '.trk-pill.ok{background:#e3f4e6;color:#1d6b2f}' +
    '.trk-pill.no{background:#f8e1df;color:#b3261e}' +
    '.trk-pill.wait{background:#fff1cc;color:#8a5a00}' +
    '.trk-date{margin-top:2px;font-size:.85rem;color:#6b5a6e}' +
    '.trk-card p{margin:8px 0 0;font-size:.92rem}' +
    '.trk-rem{padding:8px 10px;background:#fff;border-left:3px solid #D81B8A}' +
    '.trk-err{color:#b3261e;font-size:.9rem;margin:12px 0 0}' +
    '.trk-wait,.trk-note{color:#6b5a6e;font-size:.8rem;margin:12px 0 0}';
  document.head.appendChild(st);

  /* ---------- popup ---------- */
  var dlg = document.createElement('dialog');
  dlg.className = 'trk';
  dlg.setAttribute('aria-labelledby', 'trkTitle');
  dlg.innerHTML =
    '<button type="button" class="trk-x" aria-label="Close">&times;</button>' +
    '<h3 id="trkTitle">Track my booking</h3>' +
    '<p class="trk-sub">Enter the mobile number, Facebook name or email you used when you sent your booking request.</p>' +
    '<form id="trkForm" novalidate>' +
      '<label>Mobile number, Facebook name or email<input id="trkWho" maxlength="120" autocomplete="off"></label>' +
      '<button class="trk-btn" type="submit">Check status</button>' +
    '</form>' +
    '<div id="trkOut" aria-live="polite"></div>';
  document.body.appendChild(dlg);

  function view(r) {
    var s, cls, msg;
    if (r.status === 'Declined') { s = 'Not accepted'; cls = 'no'; msg = 'Sorry, we could not accept this booking.'; }
    else if (r.status === 'Pending') { s = 'Pending'; cls = 'wait'; msg = 'We are checking the dress and your date. This page refreshes by itself.'; }
    else if (r.rental_status === 'Paid') { s = 'Paid'; cls = 'ok'; msg = 'Payment received. Thank you!'; }
    else if (r.rental_status === 'Returned') { s = 'Returned'; cls = 'ok'; msg = 'The dress has been returned. Thank you for renting with us!'; }
    else if (r.rental_status === 'Cancelled') { s = 'Cancelled'; cls = 'no'; msg = 'This rental was cancelled.'; }
    else { s = 'Accepted'; cls = 'ok'; msg = 'Accepted! Your dress is reserved for this date.'; }
    return '<div class="trk-card"><div class="trk-top"><strong>' + esc(r.dress_name) + '</strong>' +
      '<span class="trk-pill ' + cls + '">' + s + '</span></div>' +
      '<div class="trk-date">' + esc(niceDate(r.event_date)) + '</div>' +
      '<p>' + msg + '</p>' +
      (r.remarks ? '<p class="trk-rem"><b>Message from us:</b> ' + esc(r.remarks) + '</p>' : '') +
      '</div>';
  }

  var timer = null;
  function stopPoll() { if (timer) { clearInterval(timer); timer = null; } }
  function startPoll() {
    if (timer) return;
    timer = setInterval(function () { if (dlg.open) go(true); else stopPoll(); }, 30000);
  }

  function go(quiet) {
    var who = $('#trkWho').value.trim(), out = $('#trkOut');
    if (who.length < 5) { out.innerHTML = '<p class="trk-err">Please enter the mobile number, Facebook name or email you used.</p>'; return; }
    if (!quiet) out.innerHTML = '<p class="trk-wait">Checking\u2026</p>';

    fetch(SUPABASE_URL + '/rest/v1/rpc/track_my_bookings', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_who: who })
    })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        if (!rows.length) {
          out.innerHTML = '<p class="trk-err">We could not find a booking with that contact. Please check and try again.</p>';
          stopPoll();
          return;
        }
        out.innerHTML = rows.map(view).join('') +
          '<p class="trk-note">Last checked ' + new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) + '</p>';
        try { localStorage.setItem('slay_track', JSON.stringify({ who: who })); } catch (e) {}
        startPoll();
      })
      .catch(function () {
        if (!quiet) out.innerHTML = '<p class="trk-err">Could not check right now. Please try again in a moment.</p>';
      });
  }

  function open() {
    var nav = $('#nav'); if (nav) nav.classList.remove('open');
    var wr = $('.fc-wrap');
    if (wr && !wr.hidden) { var ov = $('.fc-overlay'); if (ov) ov.click(); }

    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('slay_track')) || {}; } catch (e) {}
    $('#trkWho').value = saved.who || '';
    $('#trkOut').innerHTML = '';
    if (!dlg.open) dlg.showModal();
    if ($('#trkWho').value) go(); else $('#trkWho').focus();
  }

  $('#trkForm').addEventListener('submit', function (e) { e.preventDefault(); go(); });
  dlg.querySelector('.trk-x').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', stopPoll);

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.js-track');
    if (a) { e.preventDefault(); open(); }
  });

  window.SlayTrack = { open: open };
  if (location.hash === '#track') open();
})();