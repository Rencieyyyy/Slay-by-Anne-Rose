/* Slay by Anne&Rose: "Track my booking" + checkout (Cash / GCash / Bank transfer).
   Add to index.html, after shop-live.js:  <script src="track.js?v=3"></script>
   Any link or button with class "js-track" opens it.
   Needs supabase-payments.sql to be run once in Supabase. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rkwslciojefeouznmydb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_1yb-fa3isea2tDsnnqhEPw_wJPIQ1Ro';

  /* ===== YOUR PAYMENT SETTINGS: edit the names and add your QR image files ===== */
  var PAY = {
    cash: 'Pay in cash when you fit or pick up your dress at our studio. We will mark your rental as paid once we receive it.',
    gcash: [
      { img: 'gcash.png', name: 'GCash', details: '' }
    ],
    bank: [
      { img: 'bank1.png', name: 'Bank transfer 1', details: '' },
      { img: 'bank2.png', name: 'Bank transfer 2', details: '' }
    ]
  };
  var METHODS = { cash: 'Cash', gcash: 'GCash', bank: 'Bank transfer' };

  var $ = function (s) { return document.querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function peso(n) { return '\u20B1' + Number(n || 0).toLocaleString('en-PH'); }
  function niceDate(s) {
    if (!s) return '';
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-PH',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function rid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  /* ---------- styles (self-contained) ---------- */
  var st = document.createElement('style');
  st.textContent =
    'dialog.trk{width:min(480px,calc(100% - 24px));max-height:92vh;overflow-y:auto;border:0;border-bottom:3px solid #D4AF37;padding:26px 24px 22px;background:#fff;color:#2b1030;box-shadow:0 20px 60px rgba(26,10,27,.45);font-family:"Jost",Arial,sans-serif}' +
    'dialog.trk::backdrop{background:rgba(26,10,27,.7)}' +
    '.trk h3{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.9rem;font-weight:600;color:#4A154B;margin:0 0 4px}' +
    '.trk h4{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.4rem;font-weight:600;color:#4A154B;margin:0 0 6px}' +
    '.trk-sub{margin:0 0 6px;color:#6b5a6e;font-size:.9rem}' +
    '.trk-x{position:absolute;top:8px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:#f4e8f4;color:#4A154B;font-size:1.5rem;line-height:1;cursor:pointer}' +
    '.trk label{display:block;font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4A154B;margin:12px 0 0}' +
    '.trk input[type=text],.trk input:not([type]){display:block;width:100%;margin-top:4px;padding:10px;border:1px solid #e3cfe3;font:inherit;font-size:.95rem;letter-spacing:0;text-transform:none;color:#2b1030;background:#fff}' +
    '.trk input[type=file]{display:block;width:100%;margin-top:6px;font:inherit;font-size:.85rem}' +
    '.trk .trk-pick{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:.82rem;letter-spacing:0;text-transform:none;color:#2b1030;cursor:pointer}' +
    '.trk .trk-pick input{width:18px;height:18px;margin:0;accent-color:#D81B8A}' +
    '.trk-btn{width:100%;margin-top:14px;padding:13px;border:0;border-bottom:2px solid #D4AF37;background:#D81B8A;color:#fff;font:inherit;font-size:.78rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}' +
    '.trk-btn:hover{background:#6B1D70}.trk-btn:disabled{background:#C8C3E6;color:#4A154B;cursor:default}' +
    '.trk-link{display:inline-block;margin-top:8px;padding:0;border:0;background:none;color:#6B1D70;font:inherit;font-size:.82rem;text-decoration:underline;cursor:pointer}' +
    '.trk-card{margin-top:14px;padding:14px;border:1px solid #ecdcec;background:#fbf4fb}' +
    '.trk-top{display:flex;justify-content:space-between;align-items:center;gap:8px}' +
    '.trk-top strong{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.45rem;color:#4A154B;line-height:1.1}' +
    '.trk-pill{padding:3px 10px;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:#f4e8f4;color:#4A154B;white-space:nowrap}' +
    '.trk-pill.ok{background:#e3f4e6;color:#1d6b2f}.trk-pill.no{background:#f8e1df;color:#b3261e}.trk-pill.wait{background:#fff1cc;color:#8a5a00}' +
    '.trk-date{margin-top:2px;font-size:.85rem;color:#6b5a6e}' +
    '.trk-card p{margin:8px 0 0;font-size:.92rem}' +
    '.trk-rem{padding:8px 10px;background:#fff;border-left:3px solid #D81B8A}' +
    '.trk-err{color:#b3261e;font-size:.9rem;margin:12px 0 0}' +
    '.trk-wait,.trk-note{color:#6b5a6e;font-size:.8rem;margin:12px 0 0}' +
    '.trk-total{display:flex;justify-content:space-between;align-items:baseline;margin:12px 0 0;padding-top:10px;border-top:1px solid #ecdcec;color:#4A154B}' +
    '.trk-total strong{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.7rem}' +
    '.trk-line{display:flex;justify-content:space-between;gap:10px;font-size:.9rem;margin:4px 0}' +
    '.trk-ms{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}' +
    '.trk-m{padding:12px 6px;border:1px solid #e3cfe3;background:#fff;color:#4A154B;font:inherit;font-size:.78rem;font-weight:600;letter-spacing:.06em;cursor:pointer}' +
    '.trk-m.on{background:#D81B8A;border-color:#D81B8A;color:#fff}' +
    '.trk-qr{margin:14px 0 0;text-align:center}' +
    '.trk-qr img{display:block;width:100%;max-width:260px;margin:0 auto;border:1px solid #ecdcec;background:#fff}' +
    '.trk-qr figcaption{margin-top:6px;font-size:.85rem;color:#4A154B;font-weight:600}' +
    '.trk-qr small{display:block;font-weight:400;color:#6b5a6e}' +
    '.trk-prev{display:block;max-width:100%;max-height:200px;margin:8px 0 0;border:1px solid #ecdcec}' +
    '.trk-thanks{text-align:center;padding:18px 6px 6px}' +
    '.trk-thanks h4{font-size:2.2rem;margin-bottom:8px}' +
    '.trk-thanks p{margin:0 0 6px;font-size:.95rem;color:#2b1030}';
  document.head.appendChild(st);

  /* ---------- popup shell ---------- */
  var dlg = document.createElement('dialog');
  dlg.className = 'trk';
  dlg.setAttribute('aria-labelledby', 'trkTitle');
  dlg.innerHTML =
    '<button type="button" class="trk-x" aria-label="Close">&times;</button>' +
    '<h3 id="trkTitle">Track my booking</h3>' +
    '<form id="trkForm" novalidate>' +
      '<p class="trk-sub">Enter the mobile number, Facebook name or email you used when you sent your booking request.</p>' +
      '<label>Mobile number, Facebook name or email<input id="trkWho" maxlength="120" autocomplete="off"></label>' +
      '<button class="trk-btn" type="submit">Check status</button>' +
    '</form>' +
    '<div id="trkOut" aria-live="polite"></div>';
  document.body.appendChild(dlg);

  /* ---------- state ---------- */
  var rows = [], sel = {}, stage = 'list', method = '', proof = null, timer = null;

  function payable(r) {
    return r.status === 'Accepted' && r.rental_status === 'Reserved' && r.pay_status !== 'Submitted';
  }

  function view(r) {
    var s, cls, msg, extra = '';
    if (r.status === 'Declined') { s = 'Not accepted'; cls = 'no'; msg = 'Sorry, we could not accept this booking.'; }
    else if (r.status === 'Pending') { s = 'Pending'; cls = 'wait'; msg = 'We are checking the dress and your date. This page refreshes by itself.'; }
    else if (r.rental_status === 'Paid') { s = 'Paid'; cls = 'ok'; msg = 'Payment confirmed. Thank you for renting with Slay by Anne &amp; Rose!'; }
    else if (r.rental_status === 'Returned') { s = 'Returned'; cls = 'ok'; msg = 'The dress has been returned. Thank you for renting with us!'; }
    else if (r.rental_status === 'Cancelled') { s = 'Cancelled'; cls = 'no'; msg = 'This rental was cancelled.'; }
    else if (r.pay_status === 'Submitted') {
      s = 'Payment sent'; cls = 'wait';
      msg = 'Thank you! We received your ' + esc(METHODS[r.pay_method] || '') + ' payment and will confirm it soon.';
    } else {
      s = 'Accepted'; cls = 'ok';
      msg = 'Accepted! Your dress is reserved for this date. Please complete your payment below.';
      if (r.pay_status === 'Rejected') {
        extra = '<p class="trk-rem"><b>Your last payment was not accepted.</b> ' + esc(r.pay_note || '') + ' Please send a new proof.</p>';
      }
    }
    var pick = payable(r)
      ? '<label class="trk-pick"><input type="checkbox" data-pick="' + esc(r.booking_id) + '"' + (sel[r.booking_id] ? ' checked' : '') + '> Pay for this: <b>' + peso(r.amount) + '</b></label>'
      : '';
    return '<div class="trk-card"><div class="trk-top"><strong>' + esc(r.dress_name) + '</strong>' +
      '<span class="trk-pill ' + cls + '">' + s + '</span></div>' +
      '<div class="trk-date">' + esc(niceDate(r.event_date)) + '</div>' +
      '<p>' + msg + '</p>' + extra +
      (r.remarks ? '<p class="trk-rem"><b>Message from us:</b> ' + esc(r.remarks) + '</p>' : '') +
      pick + '</div>';
  }

  function chosen() { return rows.filter(function (r) { return payable(r) && sel[r.booking_id]; }); }
  function sumOf(list) { return list.reduce(function (t, r) { return t + Number(r.amount || 0); }, 0); }

  function showList() {
    stage = 'list';
    $('#trkForm').hidden = false;
    var out = $('#trkOut'), html = rows.map(view).join('');
    if (rows.some(payable)) {
      var c = chosen();
      html += '<button type="button" class="trk-btn" id="trkCheckout"' + (c.length ? '' : ' disabled') + '>' +
        (c.length ? 'Checkout \u00B7 ' + peso(sumOf(c)) : 'Select a dress to pay') + '</button>';
    }
    html += '<p class="trk-note">Last checked ' + new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) + '</p>';
    out.innerHTML = html;
  }

  /* ---------- checkout ---------- */
  function showPay() {
    var c = chosen();
    if (!c.length) return;
    stage = 'pay'; method = ''; proof = null;
    $('#trkForm').hidden = true;
    $('#trkOut').innerHTML =
      '<button type="button" class="trk-link" id="trkBack">\u2190 Back</button>' +
      '<h4>Checkout</h4>' +
      c.map(function (r) { return '<div class="trk-line"><span>' + esc(r.dress_name) + ' \u00B7 ' + esc(niceDate(r.event_date)) + '</span><b>' + peso(r.amount) + '</b></div>'; }).join('') +
      '<div class="trk-total"><span>Total</span><strong>' + peso(sumOf(c)) + '</strong></div>' +
      '<p class="trk-sub" style="margin-top:12px">How would you like to pay?</p>' +
      '<div class="trk-ms">' +
        '<button type="button" class="trk-m" data-m="cash">Cash</button>' +
        '<button type="button" class="trk-m" data-m="gcash">GCash</button>' +
        '<button type="button" class="trk-m" data-m="bank">Bank transfer</button>' +
      '</div><div id="trkMethod"></div>';
  }

  function qrs(list) {
    return list.map(function (q) {
      return '<figure class="trk-qr"><img src="' + esc(q.img) + '" alt="' + esc(q.name) + ' QR code" ' +
        'onerror="this.outerHTML=\'<p class=trk-err>QR image not found: ' + esc(q.img) + '</p>\'">' +
        '<figcaption>' + esc(q.name) + (q.details ? '<small>' + esc(q.details) + '</small>' : '') + '</figcaption></figure>';
    }).join('');
  }

  function showMethod(m) {
    method = m; proof = null;
    var total = sumOf(chosen()), box = $('#trkMethod');
    Array.prototype.forEach.call(document.querySelectorAll('.trk-m'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-m') === m);
    });
    if (m === 'cash') {
      box.innerHTML = '<p class="trk-sub" style="margin-top:14px">' + esc(PAY.cash) + '</p>' +
        '<div id="trkMsg"></div><button type="button" class="trk-btn" id="trkSend">I will pay in cash</button>';
      return;
    }
    box.innerHTML =
      '<p class="trk-sub" style="margin-top:14px">Scan ' + (PAY[m].length > 1 ? 'one of the QR codes' : 'the QR code') + ' and pay <b>' + peso(total) + '</b>. ' +
      'Then upload a screenshot of your payment.</p>' + qrs(PAY[m]) +
      '<label>Screenshot of your payment<input type="file" id="trkProof" accept="image/*"></label>' +
      '<img id="trkPrev" class="trk-prev" alt="" hidden>' +
      '<label>Reference number (optional)<input id="trkRef" maxlength="60" autocomplete="off"></label>' +
      '<div id="trkMsg"></div><button type="button" class="trk-btn" id="trkSend">Send proof of payment</button>';
  }

  function shrink(file) {
    return new Promise(function (res) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  }

  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.ok) return r.status === 204 ? null : r.json().catch(function () { return null; });
      return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || ('Error ' + r.status)); });
    });
  }

  function upload(blob) {
    var path = 'proof/' + rid() + '.jpg';
    return fetch(SUPABASE_URL + '/storage/v1/object/payment-proofs/' + path, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'false' },
      body: blob
    }).then(function (r) {
      if (!r.ok) throw new Error('Could not upload your screenshot. Please try again.');
      return path;
    });
  }

  function say(html) { var m = $('#trkMsg'); if (m) m.innerHTML = html; }

  function sendPay() {
    var btn = $('#trkSend'), ids = chosen().map(function (r) { return r.booking_id; }), who = $('#trkWho').value.trim();
    if (!method) { say('<p class="trk-err">Please choose how you want to pay.</p>'); return; }
    if (method !== 'cash' && !proof) { say('<p class="trk-err">Please choose the screenshot of your payment.</p>'); return; }
    if (!ids.length) { say('<p class="trk-err">Nothing selected to pay.</p>'); return; }
    btn.disabled = true; btn.textContent = 'Sending\u2026'; say('');

    var getPath = method === 'cash' ? Promise.resolve(null) : shrink(proof).then(upload);
    getPath.then(function (path) {
      return rpc('submit_payment', {
        p_who: who, p_booking_ids: ids, p_method: method,
        p_reference: (($('#trkRef') || {}).value || '').trim() || null, p_proof_path: path
      });
    }).then(showDone).catch(function (e) {
      btn.disabled = false;
      btn.textContent = method === 'cash' ? 'I will pay in cash' : 'Send proof of payment';
      say('<p class="trk-err">' + esc(e.message) + '</p>');
    });
  }

  function showDone() {
    stage = 'done';
    var cash = method === 'cash';
    $('#trkOut').innerHTML =
      '<div class="trk-thanks"><h4>Thank you!</h4>' +
      (cash
        ? '<p>We noted that you will pay in cash.</p><p>Please bring your payment when you fit or pick up your dress. We will mark it as paid once we receive it.</p>'
        : '<p>We received your proof of payment.</p><p>We will check it and confirm your payment soon. You can come back here any time to see the status.</p>') +
      '<p>We cannot wait to see you slay your special day.</p></div>' +
      '<button type="button" class="trk-btn" id="trkAgain">Back to my bookings</button>';
  }

  /* ---------- lookup ---------- */
  function stopPoll() { if (timer) { clearInterval(timer); timer = null; } }
  function startPoll() {
    if (timer) return;
    timer = setInterval(function () { if (dlg.open) go(true); else stopPoll(); }, 30000);
  }

  function go(quiet) {
    if (quiet && stage !== 'list') return;               // never disturb someone who is paying
    var who = $('#trkWho').value.trim(), out = $('#trkOut');
    if (who.length < 5) { out.innerHTML = '<p class="trk-err">Please enter the mobile number, Facebook name or email you used.</p>'; return; }
    if (!quiet) out.innerHTML = '<p class="trk-wait">Checking\u2026</p>';

    rpc('track_my_bookings', { p_who: who })
      .then(function (data) {
        rows = data || [];
        if (!rows.length) {
          out.innerHTML = '<p class="trk-err">We could not find a booking with that contact. Please check and try again.</p>';
          stopPoll();
          return;
        }
        rows.forEach(function (r) { if (payable(r) && sel[r.booking_id] === undefined) sel[r.booking_id] = true; });
        try { localStorage.setItem('slay_track', JSON.stringify({ who: who })); } catch (e) {}
        if (stage === 'list') showList();
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
    stage = 'list'; $('#trkForm').hidden = false;
    $('#trkWho').value = saved.who || '';
    $('#trkOut').innerHTML = '';
    if (!dlg.open) dlg.showModal();
    if ($('#trkWho').value) go(); else $('#trkWho').focus();
  }

  /* ---------- events ---------- */
  $('#trkForm').addEventListener('submit', function (e) { e.preventDefault(); stage = 'list'; go(); });
  dlg.querySelector('.trk-x').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', stopPoll);

  $('#trkOut').addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-pick');
    if (id) { sel[id] = e.target.checked; showList(); return; }
    if (e.target.id === 'trkProof') {
      proof = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      var pv = $('#trkPrev');
      if (proof && pv) { pv.src = URL.createObjectURL(proof); pv.hidden = false; } else if (pv) { pv.hidden = true; }
    }
  });
  $('#trkOut').addEventListener('click', function (e) {
    var t = e.target, m = t.closest && t.closest('[data-m]');
    if (m) { showMethod(m.getAttribute('data-m')); return; }
    if (t.closest('#trkCheckout')) { showPay(); return; }
    if (t.closest('#trkBack')) { showList(); return; }
    if (t.closest('#trkSend')) { sendPay(); return; }
    if (t.closest('#trkAgain')) { stage = 'list'; sel = {}; go(); return; }
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.js-track');
    if (a) { e.preventDefault(); open(); }
  });

  window.SlayTrack = { open: open };
  if (location.hash === '#track') open();
})();