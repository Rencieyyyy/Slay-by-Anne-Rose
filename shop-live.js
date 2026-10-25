/* Slay by Anne&Rose: shows the products from Supabase in the shop.
   Used at the bottom of index.html:  <script src="shop-live.js?v=10"></script>
   It builds the cards first, then loads script.js and favcart.js so the
   slider, hearts, filters, search and cart all work on the new cards too.
   Items marked "For sale" show under the "For Sale" tab AND under their
   normal tab (Long Dress, Bag, ...) with a Buy Now button. Buy Now uses the same cart as Rent Now.
   Also opens the rental policy popup (the ? button). */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rkwslciojefeouznmydb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_1yb-fa3isea2tDsnnqhEPw_wJPIQ1Ro';

  var grid = document.querySelector('.shop-grid');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(c) { return String(c || '').toLowerCase().trim().replace(/\s+/g, '-'); }

  function loadScript(src, done) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = s.onerror = function () { if (done) done(); };
    document.body.appendChild(s);
  }

  /* The "For Sale" tab shows every item marked for sale, whatever its category.
     This runs after script.js has set up the other tabs, so it has the last word. */
  function saleTab() {
    var tabs = document.querySelectorAll('.shop-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        if (tab.dataset.filter !== 'for-sale') return;
        var items = document.querySelectorAll('.shop-grid .product');
        Array.prototype.forEach.call(items, function (p) {
          p.hidden = !p.hasAttribute('data-sale');
        });
      });
    });
  }

  function boot() {
    loadScript('script.js?v=7', function () {
      saleTab();
      loadScript('favcart.js?v=13');
    });
  }

  /* ---------- For Sale: styles + Buy Now ---------- */
  var st = document.createElement('style');
  st.textContent =
    '.sale-btn{background:#D81B8A;color:#fff;padding:10px 18px;font-size:.7rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;border-bottom:2px solid #D4AF37;cursor:pointer;transition:background .25s;text-decoration:none}' +
    '.sale-btn:hover{background:#6B1D70}' +
    '.policy-fab{position:fixed!important;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:90}' +
    '@media (max-width:600px){.sale-btn{width:100%;padding:9px 10px;font-size:.62rem;letter-spacing:.1em;text-align:center}}';
  document.head.appendChild(st);

  /* ---------- Rental policy "?" button ---------- */
  (function () {
    var fab = document.getElementById('policyFab');
    var pm = document.getElementById('policyModal');
    if (!fab || !pm) return;
    fab.addEventListener('click', function () { if (!pm.open) pm.showModal(); });
    var x = pm.querySelector('.policy-close');
    if (x) x.addEventListener('click', function () { pm.close(); });
    pm.addEventListener('click', function (e) { if (e.target === pm) pm.close(); });
  })();

  if (!grid) { boot(); return; }

  /* Remember the photos of the cards already in index.html, so products that
     have no uploaded photo yet keep their current pictures. */
  var old = {};
  Array.prototype.forEach.call(grid.querySelectorAll('.product'), function (c) {
    var h = c.querySelector('h3');
    if (!h) return;
    old[h.textContent.trim().toLowerCase()] = {
      imgs: Array.prototype.map.call(c.querySelectorAll('.product-img > img'), function (i) { return i.getAttribute('src'); }),
      worn: (c.querySelector('.product-worn') || {}).textContent || ''
    };
  });

  function card(d) {
    var sale = d.listing === 'Sale';
    var o = old[String(d.name).trim().toLowerCase()] || {};
    var imgs = (d.photos && d.photos.length) ? d.photos
             : (o.imgs && o.imgs.length) ? o.imgs
             : ['dressing.png'];
    var size = (d.bust && d.waist) ? 'Bust - ' + d.bust + ' Waist - ' + d.waist + '  ' : '';
    /* data-category is always the real category, so a sale item also shows
       under Long Dress, Bag, etc. data-sale is what the For Sale tab uses. */
    return '<article class="product" data-category="' + esc(slug(d.category)) + '"' + (sale ? ' data-sale="1"' : '') + '>' +
      '<div class="product-img">' +
        imgs.map(function (u, i) {
          return '<img src="' + esc(u) + '" alt="' + esc(d.name) + '" data-color="Photo ' + (i + 1) + '" loading="lazy">';
        }).join('') +
        '<span class="product-tag">' + (sale ? 'For Sale' : esc(d.category)) + '</span>' +
      '</div>' +
      '<div class="product-info">' +
        '<h3>' + esc(d.name) + '</h3>' +
        '<p class="product-desc">' + esc(size + (d.description || '')) + '</p>' +
        (!sale && o.worn ? '<p class="product-worn">' + esc(o.worn) + '</p>' : '') +
        '<div class="product-bottom">' +
          '<span class="product-price">\u20B1' + Number(d.price || 0).toLocaleString('en-PH') + '</span>' +
          (sale ? '<a href="#" class="sale-btn">Buy Now</a>' : '<a href="#" class="product-btn">Rent Now</a>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  fetch(SUPABASE_URL + '/rest/v1/dresses?select=*&status=eq.Available&order=created_at.asc,name.asc', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (rows && rows.length) grid.innerHTML = rows.map(card).join('');
    })
    .catch(function (e) { console.error('Could not load products', e); })
    .then(boot);
})();