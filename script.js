(function(){
  var nav=document.getElementById('nav'),menuBtn=document.getElementById('menuBtn'),
      search=document.getElementById('search'),searchBtn=document.getElementById('searchBtn'),
      q=document.getElementById('q'),toast=document.getElementById('toast'),t;
  var state={cart:0,favs:0};

  function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(t);t=setTimeout(function(){toast.classList.remove('show')},1800)}
  function render(){
    document.getElementById('cartCount').textContent='('+state.cart+')';
    document.getElementById('favCount').textContent='('+state.favs+')';
    document.getElementById('favBtn').classList.toggle('on',state.favs>0);
  }

  menuBtn.addEventListener('click',function(){
    var o=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',o);
    menuBtn.setAttribute('aria-label',o?'Close menu':'Open menu');
    search.classList.remove('open');searchBtn.setAttribute('aria-expanded','false');
  });
  searchBtn.addEventListener('click',function(){
    var o=search.classList.toggle('open');searchBtn.setAttribute('aria-expanded',o);
    nav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');
    if(o)q.focus();
  });
  nav.addEventListener('click',function(e){if(e.target.closest('a'))nav.classList.remove('open')});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){nav.classList.remove('open');search.classList.remove('open')}
  });
  window.addEventListener('resize',function(){if(innerWidth>1080){nav.classList.remove('open');search.classList.remove('open')}});

  search.addEventListener('submit',function(){
    if(q.value.trim())say('Searching for “'+q.value.trim()+'”');
  });

  // Hooks for your product cards:
  //   Slay.addToCart()   -> cart count +1
  //   Slay.toggleFav(on) -> favorites count +1 / -1 (pass true when adding, false when removing)
  window.Slay={
    addToCart:function(){state.cart++;render();say('Added to cart')},
    toggleFav:function(on){state.favs=Math.max(0,state.favs+(on?1:-1));render();say(on?'Saved to favorites':'Removed from favorites')}
  };
  document.getElementById('cartBtn').addEventListener('click',function(){say(state.cart?state.cart+' item(s) in your cart':'Your cart is empty')});
  document.getElementById('favBtn').addEventListener('click',function(){say(state.favs?state.favs+' saved dress(es)':'No favorites yet')});
})();
// Scroll reveal for the About section
(function(){
  var items=document.querySelectorAll('.about-media, .about-copy > *, .about-points li');
  if(!('IntersectionObserver' in window)){
    items.forEach(function(el){el.classList.add('reveal','in')});
    return;
  }
  items.forEach(function(el,i){
    el.classList.add('reveal');
    el.style.transitionDelay=(el.closest('.about-copy')?(i*90):0)+'ms';
  });
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}
    });
  },{threshold:.15,rootMargin:'0px 0px -8% 0px'});
  items.forEach(function(el){io.observe(el)});
})();
/* ---------- Shop filter ---------- */
(function(){
  const tabs = document.querySelectorAll('.shop-tab');
  const items = document.querySelectorAll('.product');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.filter;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      items.forEach(item => {
        item.hidden = !(filter === 'all' || item.dataset.category === filter);
      });
    });
  });
})();
/* ---------- Footer year ---------- */
document.getElementById('year').textContent = new Date().getFullYear();
/* ---------- Product slider + viewer ---------- */
(function(){
  // Build the viewer once
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Product photos');
  lb.innerHTML =
    '<button class="lb-close" aria-label="Close">&times;</button>' +
    '<button class="lb-nav lb-prev" aria-label="Previous color">&#8249;</button>' +
    '<div class="lb-stage"><img class="lb-img" alt=""><p class="lb-caption"></p><div class="lb-thumbs"></div></div>' +
    '<button class="lb-nav lb-next" aria-label="Next color">&#8250;</button>';
  document.body.appendChild(lb);

  const lbImg = lb.querySelector('.lb-img');
  const lbCap = lb.querySelector('.lb-caption');
  const lbThumbs = lb.querySelector('.lb-thumbs');
  const lbPrev = lb.querySelector('.lb-prev');
  const lbNext = lb.querySelector('.lb-next');
  const stage = lb.querySelector('.lb-stage');

  let list = [];
  let idx = 0;
  let lastFocus = null;

  function render(){
    const item = list[idx];
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth;
    lbImg.style.animation = '';
    lbImg.src = item.src;
    lbImg.alt = item.alt;
    lbCap.textContent = item.color + (list.length > 1 ? '  (' + (idx + 1) + '/' + list.length + ')' : '');
    lbThumbs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === idx));
  }

  function openViewer(items, start){
    list = items;
    idx = start;
    lastFocus = document.activeElement;
    lbThumbs.innerHTML = '';
    const multi = list.length > 1;
    lbPrev.hidden = !multi;
    lbNext.hidden = !multi;
    if (multi){
      list.forEach((item, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', item.color);
        b.innerHTML = '<img src="' + item.src + '" alt="">';
        b.addEventListener('click', () => { idx = i; render(); });
        lbThumbs.appendChild(b);
      });
    }
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
    lb.querySelector('.lb-close').focus();
  }

  function closeViewer(){
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  function step(n){
    if (list.length < 2) return;
    idx = (idx + n + list.length) % list.length;
    render();
  }

  lb.querySelector('.lb-close').addEventListener('click', closeViewer);
  lbPrev.addEventListener('click', () => step(-1));
  lbNext.addEventListener('click', () => step(1));
  lb.addEventListener('click', e => { if (e.target === lb) closeViewer(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // Swipe inside the viewer
  let startX = 0;
  stage.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  });

  // Build the slider on every product card
  document.querySelectorAll('.product-img').forEach(box => {
    const imgs = Array.from(box.querySelectorAll(':scope > img'));
    if (!imgs.length) return;

    const items = imgs.map((img, i) => ({
      src: img.getAttribute('src'),
      alt: img.alt,
      color: img.dataset.color || ('Photo ' + (i + 1))
    }));

    const slides = document.createElement('div');
    slides.className = 'slides';
    imgs.forEach((img, i) => {
      slides.appendChild(img);
      img.addEventListener('click', () => openViewer(items, i));
    });
    box.insertBefore(slides, box.firstChild);

    if (imgs.length < 2) return;

    const label = document.createElement('span');
    label.className = 'color-label';
    label.textContent = items[0].color;
    box.appendChild(label);

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'slide-arrow slide-prev';
    prev.setAttribute('aria-label', 'Previous color');
    prev.innerHTML = '&#8249;';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'slide-arrow slide-next';
    next.setAttribute('aria-label', 'Next color');
    next.innerHTML = '&#8250;';
    box.appendChild(prev);
    box.appendChild(next);

    const dots = document.createElement('div');
    dots.className = 'slide-dots';
    items.forEach((item, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', item.color);
      d.addEventListener('click', () => slides.scrollTo({left: i * slides.clientWidth, behavior: 'smooth'}));
      dots.appendChild(d);
    });
    box.appendChild(dots);

    function sync(){
      const i = Math.round(slides.scrollLeft / slides.clientWidth);
      dots.querySelectorAll('button').forEach((d, n) => d.classList.toggle('on', n === i));
      label.textContent = items[i] ? items[i].color : '';
    }
    slides.addEventListener('scroll', sync, {passive:true});
    sync();

    prev.addEventListener('click', () => slides.scrollBy({left: -slides.clientWidth, behavior: 'smooth'}));
    next.addEventListener('click', () => slides.scrollBy({left: slides.clientWidth, behavior: 'smooth'}));
  });
})();
/* ---------- Favorite hearts ---------- */
(function(){
  document.querySelectorAll('.product').forEach(function(card){
    var box = card.querySelector('.product-img');
    if (!box) return;

    var name = card.querySelector('h3') ? card.querySelector('h3').textContent : 'item';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Add ' + name + ' to favorites');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.1-8 11-8 11Z"/></svg>';
    box.appendChild(btn);

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on);
      btn.setAttribute('aria-label', (on ? 'Remove ' : 'Add ') + name + (on ? ' from favorites' : ' to favorites'));

      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');

      if (window.Slay) window.Slay.toggleFav(on);
    });
  });
})();