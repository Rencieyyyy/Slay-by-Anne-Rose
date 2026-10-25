/* Slay by Anne&Rose: favorites + cart (rent AND buy) + booking requests + search
   Loaded by shop-live.js after script.js.
   Rentals and purchases share ONE cart. Purchases have no event date and no deposit.
   The Track button lives in index.html and is handled by track.js. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rkwslciojefeouznmydb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_1yb-fa3isea2tDsnnqhEPw_wJPIQ1Ro';

  var KEY_F = 'slay_favs_v1';
  var KEY_C = 'slay_cart_v1';
  var MESSAGE_URL = 'https://www.facebook.com/share/1JVDcaen61/?mibextid=wwXIfr';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function peso(n) { return '\u20B1' + Number(n).toLocaleString('en-PH'); }
  function todayStr() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function niceDate(s) {
    if (!s) return '';
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-PH',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  var favs = load(KEY_F);
  var cart = load(KEY_C);
  var activeTab = 'favs';
  var draft = { name: '', contact: '', note: '' };
  var doneName = '';
  var doneContact = '';

  /* ---------- Cart helpers (rent vs buy) ---------- */
  function hasRental() { return cart.some(function (i) { return !i.sale; }); }
  function sendLabel() { return hasRental() ? 'Send booking request' : 'Send order request'; }

  /* ---------- Read product info from a card ---------- */
  function cardInfo(card) {
    var name = ($('h3', card) || {}).textContent || 'Item';
    name = name.trim();
    var priceTxt = ($('.product-price', card) || {}).textContent || '';
    var img = $('.product-img img', card);
    var desc = ($('.product-desc', card) || {}).textContent || '';
    var m = desc.match(/Bust\s*-\s*(\d+)\s*Waist\s*-\s*(\d+)/i);
    var cat = card.getAttribute('data-category') || 'item';
    return {
      id: cat + ':' + name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      price: parseInt(priceTxt.replace(/[^\d]/g, ''), 10) || 0,
      img: img ? img.getAttribute('src') : '',
      type: ($('.product-tag', card) || {}).textContent || cat,
      size: m ? 'Bust ' + m[1] + ', Waist ' + m[2] : '',
      sale: card.hasAttribute('data-sale')
    };
  }

  function findIn(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4000);
  }

  /* ---------- Drawer markup ---------- */
  function buildDrawer() {
    var wrap = document.createElement('div');
    wrap.className = 'fc-wrap';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="fc-overlay" data-fc="close"></div>' +
      '<aside class="fc-drawer" role="dialog" aria-modal="true" aria-label="Favorites and cart">' +
        '<div class="fc-head">' +
          '<div class="fc-tabs" role="tablist">' +
            '<button class="fc-tab" role="tab" data-fc-tab="favs">Favorites <span id="fcFavN">(0)</span></button>' +
            '<button class="fc-tab" role="tab" data-fc-tab="cart">My Cart <span id="fcCartN">(0)</span></button>' +
          '</div>' +
          '<button class="fc-close" data-fc="close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="fc-body" id="fcBody"></div>' +
        '<div class="fc-foot" id="fcFoot"></div>' +
      '</aside>';
    document.body.appendChild(wrap);
    return wrap;
  }
  var wrap = buildDrawer();

  function openDrawer(tab) {
    activeTab = tab || activeTab;
    wrap.hidden = false;
    document.body.classList.add('fc-lock');
    render();
  }
  function closeDrawer() {
    wrap.hidden = true;
    doneName = '';
    document.body.classList.remove('fc-lock');
  }

  /* ---------- Render ---------- */
  function itemRow(it, mode) {
    var inCart = findIn(cart, it.id) > -1;
    var actions = mode === 'favs'
      ? '<button class="fc-mini" data-fc="tocart" data-id="' + esc(it.id) + '"' + (inCart ? ' disabled' : '') + '>' +
          (inCart ? 'In cart' : 'Add to cart') + '</button>' +
        '<button class="fc-link" data-fc="rmfav" data-id="' + esc(it.id) + '">Remove</button>'
      : '<button class="fc-link" data-fc="rmcart" data-id="' + esc(it.id) + '">Remove</button>';
    return '<div class="fc-item">' +
      '<img src="' + esc(it.img) + '" alt="' + esc(it.name) + '">' +
      '<div class="fc-info">' +
        '<strong>' + esc(it.name) + '</strong>' +
        '<span class="fc-type">' + esc(it.type) + '</span>' +
        (it.size ? '<span class="fc-size">' + esc(it.size) + '</span>' : '') +
        '<span class="fc-price">' + peso(it.price) + '</span>' +
        '<div class="fc-actions">' + actions + '</div>' +
      '</div>' +
    '</div>';
  }

  function render() {
    $('#fcFavN').textContent = '(' + favs.length + ')';
    $('#fcCartN').textContent = '(' + cart.length + ')';
    $$('.fc-tab', wrap).forEach(function (b) {
      var on = b.getAttribute('data-fc-tab') === activeTab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    var body = $('#fcBody'), foot = $('#fcFoot');

    if (activeTab === 'favs') {
      body.innerHTML = favs.length
        ? favs.map(function (i) { return itemRow(i, 'favs'); }).join('')
        : '<p class="fc-empty">No favorites yet.<br>Tap the heart on any dress to save it here.</p>';
      foot.innerHTML = favs.length
        ? '<button class="fc-btn" data-fc="allToCart">Add all to cart</button>'
        : '';
    } else if (doneName) {
      body.innerHTML = '<p class="fc-empty"><b>Request sent. Thank you, ' + esc(doneName) + '!</b><br>' +
        'We will check availability (and your event date for rentals). Tap <b>Track my booking</b> any time to see if it is accepted or declined.</p>';
      foot.innerHTML = '<button class="fc-btn" data-fc="tracknow">Track my booking</button>' +
        '<button class="fc-link fc-clear" data-fc="close">Back to shop</button>';
    } else {
      body.innerHTML = cart.length
        ? cart.map(function (i) { return itemRow(i, 'cart'); }).join('')
        : '<p class="fc-empty">Your cart is empty.<br>Tap <b>Rent Now</b> or <b>Buy Now</b> to add an item.</p>';
      if (cart.length) {
        var total = cart.reduce(function (s, i) { return s + i.price; }, 0);
        var rental = hasRental();
        var mixed = rental && cart.some(function (i) { return i.sale; });
        var date = '';
        try { date = localStorage.getItem('slay_date') || ''; } catch (e) {}
        if (date && date < todayStr()) { date = ''; try { localStorage.removeItem('slay_date'); } catch (e) {} }
        foot.innerHTML =
          (rental
            ? '<label class="fc-date">Event date <input type="date" id="fcDate" min="' + todayStr() + '" value="' + esc(date) + '">' +
                '<small class="fc-datehint" id="fcDateHint">' + (date ? esc(niceDate(date)) : 'Format: day / month / year') + '</small></label>'
            : '') +
          (mixed ? '<small class="fc-datehint">The event date is for your rentals. Items for sale are a purchase.</small>' : '') +
          '<label class="fc-field">Your name <input id="fcName" maxlength="100" autocomplete="name" value="' + esc(draft.name) + '"></label>' +
          '<label class="fc-field">Mobile number or Facebook name <input id="fcContact" maxlength="100" autocomplete="tel" value="' + esc(draft.contact) + '"></label>' +
          '<label class="fc-field">Note (optional) <textarea id="fcNote" maxlength="450">' + esc(draft.note) + '</textarea></label>' +
          '<input id="fcHp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
          '<div class="fc-total"><span>' + (rental ? 'Estimated total' : 'Total') + '</span><strong>' + peso(total) + '</strong></div>' +
          '<button class="fc-btn" data-fc="book">' + sendLabel() + '</button>' +
          '<button class="fc-link fc-clear" data-fc="send">Or message us on Facebook instead</button>' +
          '<button class="fc-link fc-clear" data-fc="clear">Clear cart</button>';
      } else {
        foot.innerHTML = '';
      }
    }
  }

  /* ---------- State sync ---------- */
  function sync() {
    save(KEY_F, favs);
    save(KEY_C, cart);

    var fc = $('#favCount'), cc = $('#cartCount');
    if (fc) fc.textContent = '(' + favs.length + ')';
    if (cc) cc.textContent = '(' + cart.length + ')';
    var fb = $('#favBtn'), cb = $('#cartBtn');
    if (fb) fb.classList.toggle('on', favs.length > 0);
    if (cb) cb.classList.toggle('on', cart.length > 0);

    $$('.product').forEach(function (card) {
      var info = cardInfo(card);
      var heart = $('.fav-btn', card);
      if (heart) {
        var isFav = findIn(favs, info.id) > -1;
        heart.classList.toggle('on', isFav);
        heart.setAttribute('aria-pressed', isFav ? 'true' : 'false');
        heart.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
      }
      var btn = $('.product-btn, .sale-btn', card);
      if (btn) {
        var inCart = findIn(cart, info.id) > -1;
        btn.textContent = inCart ? 'In Cart \u2713' : (info.sale ? 'Buy Now' : 'Rent Now');
      }
    });

    if (!wrap.hidden) render();
  }

  /* ---------- Actions ---------- */
  function toggleFav(card) {
    var info = cardInfo(card), i = findIn(favs, info.id);
    if (i > -1) { favs.splice(i, 1); toast('Removed from favorites'); }
    else { favs.push(info); toast('Saved to favorites \u2665'); }
    sync();
  }

  function addToCart(info, silent) {
    if (findIn(cart, info.id) > -1) return false;
    cart.push(info);
    if (!silent) toast(info.name + ' added to cart');
    return true;
  }

  function buildMessage() {
    var date = '';
    try { date = localStorage.getItem('slay_date') || ''; } catch (e) {}
    var total = 0;
    function line(i) {
      total += i.price;
      return '- ' + i.name + ' (' + i.type + (i.size ? ', ' + i.size : '') + ') - ' + peso(i.price);
    }
    var rent = cart.filter(function (i) { return !i.sale; });
    var buy = cart.filter(function (i) { return i.sale; });
    var parts = [];
    if (rent.length) parts.push('I would like to rent:\n' + rent.map(line).join('\n'));
    if (buy.length) parts.push('I would like to buy:\n' + buy.map(line).join('\n'));
    return 'Hi Slay by Anne&Rose! ' + parts.join('\n\n') +
      '\nEstimated total: ' + peso(total) +
      (rent.length && date ? '\nEvent date: ' + niceDate(date) : '') +
      '\nIs it available?';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- Booking request -> Supabase ---------- */
  function dressIds() {
    return fetch(SUPABASE_URL + '/rest/v1/dresses?select=id,name', { headers: { apikey: SUPABASE_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var map = {};
        rows.forEach(function (d) { map[String(d.name).toLowerCase()] = d.id; });
        return map;
      })
      .catch(function () { return {}; });
  }

  function submitBooking(btn) {
    if (($('#fcHp') || {}).value) return;
    if (!cart.length) return;

    var rental = hasRental();
    var date = '';
    try { date = localStorage.getItem('slay_date') || ''; } catch (e) {}
    var name = draft.name.trim(), contact = draft.contact.trim(), note = draft.note.trim();

    if (rental) {
      if (!date) { toast('Please choose your event date'); $('#fcDate').focus(); return; }
      if (date < todayStr()) { toast(niceDate(date) + ' has already passed. Please pick a future date.'); $('#fcDate').focus(); return; }
    }
    if (name.length < 2) { toast('Please enter your name'); $('#fcName').focus(); return; }
    if (contact.length < 5) { toast('Please enter your mobile number or Facebook name'); $('#fcContact').focus(); return; }

    var last = 0;
    try { last = parseInt(localStorage.getItem('slay_last_booking'), 10) || 0; } catch (e) {}
    if (Date.now() - last < 30000) { toast('Please wait a moment before sending again'); return; }

    btn.disabled = true;
    btn.textContent = 'Sending\u2026';

    dressIds().then(function (ids) {
      var rows = cart.map(function (i) {
        return {
          dress_id: ids[i.name.toLowerCase()] || null,
          dress_name: i.name,
          customer: name,
          contact: contact,
          /* a purchase has no event: today's date is only a placeholder */
          event_date: i.sale ? todayStr() : date,
          message: i.sale ? ('PURCHASE' + (note ? ' - ' + note : '')).slice(0, 500) : (note || null)
        };
      });
      return fetch(SUPABASE_URL + '/rest/v1/bookings', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(rows)
      });
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + ' ' + t); });
      try { localStorage.setItem('slay_last_booking', String(Date.now())); } catch (e) {}
      doneName = name;
      doneContact = contact;
      draft.note = '';
      cart = [];
      sync();
    }).catch(function (err) {
      console.error('Booking error:', err);
      toast('Could not send: ' + String(err.message).slice(0, 140));
      btn.disabled = false;
      btn.textContent = sendLabel();
    });
  }

  /* ---------- Click handling ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    var heart = t.closest('.fav-btn');
    if (heart) {
      var card = heart.closest('.product');
      if (card) { e.preventDefault(); e.stopImmediatePropagation(); toggleFav(card); }
      return;
    }

    /* Rent Now and Buy Now both go into the same cart */
    var rent = t.closest('.product-btn, .sale-btn');
    if (rent) {
      var c = rent.closest('.product');
      if (c) {
        e.preventDefault(); e.stopImmediatePropagation();
        doneName = '';
        addToCart(cardInfo(c), true);
        sync();
        openDrawer('cart');
      }
      return;
    }

    if (t.closest('#favBtn')) { e.preventDefault(); e.stopImmediatePropagation(); openDrawer('favs'); return; }
    if (t.closest('#cartBtn')) { e.preventDefault(); e.stopImmediatePropagation(); openDrawer('cart'); return; }

    var tab = t.closest('[data-fc-tab]');
    if (tab) { activeTab = tab.getAttribute('data-fc-tab'); render(); return; }

    var ctl = t.closest('[data-fc]');
    if (!ctl || !wrap.contains(ctl)) return;
    var act = ctl.getAttribute('data-fc'), id = ctl.getAttribute('data-id');

    if (act === 'close') closeDrawer();
    else if (act === 'rmfav') { var a = findIn(favs, id); if (a > -1) favs.splice(a, 1); sync(); }
    else if (act === 'rmcart') { var b = findIn(cart, id); if (b > -1) cart.splice(b, 1); sync(); }
    else if (act === 'tocart') {
      var f = favs[findIn(favs, id)];
      if (f && addToCart(f)) sync();
    }
    else if (act === 'allToCart') {
      var n = 0;
      favs.forEach(function (f) { if (addToCart(f, true)) n++; });
      toast(n ? n + ' added to cart' : 'Everything is already in your cart');
      sync();
    }
    else if (act === 'clear') { cart = []; sync(); }
    else if (act === 'book') { submitBooking(ctl); }
    else if (act === 'tracknow') {
      try { localStorage.setItem('slay_track', JSON.stringify({ who: doneContact })); } catch (e) {}
      closeDrawer();
      if (window.SlayTrack) window.SlayTrack.open();
    }
    else if (act === 'send') {
      var msg = buildMessage();
      window.open(MESSAGE_URL, '_blank', 'noopener');
      copyText(msg);
      toast('List copied! Paste it in the message.');
    }
  }, true);

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'fcDate') {
      var v = e.target.value, hint = $('#fcDateHint');
      var past = v && v < todayStr();
      if (hint) {
        hint.textContent = !v ? 'Format: day / month / year'
          : past ? niceDate(v) + ' (already passed)' : niceDate(v);
        hint.classList.toggle('bad', !!past);
      }
      try {
        if (past || !v) localStorage.removeItem('slay_date');
        else localStorage.setItem('slay_date', v);
      } catch (err) {}
    }
  });

  document.addEventListener('input', function (e) {
    var id = e.target && e.target.id;
    if (id === 'fcName') draft.name = e.target.value;
    else if (id === 'fcContact') draft.contact = e.target.value;
    else if (id === 'fcNote') draft.note = e.target.value;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !wrap.hidden) closeDrawer();
  });

  /* ---------- Search + category filter (work together) ---------- */
  function activeFilter() {
    var t = $('.shop-tab.active');
    return t ? t.getAttribute('data-filter') : 'all';
  }

  function applyFilters() {
    var qEl = $('#q');
    var words = (qEl ? qEl.value : '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    var filter = activeFilter();
    var shown = 0;

    $$('.product').forEach(function (card) {
      /* "For Sale" shows every sale item; other tabs match the real category */
      var okCat = filter === 'all'
        || (filter === 'for-sale' ? card.hasAttribute('data-sale') : card.getAttribute('data-category') === filter);
      var text = card.textContent.toLowerCase();
      var okText = words.every(function (w) { return text.indexOf(w) > -1; });
      var show = okCat && okText;
      card.hidden = !show;
      if (show) shown++;
    });

    var msg = $('#shopEmpty');
    if (!msg) {
      msg = document.createElement('p');
      msg.id = 'shopEmpty';
      msg.className = 'shop-sub';
      msg.style.textAlign = 'center';
      msg.style.marginTop = '24px';
      var grid = $('.shop-grid');
      if (grid && grid.parentNode) grid.parentNode.insertBefore(msg, grid.nextSibling);
    }
    msg.hidden = shown > 0;
    msg.textContent = shown > 0 ? '' : (activeFilter() === 'for-sale' && !words.length
      ? 'Nothing for sale right now. Check back soon!'
      : 'No dresses found. Try another word or clear the search.');
  }

  function initSearch() {
    var qEl = $('#q'), form = $('#search');
    if (qEl) qEl.addEventListener('input', applyFilters);
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        applyFilters();
        var shop = $('#shop');
        if (shop && qEl && qEl.value.trim()) shop.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    /* runs after script.js's own tab handler, so the active tab is already updated */
    $$('.shop-tab').forEach(function (tab) {
      tab.addEventListener('click', applyFilters);
    });
  }

  /* ---------- Init ---------- */
  function init() {
    $$('.product').forEach(function (card) {
      var box = $('.product-img', card);
      if (box && !$('.fav-btn', box)) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fav-btn';
        b.setAttribute('aria-label', 'Add to favorites');
        b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.1-8 11-8 11Z"/></svg>';
        box.appendChild(b);
      }
    });
    initSearch();
    sync();
  }
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();