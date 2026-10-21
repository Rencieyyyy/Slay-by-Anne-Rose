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
  const TABS = ['Overview', 'Bookings', 'Dresses', 'Rentals', 'Activity'];
  let tab = 'Overview', bf = 'Pending', items = [], loadT;   // items = photos in the dress form: {url, file?}
  let D = { b: [], d: [], r: [], l: [] };
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
    const [b, d, r, l] = await Promise.all([
      sb.from('bookings').select('*').order('created_at', { ascending: false }),
      sb.from('dresses').select('*').order('name'),
      sb.from('rentals').select('*').order('event_date', { ascending: false }),
      sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(60)
    ]);
    const err = b.error || d.error || r.error || l.error;
    if (err) toast('Load error: ' + err.message);
    D = { b: b.data || [], d: d.data || [], r: r.data || [], l: l.data || [] };
    render();
  }

  function live() {
    const ch = sb.channel('slay-live');
    ['bookings', 'rentals', 'dresses', 'activity_log'].forEach((t) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        clearTimeout(loadT); loadT = setTimeout(load, 400);
      }));
    ch.subscribe((s) => $('#live').classList.toggle('on', s === 'SUBSCRIBED'));
  }

  /* ---------------- views ---------------- */
  function render() {
    const pend = D.b.filter((b) => b.status === 'Pending').length;
    $('#nav').innerHTML = TABS.map((t) =>
      `<button class="${t === tab ? 'on' : ''}" data-act="tab" data-t="${t}">${t}${t === 'Bookings' && pend ? ' (' + pend + ')' : ''}</button>`).join('');
    $('#main').innerHTML = ({ Overview: vOverview, Bookings: vBookings, Dresses: vDresses, Rentals: vRentals, Activity: vActivity })[tab]();
  }

  function vOverview() {
    const cnt = (s) => D.b.filter((b) => b.status === s).length;
    const sum = (a) => a.reduce((s, r) => s + Number(r.amount || 0), 0);
    const live = D.r.filter((r) => r.status !== 'Cancelled');
    const paid = D.r.filter((r) => r.status === 'Paid' || r.status === 'Returned');
    const reserved = D.r.filter((r) => r.status === 'Reserved');
    const top = {}; live.forEach((r) => { top[r.dress_name] = (top[r.dress_name] || 0) + 1; });
    const topA = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const mon = {}; paid.forEach((r) => { const k = r.event_date.slice(0, 7); mon[k] = (mon[k] || 0) + Number(r.amount || 0); });
    const monA = Object.entries(mon).sort().slice(-6);
    const mx = Math.max(1, ...monA.map((x) => x[1]));
    const card = (l, v) => `<div class="card"><span>${l}</span><strong>${v}</strong></div>`;
    return `<div class="printhead"><h2>Slay by Anne&amp;Rose report</h2><p>${new Date().toLocaleDateString('en-PH')}</p></div>
    <div class="top"><h2>Overview</h2><button class="btn ghost noprint" data-act="print">Print report</button></div>
    <div class="cards">
      ${card('Pending requests', cnt('Pending'))}${card('Accepted', cnt('Accepted'))}${card('Declined', cnt('Declined'))}
      ${card('Revenue (paid)', peso(sum(paid)))}${card('Reserved, unpaid', peso(sum(reserved)))}${card('Dresses', D.d.length)}
    </div>
    <div class="panel"><h3>Most rented</h3>${topA.length
      ? `<table><thead><tr><th>Dress</th><th class="r">Rentals</th></tr></thead><tbody>${topA.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="r">${c}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No rentals yet.</div>'}</div>
    <div class="panel"><h3>Revenue by month</h3>${monA.length
      ? `<table><thead><tr><th>Month</th><th></th><th class="r">Revenue</th></tr></thead><tbody>${monA.map(([m, v]) => `<tr><td>${m}</td><td style="width:55%"><div class="bar" style="width:${v / mx * 100}%"></div></td><td class="r">${peso(v)}</td></tr>`).join('')}</tbody>
         <tfoot><tr><td colspan="2">Total</td><td class="r">${peso(sum(paid))}</td></tr></tfoot></table>`
      : '<div class="empty">No paid rentals yet.</div>'}</div>`;
  }

  function vBookings() {
    const list = D.b.filter((b) => bf === 'All' || b.status === bf);
    const tabs = ['Pending', 'Accepted', 'Declined', 'All'].map((s) => `<button class="${s === bf ? 'on' : ''}" data-act="bf" data-s="${s}">${s}</button>`).join('');
    const rows = list.map((b) => `<tr>
      <td><b>${esc(b.dress_name)}</b>${b.ref_code ? '<br><small>Code ' + esc(b.ref_code) + '</small>' : ''}</td><td>${esc(b.customer)}</td>
      <td>${esc(b.contact)}${b.customer_email ? '<br><small>' + esc(b.customer_email) + '</small>' : ''}</td>
      <td>${fd(b.event_date)}</td>
      <td>${esc(b.message || '')}</td>
      <td><span class="pill ${b.status}">${b.status}</span>${b.remarks ? '<br><small>' + esc(b.remarks) + '</small>' : ''}</td>
      <td>${b.status === 'Pending' ? `<button class="btn sm" data-act="review" data-id="${b.id}">Review</button>` : '<small>' + esc(b.decided_by || '') + '</small><br>'} <button class="btn sm danger" data-act="delbooking" data-id="${b.id}">Delete</button></td></tr>`).join('');
    return `<div class="top"><h2>Booking requests</h2><div class="tabs">${tabs}</div></div>
    <div class="panel">${list.length
      ? `<table><thead><tr><th>Dress</th><th>Customer</th><th>Contact</th><th>Event date</th><th>Note</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">No requests here.</div>'}</div>`;
  }

  function vDresses() {
    return `<div class="top"><h2>Dresses</h2><button class="btn" data-act="newdress">+ Add dress</button></div>
    ${D.d.length ? `<div class="grid">${D.d.map((d) => `<div class="dress">
      <div class="ph" ${d.photos && d.photos[0] ? `style="background-image:url('${esc(d.photos[0])}')"` : ''}>${d.photos && d.photos[0] ? '' : 'No photo'}</div>
      <div class="in"><h4>${esc(d.name)}</h4>
        <span class="meta">${esc(d.category)} · Bust ${esc(d.bust || '-')}, Waist ${esc(d.waist || '-')}</span>
        <div><b>${peso(d.price)}</b> <span class="pill ${esc(d.status)}">${esc(d.status)}</span></div>
        <span class="meta">${(d.photos || []).length} photo${(d.photos || []).length === 1 ? '' : 's'}</span>
        <div class="acts"><button class="btn sm" data-act="editdress" data-id="${d.id}">Edit</button><button class="btn sm danger" data-act="deldress" data-id="${d.id}">Delete</button></div>
      </div></div>`).join('')}</div>` : '<div class="panel"><div class="empty">No dresses yet.</div></div>'}`;
  }

  function vRentals() {
    const total = D.r.filter((r) => r.status !== 'Cancelled').reduce((s, r) => s + Number(r.amount || 0), 0);
    const rows = D.r.map((r) => `<tr><td><b>${esc(r.dress_name)}</b></td><td>${esc(r.customer)}</td><td>${esc(r.contact || '')}</td><td>${fd(r.event_date)}</td>
      <td><select data-act="rst" data-id="${r.id}" style="width:auto;padding:6px">${['Reserved', 'Paid', 'Returned', 'Cancelled'].map((s) => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
      <td class="r">${peso(r.amount)}</td>
      <td class="r"><button class="btn sm danger noprint" data-act="delrental" data-id="${r.id}">Delete</button></td></tr>`).join('');
    return `<div class="top"><h2>Rentals</h2></div><div class="panel">${D.r.length
      ? `<table><thead><tr><th>Dress</th><th>Customer</th><th>Contact</th><th>Event date</th><th>Status</th><th class="r">Amount</th><th></th></tr></thead><tbody>${rows}</tbody>
         <tfoot><tr><td colspan="5">Total (excluding cancelled)</td><td class="r">${peso(total)}</td><td></td></tr></tfoot></table>`
      : '<div class="empty">No rentals yet. Accept a booking to create one.</div>'}</div>`;
  }

  function vActivity() {
    return `<div class="top"><h2>Activity log</h2></div><div class="panel">${D.l.length
      ? `<table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${D.l.map((l) => `<tr><td>${dt(l.created_at)}</td><td>${esc(l.user_email || '')}</td><td>${esc(l.action)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Nothing yet.</div>'}</div>`;
  }

  /* ---------------- bookings: review / accept / decline ---------------- */
  function openReview(id) {
    const b = D.b.find((x) => x.id === id);
    const clash = b.dress_id && D.r.some((r) => r.dress_id === b.dress_id && r.event_date === b.event_date && (r.status === 'Reserved' || r.status === 'Paid'));
    dlg.innerHTML = `<h3>${esc(b.dress_name)}</h3>
      <p>${esc(b.customer)} · ${esc(b.contact)}<br>Event date: <b>${fd(b.event_date)}</b>${b.message ? '<br>Note: ' + esc(b.message) : ''}</p>
      <p class="hint">Your decision and remarks will show on the customer's Track booking page.</p>
      ${clash ? '<p class="err">Warning: this dress is already booked for that date.</p>' : ''}
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
    toast((decision === 'Accepted' ? 'Accepted. A rental was created.' : 'Booking declined.') + mailed);
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
    dlg.innerHTML = `<h3>${d.id ? 'Edit dress' : 'Add dress'}</h3>
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
      <label>Description</label><textarea name="description">${esc(d.description)}</textarea>
      <label>Photos <span id="phc" style="font-weight:400"></span></label>
      <div class="thumbs" id="th"></div>
      <input type="file" id="pics" accept="image/*" multiple style="margin-top:8px">
      <div class="hint">Choose several photos at once, or add more any time (up to ${MAX_PHOTOS}). Click a photo to make it the cover. Set status to Unavailable to hide a dress from the website.</div>
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
      description: f.description.value.trim(), status: f.status.value, photos: urls
    };
    const id = f.did.value;
    const { error } = id ? await sb.from('dresses').update(row).eq('id', id) : await sb.from('dresses').insert(row);
    btn.disabled = false; btn.textContent = 'Save';
    if (error) { er.textContent = error.message; return; }
    dlg.close();
    toast((id ? 'Dress updated' : 'Dress added') + ' with ' + urls.length + ' photo' + (urls.length === 1 ? '' : 's') + '.');
    load();
  });

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
      if (!confirm('Delete this dress? Past bookings keep its name.')) return;
      const { error } = await sb.from('dresses').delete().eq('id', id);
      if (error) return toast(error.message);
      toast('Dress deleted.'); load();
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
  });

  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  boot();
})();