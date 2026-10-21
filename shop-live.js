/* Slay by Anne&Rose: shows the dresses from Supabase in the shop.
   Replaces the two script tags at the bottom of index.html:
     <script src="shop-live.js?v=7"></script>
   It builds the cards first, then loads script.js and favcart.js so the
   slider, hearts, filters, search and cart all work on the new cards too. */
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
  function boot() {
    loadScript('script.js?v=7', function () { loadScript('favcart.js?v=11'); });
  }

  if (!grid) { boot(); return; }

  /* Remember the photos of the cards already in index.html, so dresses that
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
    var o = old[String(d.name).trim().toLowerCase()] || {};
    var imgs = (d.photos && d.photos.length) ? d.photos
             : (o.imgs && o.imgs.length) ? o.imgs
             : ['dressing.png'];
    var size = (d.bust && d.waist) ? 'Bust - ' + d.bust + ' Waist - ' + d.waist + '  ' : '';
    return '<article class="product" data-category="' + esc(slug(d.category)) + '">' +
      '<div class="product-img">' +
        imgs.map(function (u, i) {
          return '<img src="' + esc(u) + '" alt="' + esc(d.name) + '" data-color="Photo ' + (i + 1) + '" loading="lazy">';
        }).join('') +
        '<span class="product-tag">' + esc(d.category) + '</span>' +
      '</div>' +
      '<div class="product-info">' +
        '<h3>' + esc(d.name) + '</h3>' +
        '<p class="product-desc">' + esc(size + (d.description || '')) + '</p>' +
        (o.worn ? '<p class="product-worn">' + esc(o.worn) + '</p>' : '') +
        '<div class="product-bottom">' +
          '<span class="product-price">\u20B1' + Number(d.price || 0).toLocaleString('en-PH') + '</span>' +
          '<a href="#" class="product-btn">Rent Now</a>' +
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
    .catch(function (e) { console.error('Could not load dresses', e); })
    .then(boot);
})();