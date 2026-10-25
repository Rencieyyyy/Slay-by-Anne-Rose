(function () {
  'use strict';

  const sb = supabase.createClient(
    'https://rkwslciojefeouznmydb.supabase.co',
    'sb_publishable_1yb-fa3isea2tDsnnqhEPw_wJPIQ1Ro'
  );

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = (n) => '\u20B1' + Number(n || 0).toLocaleString('en-PH');
  const fd = (d) => d ? new Date(d + 'T00:00').toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const dt = (d) => new Date(d).toLocaleString('en-PH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const MAX_PHOTOS = 10;
  const TABS = ['Overview', 'Bookings', 'Payments', 'Products', 'Rentals', 'Activity'];
  let tab = 'Overview', bf = 'Pending', items = [], loadT;   // items = photos in the dress form: {url, file?}
  let D = { b: [], d: [], r: [], l: [], p: [] };
  let SALE = new Set();                                      // ids of products listed For Sale
  const isSaleDress = (id) => !!id && SALE.has(id);
  const isSale = (r) => isSaleDress(r.dress_id);
  const dlg = $('#dlg');

  function toast(m) {
    const t = $('#toast');
    t.textContent = m; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 4500);
  }

  /* ---------------- login ---------------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = $('#lb'), er = $('#lerr');
    er.textContent = ''; b.disabled = true; b.textContent = 'LOGGING IN…';
    const { error } = await sb.auth.signInWithPassword({ email: $('#lu').value.trim(), password: $('#lp').value });
    b.disabled = false; b.textContent = 'LOG IN';
    if (error) {
      er.textContent = error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message;
      return;
    }
    boot();
  });
  $('#sp').addEventListener('click', () => {
    const i = $('#lp'), hide = i.type === 'password';
    i.type = hide ? 'text' : 'password';
    $('#sp').textContent = hide ? 'Hide' : 'Show';
  });
  $('#logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const { data: p } = await sb.from('profiles').select('name,role').maybeSingle();
    if (!p) {
      await sb.auth.signOut();
      $('#lerr').textContent = 'This account is not an admin yet. Run STEP 8 of supabase-setup.sql with this email.';
      return;
    }
    $('#whoName').textContent = p.name;
    $('#whoRole').textContent = p.role;
    $('#login').hidden = true;
    $('#app').hidden = false;
    await load();
    live();
  }

  async function load() {
    const [b, d, r, l, p] = await Promise.all([
      sb.from('bookings').select('*').order('created_at', { ascending: false }),
      sb.from('dresses').select('*').order('name'),
      sb.from('rentals').select('*').order('event_date', { ascending: false }),
      sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(60),
      sb.from('payments').select('*').order('created_at', { ascending: false }).limit(300)
    ]);
    const err = b.error || d.error || r.error || l.error || p.error;
    if (err) toast('Load error: ' + err.message);
    D = { b: b.data || [], d: d.data || [], r: r.data || [], l: l.data || [], p: p.data || [] };
    SALE = new Set(D.d.filter((x) => x.listing === 'Sale').map((x) => x.id));
    render();
  }

  function live() {
    const ch = sb.channel('slay-live');
    ['bookings', 'rentals', 'dresses', 'activity_log', 'payments'].forEach((t) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        clearTimeout(loadT); loadT = setTimeout(load, 400);
      }));
    ch.subscribe((s) => $('#live').classList.toggle('on', s === 'SUBSCRIBED'));
  }

  /* ---------------- views ---------------- */
  function render() {
    const pend = D.b.filter((b) => b.status === 'Pending').length;
    const payPend = D.p.filter((x) => x.status === 'Submitted').length;
    $('#nav').innerHTML = TABS.map((t) =>
      `<button class="${t === tab ? 'on' : ''}" data-act="tab" data-t="${t}">${t}${t === 'Bookings' && pend ? ' (' + pend + ')' : ''}${t === 'Payments' && payPend ? ' (' + payPend + ')' : ''}</button>`).join('');
    $('#main').innerHTML = ({ Overview: vOverview, Bookings: vBookings, Payments: vPayments, Products: vDresses, Rentals: vRentals, Activity: vActivity })[tab]();
  }

  function vOverview() {
    const cnt = (s) => D.b.filter((b) => b.status === s).length;
    const sum = (a) => a.reduce((s, r) => s + Number(r.amount || 0), 0);
    const rent = D.r.filter((r) => !isSale(r));              // rentals only
    const sold = D.r.filter(isSale);                         // purchases only
    const live = rent.filter((r) => r.status !== 'Cancelled');
    const paid = rent.filter((r) => r.status === 'Paid' || r.status === 'Returned');
    const salesPaid = sold.filter((r) => r.status === 'Paid');
    const reserved = D.r.filter((r) => r.status === 'Reserved');
    const top = {}; live.forEach((r) => { top[r.dress_name] = (top[r.dress_name] || 0) + 1; });
    const topA = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const best = {};
    salesPaid.forEach((r) => { const o = best[r.dress_name] || (best[r.dress_name] = { n: 0, t: 0 }); o.n++; o.t += Number(r.amount || 0); });
    const bestA = Object.entries(best).sort((a, b) => b[1].n - a[1].n || b[1].t - a[1].t).slice(0, 6);
    const mon = {}; paid.concat(salesPaid).forEach((r) => { const k = r.event_date.slice(0, 7); mon[k] = (mon[k] || 0) + Number(r.amount || 0); });
    const monA = Object.entries(mon).sort().slice(-6);
    const mx = Math.max(1, ...monA.map((x) => x[1]));
    const allPaid = sum(paid) + sum(salesPaid);
    const card = (l, v) => `<div class="card"><span>${l}</span><strong>${v}</strong></div>`;
    return `<div class="printhead"><h2>Slay by Anne&amp;Rose report</h2><p>${new Date().toLocaleDateString('en-PH')}</p></div>
    <div class="top"><h2>Overview</h2><button class="btn ghost noprint" data-act="print">Print report</button></div>
    <div class="cards">
      ${card('Pending requests', cnt('Pending'))}${card('Accepted', cnt('Accepted'))}${card('Declined', cnt('Declined'))}
      ${card('Deposits held', peso(D.r.filter((x) => x.deposit_status === 'Paid').reduce((t, x) => t + Number(x.deposit_amount || 0), 0)))}${card('Late returns', D.r.filter((x) => x.return_status === 'Late').length)}${card('Payments to confirm', D.p.filter((x) => x.status === 'Submitted').length)}${card('Rental revenue (paid)', peso(sum(paid)))}${card('Sales (paid)', peso(sum(salesPaid)))}${card('Reserved, unpaid', peso(sum(reserved)))}${card('Products', D.d.length)}
    </div>
    <div class="panel"><h3>Most rented</h3>${topA.length
      ? `<table><thead><tr><th>Product</th><th class="r">Rentals</th></tr></thead><tbody>${topA.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="r">${c}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No rentals yet.</div>'}</div>
    <div class="panel"><h3>Most sold</h3>${bestA.length
      ? `<table><thead><tr><th>Product</th><th class="r">Sold</th><th class="r">Sales</th></tr></thead><tbody>${bestA.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r">${o.n}</td><td class="r">${peso(o.t)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No sales yet. A sale counts once its payment is confirmed.</div>'}</div>
    <div class="panel"><h3>Revenue by month (rentals + sales)</h3>${monA.length
      ? `<table><thead><tr><th>Month</th><th></th><th class="r">Revenue</th></tr></thead><tbody>${monA.map(([m, v]) => `<tr><td>${m}</td><td style="width:55%"><div class="bar" style="width:${v / mx * 100}%"></div></td><td class="r">${peso(v)}</td></tr>`).join('')}</tbody>
         <tfoot><tr><td colspan="2">Total</td><td class="r">${peso(allPaid)}</td></tr></tfoot></table>`
      : '<div class="empty">No paid rentals or sales yet.</div>'}</div>`;
  }

  function vBookings() {
    const list = D.b.filter((b) => bf === 'All' || b.status === bf);
    const tabs = ['Pending', 'Accepted', 'Declined', 'All'].map((s) => `<button class="${s === bf ? 'on' : ''}" data-act="bf" data-s="${s}">${s}</button>`).join('');
    const rows = list.map((b) => `<tr>
      <td><b>${esc(b.dress_name)}</b>${isSaleDress(b.dress_id) ? '<br><small>For sale (purchase)</small>' : ''}${b.ref_code ? '<br><small>Code ' + esc(b.ref_code) + '</small>' : ''}</td><td>${esc(b.customer)}</td>
      <td>${esc(b.contact)}${b.customer_email ? '<br><small>' + esc(b.customer_email) + '</small>' : ''}</td>
      <td>${isSaleDress(b.dress_id) ? 'Purchase<br><small>' + fd(b.event_date) + '</small>' : fd(b.event_date)}</td>
      <td>${esc(b.message || '')}</td>
      <td><span class="pill ${b.status}">${b.status}</span>${b.remarks ? '<br><small>' + esc(b.remarks) + '</small>' : ''}</td>
      <td>${b.status === 'Pending' ? `<button class="btn sm" data-act="review" data-id="${b.id}">Review</button>` : '<small>' + esc(b.decided_by || '') + '</small><br>'} <button class="btn sm danger" data-act="delbooking" data-id="${b.id}">Delete</button></td></tr>`).join('');
    return `<div class="top"><h2>Booking requests</h2><div class="tabs">${tabs}</div></div>
    <div class="panel">${list.length
      ? `<table><thead><tr><th>Product</th><th>Customer</th><th>Contact</th><th>Event date</th><th>Note</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">No requests here.</div>'}</div>`;
  }

  function vDresses() {
    return `<div class="top"><h2>Products</h2><button class="btn" data-act="newdress">+ Add product</button></div>
    ${D.d.length ? `<div class="grid">${D.d.map((d) => `<div class="dress">
      <div class="ph" ${d.photos && d.photos[0] ? `style="background-image:url('${esc(d.photos[0])}')"` : ''}>${d.photos && d.photos[0] ? '' : 'No photo'}</div>
      <div class="in"><h4>${esc(d.name)}</h4>
        <span class="meta">${esc(d.category)} · Bust ${esc(d.bust || '-')}, Waist ${esc(d.waist || '-')}</span>
        <div><b>${peso(d.price)}</b> <span class="pill ${esc(d.status)}">${esc(d.status)}</span>${d.listing === 'Sale' ? ' <span class="pill">For sale</span>' : ''}</div>
        <span class="meta">${(d.photos || []).length} photo${(d.photos || []).length === 1 ? '' : 's'}</span>
        <div class="acts"><button class="btn sm" data-act="editdress" data-id="${d.id}">Edit</button><button class="btn sm danger" data-act="deldress" data-id="${d.id}">Delete</button></div>
      </div></div>`).join('')}</div>` : '<div class="panel"><div class="empty">No products yet.</div></div>'}`;
  }

  const todayS = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function vRentals() {
    const rentOnly = D.r.filter((r) => !isSale(r));
    const fees = rentOnly.filter((r) => r.status === 'Paid' || r.status === 'Returned').reduce((s, r) => s + Number(r.amount || 0), 0);
    const salesTotal = D.r.filter((r) => isSale(r) && r.status === 'Paid').reduce((s, r) => s + Number(r.amount || 0), 0);
    const held = D.r.filter((r) => r.deposit_status === 'Paid').reduce((s, r) => s + Number(r.deposit_amount || 0), 0);
    const rows = D.r.map((r) => {
      const sale = isSale(r);
      const done = r.status === 'Returned', active = r.status === 'Reserved' || r.status === 'Paid';
      const overdue = !sale && !r.return_status && active && r.return_due && r.return_due < todayS();
      const dep = Number(r.deposit_amount || 0);
      return `<tr>
        <td><b>${esc(r.dress_name)}</b>${sale ? '<br><small>For sale (purchase)</small>' : ''}</td>
        <td>${esc(r.customer)}<br><small>${esc(r.contact || '')}</small></td>
        <td>${sale
          ? 'Purchase<br><small>' + fd(r.event_date) + '</small>'
          : fd(r.event_date) + '<br><small>Due back</small><br><input type="date" data-act="due" data-id="' + r.id + '" value="' + esc(r.return_due || '') + '" style="width:auto;padding:4px">'}</td>
        <td>${done ? '<span class="pill Paid">Returned</span>' : `<select data-act="rst" data-id="${r.id}" style="width:auto;padding:6px">${['Reserved', 'Paid', 'Cancelled'].map((s) => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select>`}<br><small>${sale ? 'Price' : 'Rental fee'} ${peso(r.amount)}</small></td>
        <td>${dep ? `<select data-act="dst" data-id="${r.id}" style="width:auto;padding:6px">${['Unpaid', 'Paid', 'Returned', 'Forfeited'].map((s) => `<option${s === r.deposit_status ? ' selected' : ''}>${s}</option>`).join('')}</select><br><small>Deposit ${peso(dep)}</small>` : '<small>No deposit</small>'}</td>
        <td>${sale ? '<small>Not returnable</small>' : r.return_status ? `<span class="pill ${r.return_status === 'Late' ? 'Cancelled' : 'Paid'}">${r.return_status}</span><br><small>${dt(r.returned_at)}</small>${r.return_note ? '<br><small>' + esc(r.return_note) + '</small>' : ''}`
          : active ? `${overdue ? '<span class="pill Cancelled">Overdue</span><br>' : ''}<button class="btn sm" data-act="retopen" data-id="${r.id}">Mark returned</button>` : ''}</td>
        <td class="r"><button class="btn sm danger noprint" data-act="delrental" data-id="${r.id}">Delete</button></td></tr>`;
    }).join('');
    return `<div class="top"><h2>Rentals &amp; sales</h2></div>
      <p class="hint">Rental fees paid: <b>${peso(fees)}</b> · Sales paid: <b>${peso(salesTotal)}</b> · Security deposits held: <b>${peso(held)}</b></p>
      <div class="panel">${D.r.length
        ? `<table><thead><tr><th>Product</th><th>Customer</th><th>Event / due back</th><th>Fee / price</th><th>Security deposit</th><th>Return</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty">No rentals yet. Accept a booking to create one.</div>'}</div>`;
  }

  function returnForm(id) {
    const r = D.r.find((x) => x.id === id);
    const late = r.return_due && todayS() > r.return_due;
    dlg.innerHTML = `<h3>Mark returned</h3>
      <p>${esc(r.dress_name)} · ${esc(r.customer)}<br>Due back: <b>${fd(r.return_due)}</b> · Today: <b>${fd(todayS())}</b></p>
      <p>Return status: <span class="pill ${late ? 'Cancelled' : 'Paid'}">${late ? 'Late' : 'On time'}</span></p>
      ${r.deposit_status === 'Paid'
        ? `<label for="rdep">Security deposit (${peso(r.deposit_amount)})</label>
           <select id="rdep"><option value="Returned">Refund to the customer</option><option value="Forfeited"${late ? ' selected' : ''}>Keep it (late or damaged)</option></select>`
        : `<p class="hint">Security deposit status: ${esc(r.deposit_status)}. Nothing to refund.</p>`}
      <label for="rnote">Note (optional)</label><textarea id="rnote" maxlength="300"></textarea>
      <div class="err" id="derr"></div>
      <div class="row" style="margin-top:12px">
        <button class="btn" data-act="retok" data-id="${id}">Confirm return</button>
        <button class="btn ghost" data-act="close">Cancel</button>
      </div>`;
    dlg.showModal();
  }

  async function doReturn(id) {
    const dep = $('#rdep') ? $('#rdep').value : 'Returned';
    const { error } = await sb.rpc('return_rental', { p_id: id, p_deposit: dep, p_note: $('#rnote').value });
    if (error) { $('#derr').textContent = error.message; return; }
    dlg.close(); toast('Marked as returned.'); load();
  }

  function vActivity() {
    return `<div class="top"><h2>Activity log</h2></div><div class="panel">${D.l.length
      ? `<table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${D.l.map((l) => `<tr><td>${dt(l.created_at)}</td><td>${esc(l.user_email || '')}</td><td>${esc(l.action)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Nothing yet.</div>'}</div>`;
  }

  /* ---------------- bookings: review / accept / decline ---------------- */
  function openReview(id) {
    const b = D.b.find((x) => x.id === id);
    const sale = isSaleDress(b.dress_id);
    const clash = b.dress_id && (sale
      ? D.r.some((r) => r.dress_id === b.dress_id && (r.status === 'Reserved' || r.status === 'Paid'))
      : D.r.some((r) => r.dress_id === b.dress_id && r.event_date === b.event_date && (r.status === 'Reserved' || r.status === 'Paid')));
    dlg.innerHTML = `<h3>${esc(b.dress_name)}</h3>
      <p>${esc(b.customer)} · ${esc(b.contact)}<br>${sale ? 'Purchase request (for sale)' : 'Event date: <b>' + fd(b.event_date) + '</b>'}${b.message ? '<br>Note: ' + esc(b.message) : ''}</p>
      <p class="hint">Your decision and remarks will show on the customer's Track booking page.</p>
      ${clash ? '<p class="err">Warning: ' + (sale ? 'this item is already sold or reserved for another buyer.' : 'this product is already booked for that date.') + '</p>' : ''}
      <label for="rm">Remarks (the customer will read this; required when declining)</label>
      <textarea id="rm" maxlength="500"></textarea>
      <div class="err" id="derr"></div>
      <div class="row" style="margin-top:12px">
        <button class="btn" data-act="acc" data-id="${id}">Accept</button>
        <button class="btn danger" data-act="dec" data-id="${id}">Decline</button>
        <button class="btn ghost" data-act="close">Cancel</button>
      </div>`;
    dlg.showModal();
  }

  async function decide(id, decision) {
    const rm = $('#rm').value;
    if (decision === 'Declined' && !rm.trim()) { $('#derr').textContent = 'Please write a remark before declining.'; return; }
    const b = D.b.find((x) => x.id === id);
    const { error } = await sb.rpc('decide_booking', { p_id: id, p_decision: decision, p_remarks: rm });
    if (error) { $('#derr').textContent = error.message; return; }
    dlg.close();
    const mailed = ' The customer can see it on Track booking.';
    toast((decision === 'Accepted' ? 'Accepted. A ' + (b && isSaleDress(b.dress_id) ? 'sale order' : 'rental') + ' was created.' : 'Booking declined.') + mailed);
    load();
  }

  /* ---------------- dresses: multiple photos ---------------- */
  function thumbs() {
    $('#th').innerHTML = items.length ? items.map((it, i) =>
      `<div data-act="${i ? 'cover' : ''}" data-i="${i}" title="${i ? 'Click to make this the cover photo' : 'Cover photo'}" style="background-image:url('${esc(it.url)}');${i ? 'cursor:pointer' : 'outline:2px solid #D81B8A'}">
        ${i === 0 ? '<span style="position:absolute;left:0;right:0;bottom:0;background:#D81B8A;color:#fff;font-size:.62rem;text-align:center;padding:1px 0">Cover</span>' : ''}
        <button type="button" data-act="rmph" data-i="${i}" aria-label="Remove photo">&times;</button></div>`).join('')
      : '<small>No photos yet.</small>';
    $('#phc').textContent = items.length + ' of ' + MAX_PHOTOS + ' photos';
  }

  // shrink big phone photos before uploading (faster, saves storage)
  function shrink(file) {
    return new Promise((res) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob((b) => res(b || file), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  }

  function dressForm(d) {
    d = d || { name: '', category: 'Long Dress', price: '', bust: '', waist: '', description: '', status: 'Available', photos: [] };
    items = (d.photos || []).map((u) => ({ url: u }));
    const opt = (a, v) => a.map((o) => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('');
    dlg.innerHTML = `<h3>${d.id ? 'Edit product' : 'Add product'}</h3>
    <form id="df"><input type="hidden" name="did" value="${esc(d.id || '')}">
      <label>Name</label><input name="name" required value="${esc(d.name)}">
      <div class="two">
        <div><label>Category</label><select name="category">${opt(['Long Dress', 'Short Dress', 'Bag', 'Accessories', 'Shoes', 'Filipiniana'], d.category)}</select></div>
        <div><label>Price (₱)</label><input name="price" type="number" min="0" step="1" required value="${esc(d.price)}"></div>
      </div>
      <div class="two">
        <div><label>Bust</label><input name="bust" value="${esc(d.bust)}"></div>
        <div><label>Waist</label><input name="waist" value="${esc(d.waist)}"></div>
      </div>
      <label>Status</label><select name="status">${opt(['Available', 'Unavailable'], d.status)}</select>
      <label>Listing</label><select name="listing"><option value="Rent"${d.listing === 'Sale' ? '' : ' selected'}>For rent</option><option value="Sale"${d.listing === 'Sale' ? ' selected' : ''}>For sale</option></select>
      <div class="hint">Items for rent turn Unavailable by themselves while rented. A sale item turns Unavailable by itself once an order is accepted, and comes back if the order is cancelled. The price of a sale item is its selling price.</div>
      <label>Description</label><textarea name="description">${esc(d.description)}</textarea>
      <label>Photos <span id="phc" style="font-weight:400"></span></label>
      <div class="thumbs" id="th"></div>
      <input type="file" id="pics" accept="image/*" multiple style="margin-top:8px">
      <div class="hint">Choose several photos at once, or add more any time (up to ${MAX_PHOTOS}). Click a photo to make it the cover. Set status to Unavailable to hide a product from the website.</div>
      <div class="err" id="derr"></div>
      <div class="row"><button class="btn" id="sv">Save</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div>
    </form>`;
    thumbs();
    dlg.showModal();
  }

  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'df') return;
    e.preventDefault();
    const f = e.target.elements, btn = $('#sv'), er = $('#derr');
    btn.disabled = true; er.textContent = '';
    const urls = [], total = items.filter((i) => i.file).length;
    let n = 0;
    for (const it of items) {
      if (!it.file) { urls.push(it.url); continue; }
      n++; btn.textContent = 'Uploading photo ' + n + ' of ' + total + '…';
      const blob = await shrink(it.file);
      const path = Date.now() + '-' + n + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
      const up = await sb.storage.from('dress-photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
      if (up.error) { er.textContent = 'Photo upload failed: ' + up.error.message; btn.disabled = false; btn.textContent = 'Save'; return; }
      urls.push(sb.storage.from('dress-photos').getPublicUrl(path).data.publicUrl);
    }
    btn.textContent = 'Saving…';
    const row = {
      name: f.name.value.trim(), category: f.category.value, price: Number(f.price.value),
      bust: f.bust.value.trim(), waist: f.waist.value.trim(),
      description: f.description.value.trim(), status: f.status.value, listing: f.listing.value, photos: urls
    };
    const id = f.did.value;
    const { error } = id ? await sb.from('dresses').update(row).eq('id', id) : await sb.from('dresses').insert(row);
    btn.disabled = false; btn.textContent = 'Save';
    if (error) { er.textContent = error.message; return; }
    dlg.close();
    toast((id ? 'Product updated' : 'Product added') + ' with ' + urls.length + ' photo' + (urls.length === 1 ? '' : 's') + '.');
    load();
  });

  /* ---------------- payments ---------------- */
  const METHOD = { cash: 'Cash', gcash: 'GCash', bank: 'Bank transfer' };
  const payItems = (p) => (p.booking_ids || []).map((id) => {
    const b = D.b.find((x) => x.id === id);
    return b ? b.dress_name + (isSaleDress(b.dress_id) ? ' (purchase)' : ' (' + fd(b.event_date) + ')') : 'a booking';
  }).join(', ');

  function vPayments() {
    const rows = D.p.map((p) => `<tr>
      <td>${dt(p.created_at)}</td>
      <td><b>${esc(p.customer)}</b><br><small>${esc(p.contact)}</small></td>
      <td>${esc(payItems(p))}</td>
      <td>${METHOD[p.method] || esc(p.method)}${p.reference ? '<br><small>Ref ' + esc(p.reference) + '</small>' : ''}</td>
      <td class="r">${peso(p.amount)}</td>
      <td><span class="pill ${p.status === 'Confirmed' ? 'Paid' : p.status === 'Rejected' ? 'Cancelled' : 'Pending'}">${p.status}</span>${p.admin_note ? '<br><small>' + esc(p.admin_note) + '</small>' : ''}</td>
      <td><button class="btn sm ${p.status === 'Submitted' ? '' : 'ghost'}" data-act="payopen" data-id="${p.id}">${p.status === 'Submitted' ? 'Review' : 'View'}</button></td></tr>`).join('');
    return `<div class="top"><h2>Payments</h2></div><div class="panel">${D.p.length
      ? `<table><thead><tr><th>Sent</th><th>Customer</th><th>For</th><th>Method</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">No payments yet. They appear here when a customer checks out.</div>'}</div>`;
  }

  async function openPayment(id) {
    const p = D.p.find((x) => x.id === id);
    const open = p.status === 'Submitted';
    dlg.innerHTML = `<h3>${METHOD[p.method] || esc(p.method)} · ${peso(p.amount)}</h3>
      <p>${esc(p.customer)} · ${esc(p.contact)}<br>${esc(payItems(p))}${Number(p.deposit_amount) ? '<br>Rental fee ' + peso(p.fee_amount) + ' + security deposit ' + peso(p.deposit_amount) : ''}${p.reference ? '<br>Reference: <b>' + esc(p.reference) + '</b>' : ''}</p>
      <div id="pf">${p.proof_path ? '<p class="hint">Loading proof…</p>' : '<p class="hint">Cash: no proof needed. Confirm once you have received the money.</p>'}</div>
      ${open ? '<label for="pn">Note for the customer (required when rejecting)</label><textarea id="pn" maxlength="300"></textarea>' : ''}
      <div class="err" id="derr"></div>
      <div class="row" style="margin-top:12px">
        ${open ? `<button class="btn" data-act="payok" data-id="${id}">Confirm payment</button><button class="btn danger" data-act="payno" data-id="${id}">Reject</button>` : ''}
        <button class="btn ghost" data-act="close">Close</button>
      </div>`;
    dlg.showModal();
    if (p.proof_path) {
      const { data, error } = await sb.storage.from('payment-proofs').createSignedUrl(p.proof_path, 3600);
      $('#pf').innerHTML = error
        ? '<p class="err">Could not load the proof: ' + esc(error.message) + '</p>'
        : `<a href="${esc(data.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(data.signedUrl)}" alt="Proof of payment" style="max-width:100%;max-height:55vh;display:block;margin:8px auto;border:1px solid #ecdcec"></a><p class="hint">Click the image to open it full size. Check the amount, date and reference.</p>`;
    }
  }

  async function decidePay(id, decision) {
    const note = $('#pn') ? $('#pn').value : '';
    if (decision === 'Rejected' && !note.trim()) { $('#derr').textContent = 'Please write a note so the customer knows what to fix.'; return; }
    const { error } = await sb.rpc('decide_payment', { p_id: id, p_decision: decision, p_note: note });
    if (error) { $('#derr').textContent = error.message; return; }
    dlg.close();
    toast(decision === 'Confirmed' ? 'Payment confirmed. The order is now Paid.' : 'Payment rejected. The customer can send a new proof.');
    load();
  }

  /* ---------------- clicks ---------------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !el.dataset.act) return;
    const act = el.dataset.act, id = el.dataset.id;
    if (el.tagName === 'SELECT') return;
    if (act === 'tab') { tab = el.dataset.t; render(); }
    else if (act === 'bf') { bf = el.dataset.s; render(); }
    else if (act === 'print') window.print();
    else if (act === 'close') dlg.close();
    else if (act === 'review') openReview(id);
    else if (act === 'acc') decide(id, 'Accepted');
    else if (act === 'dec') decide(id, 'Declined');
    else if (act === 'newdress') dressForm();
    else if (act === 'editdress') dressForm(D.d.find((d) => d.id === id));
    else if (act === 'rmph') { items.splice(+el.dataset.i, 1); thumbs(); }
    else if (act === 'cover') { items.unshift(items.splice(+el.dataset.i, 1)[0]); thumbs(); }
    else if (act === 'deldress') {
      if (!confirm('Delete this product? Past bookings keep its name.')) return;
      const { error } = await sb.from('dresses').delete().eq('id', id);
      if (error) return toast(error.message);
      toast('Product deleted.'); load();
    }
    else if (act === 'delbooking') {
      const b = D.b.find((x) => x.id === id);
      const who = b ? b.customer + ' (' + b.dress_name + ', ' + fd(b.event_date) + ')' : 'this booking';
      const hasRental = D.r.some((r) => r.booking_id === id);
      if (!confirm('Delete the booking of ' + who + '?\n\nThe customer will no longer be able to track it. This cannot be undone.' +
        (hasRental ? '\n\nIts rental stays in the Rentals tab; delete it there too if you want it gone.' : ''))) return;
      const { error } = await sb.from('bookings').delete().eq('id', id);
      if (error) return toast(error.message);
      toast('Booking deleted.'); load();
    }
    else if (act === 'delrental') {
      const r = D.r.find((x) => x.id === id);
      const who = r ? r.customer + ' (' + r.dress_name + ', ' + fd(r.event_date) + ')' : 'this rental';
      if (!confirm('Delete the rental of ' + who + '?\n\nThis removes it from revenue totals and frees the dress for that date. This cannot be undone.')) return;
      const { error } = await sb.from('rentals').delete().eq('id', id);
      if (error) return toast(error.message);
      toast('Rental deleted.'); load();
    }
    else if (act === 'payopen') openPayment(id);
    else if (act === 'payok') decidePay(id, 'Confirmed');
    else if (act === 'payno') decidePay(id, 'Rejected');
    else if (act === 'retopen') returnForm(id);
    else if (act === 'retok') doReturn(id);
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.id === 'pics') {
      const files = Array.from(el.files), room = MAX_PHOTOS - items.length;
      files.slice(0, Math.max(room, 0)).forEach((file) => items.push({ file: file, url: URL.createObjectURL(file) }));
      if (files.length > room) toast('Maximum ' + MAX_PHOTOS + ' photos per dress.');
      el.value = '';
      thumbs();
      return;
    }
    if (el.dataset && el.dataset.act === 'rst') {
      const { error } = await sb.from('rentals').update({ status: el.value }).eq('id', el.dataset.id);
      if (error) toast(error.message); else { toast('Rental updated.'); load(); }
    }
    if (el.dataset && el.dataset.act === 'dst') {
      const { error } = await sb.from('rentals').update({ deposit_status: el.value }).eq('id', el.dataset.id);
      if (error) toast(error.message); else { toast('Deposit updated.'); load(); }
    }
    if (el.dataset && el.dataset.act === 'due') {
      const { error } = await sb.from('rentals').update({ return_due: el.value || null }).eq('id', el.dataset.id);
      if (error) toast(error.message); else { toast('Due date updated.'); load(); }
    }
  });

  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  boot();
})();