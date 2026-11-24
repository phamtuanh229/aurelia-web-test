/* Aurelia Dress Up – chức năng của trang web */
(function () {
  'use strict';
  const CFG = window.AURELIA_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  /* ---------- Tiện ích ---------- */
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
  const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAY = 86400000;
  const dayNum = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY);
  const todayNum = () => { const t = new Date(); return dayNum(t.getFullYear(), t.getMonth(), t.getDate()); };
  const numToDate = (n) => new Date(n * DAY);
  const fmtDay = (n) => { const d = numToDate(n); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); };
  function parseDay(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return dayNum(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) return dayNum(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  const inputToNum = (v) => (v ? parseDay(v) : null);
  const money = (n) => n.toLocaleString('vi-VN') + 'đ';
  const priceNum = (s) => { const d = String(s || '').replace(/[^\d]/g, ''); if (!d) return null; let n = +d; if (n < 5000) n *= 1000; return n; };

  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ''));
  }
  function toObjects(text) {
    const rows = parseCSV(text); if (!rows.length) return [];
    const keys = rows[0].map(norm);
    return rows.slice(1).map((r) => { const o = {}; keys.forEach((k, i) => { if (k && o[k] === undefined) o[k] = (r[i] || '').trim(); }); return o; });
  }
  // Link chia sẻ Google Drive -> link ảnh hiển thị được
  function fixImg(u) {
    u = (u || '').trim();
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000' : u;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    if (!t.hasAttribute('popover')) t.setAttribute('popover', 'manual');
    t.textContent = msg;
    try { t.showPopover(); } catch (e) {}
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('on'); setTimeout(() => { try { t.hidePopover(); } catch (e) {} }, 300); }, 4200);
  }

  /* ---------- Nguồn dữ liệu ---------- */
  const LOCAL = { sanPham: 'data/vay.csv', phuKien: 'data/phukien.csv', anh: 'data/anh.csv', lich: 'data/lich.csv', feedback: 'data/feedback.csv' };
  async function fetchText(url) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }
  async function getTab(key) {
    const tab = CFG.tab && CFG.tab[key];
    if (CFG.sheetId && tab) {
      try { return await fetchText(`https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`); }
      catch (e) { console.warn('Không đọc được tab', tab, e); toast('Chưa đọc được Google Sheets, đang dùng dữ liệu mẫu.'); }
    }
    try { return await fetchText(LOCAL[key]); } catch (e) { return ''; }
  }

  /* ---------- Xử lý sản phẩm ---------- */
  const CATS = [
    { id: 'VD', name: 'Váy dài & dạ hội' }, { id: 'VN', name: 'Váy ngắn' }, { id: 'AD', name: 'Áo dài' },
    { id: 'AY', name: 'Yếm' }, { id: 'AK', name: 'Áo khoác' }, { id: 'PK', name: 'Phụ kiện' }
  ];
  const BRAND_TOKENS = (CFG.anHang || []).map((b) => words(b).map(norm)).filter((t) => t.length).sort((a, b) => b.length - a.length);
  const SIZE_WORDS = new Set(['s', 'm', 'l', 'xl', 'xxl', 'fs']);
  function cleanName(name) {
    const toks = words(name), keep = [];
    for (let i = 0; i < toks.length; i++) {
      let hit = 0;
      for (const b of BRAND_TOKENS) { if (b.every((w, k) => norm(toks[i + k]) === w)) { hit = b.length; break; } }
      if (hit && i > 0) { i += hit - 1; continue; }   // luôn giữ chữ đầu (Váy / Áo dài / Set)
      keep.push(toks[i]);
    }
    while (keep.length > 1 && SIZE_WORDS.has(norm(keep[keep.length - 1]))) keep.pop();
    let s = keep.join(' ').replace(/(áo dài)\s+áo dài/i, '$1').replace(/\s{2,}/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const COLOR_MAP = [['den', 'Đen'], ['trang', 'Trắng'], ['nude', 'Nude / Kem'], ['cat', 'Nude / Kem'], ['be', 'Nude / Kem'], ['kem', 'Nude / Kem'], ['do', 'Đỏ'], ['hong', 'Hồng'], ['xanh', 'Xanh'], ['mint', 'Xanh'], ['vang', 'Vàng'], ['tim', 'Tím'], ['cam', 'Cam'], ['nau', 'Nâu'], ['ghi', 'Xám'], ['xam', 'Xám'], ['bac', 'Xám'], ['dong', 'Vàng']];
  const COLOR_HEX = { 'Đen': '#1d1d1d', 'Trắng': '#ffffff', 'Nude / Kem': '#e8d3b8', 'Đỏ': '#b3202a', 'Hồng': '#e9a9bb', 'Xanh': '#8fb8a0', 'Vàng': '#d9bd62', 'Tím': '#7a5a9a', 'Cam': '#ab5c14', 'Nâu': '#7b5a3c', 'Xám': '#9b9b9b' };
  function guessColor(name) {
    for (const t of words(name).slice(1).map(norm)) { const hit = COLOR_MAP.find((c) => c[0] === t); if (hit) return hit[1]; }
    return '';
  }
  function parseRange(s) {
    const m = String(s || '').trim().match(/^(\d{2,3})(?:\s*-\s*(\d{2,3}))?$/);
    return m ? [+m[1], +(m[2] || m[1])] : null;
  }
  function parseMeasure(o) {
    const parts = String(o.sodo3vong || '').split('/').map((x) => x.trim());
    let r = [parseRange(parts[0]), parseRange(parts[1]), parseRange(parts[2])];
    if (!r[0] && !r[1] && !r[2]) r = [parseRange(o.v1), parseRange(o.v2), parseRange(o.v3)];
    return { nguc: r[0], eo: r[1], mong: r[2] };
  }
  const baseCode = (c) => c.replace(/\.\d+$/, '');
  const catOf = (code) => { const p = (code.match(/^[A-Za-z]+/) || [''])[0].toUpperCase(); return CATS.find((c) => c.id === p) ? p : 'VD'; };

  let products = [], bookings = {}, imgMap = {}, feedback = [];

  function buildProducts(sp, pk, anh) {
    imgMap = {};
    anh.forEach((o) => {
      const code = baseCode(o.masanpham || o.ma || o.mavay || ''); if (!code) return;
      (o.anh || o.link || o.anhweb || '').split('|').map(fixImg).filter(Boolean).forEach((u) => (imgMap[code] = imgMap[code] || []).push(u));
    });
    const by = new Map();
    sp.forEach((o) => {
      const code = o.masanpham || o.mavay; if (!code) return;
      if (/^(khong|no|an|0|false)$/.test(norm(o.hienthi))) return;
      const id = baseCode(code);
      let p = by.get(id);
      const size = (o.size || '').toUpperCase();
      if (!p) {
        const m = parseMeasure(o);
        p = { id, cat: catOf(id), raw: o.tensanpham || id, name: o.tenhienthi || cleanName(o.tensanpham || id),
          sizes: [], variants: [], p24: priceNum(o.giathue24h || o.gia24h), p48: priceNum(o.giathue48h || o.gia48h),
          deposit: priceNum(o.tiencoc), meas: m, length: parseInt(String(o.chieudai || '').replace(/[^\d]/g, ''), 10) || null, desc: o.mota || '', note: o.ghichu || '',
          color: o.mau || guessColor(o.tensanpham || ''), imgs: [] };
        by.set(id, p);
      }
      size.split(/[\/,;\s]+/).filter(Boolean).forEach((s) => { if (!p.sizes.includes(s)) p.sizes.push(s); });
      p.variants.push({ code, size });
      (o.anhweb || '').split('|').map(fixImg).filter(Boolean).forEach((u) => p.imgs.push(u));
    });
    pk.forEach((o) => {
      const code = o.masp || o.masanpham; if (!code) return;
      const id = baseCode(code);
      const qty = +o.soluong || 1;
      by.set(id, { id, cat: 'PK', raw: o.tensanpham, name: o.tenhienthi || o.tensanpham || id, sizes: [], variants: [{ code, size: '' }], p24: priceNum(o.giatien), p48: null,
        deposit: null, meas: {}, length: null, desc: qty > 1 ? 'Có ' + qty + ' cái' : '', note: '', color: '', imgs: [], accessory: true });
    });
    products = [...by.values()];
    products.forEach((p) => { if (imgMap[p.id]) p.imgs = imgMap[p.id].concat(p.imgs); });
  }

  /* ---------- Kiểm tra số đo ---------- */
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];
  const ME = { h: null, w: null, b: null, wa: null, hi: null };
  const hasMe = () => ME.b || ME.wa || ME.hi || ME.w;
  const hasVong = () => ME.b || ME.wa || ME.hi;
  function sizeRange(p) {
    const out = { nguc: null, eo: null, mong: null };
    p.sizes.forEach((s) => { const t = (CFG.bangSize || {})[s]; if (!t) return; ['nguc', 'eo', 'mong'].forEach((k) => { out[k] = out[k] ? [Math.min(out[k][0], t[k][0]), Math.max(out[k][1], t[k][1])] : t[k].slice(); }); });
    return out;
  }
  function judge(c, r) {
    if (c < r[0] - 4) return 'rong';
    if (c <= r[1] + 2) return 'vua';
    if (c <= r[1] + 4) return 'sat';
    return 'chat';
  }
  const LBL = { rong: 'hơi rộng', vua: 'vừa', sat: 'hơi sát', chat: 'có thể chật' };
  const NAME3 = { nguc: 'Ngực', eo: 'Eo', mong: 'Mông' };
  function fitCheck(p, me) {
    if (p.accessory) return null;
    if (me.b || me.wa || me.hi) {
      let src = p.meas, est = false;
      if (!src.nguc && !src.eo && !src.mong) { src = sizeRange(p); est = true; }
      const mine = { nguc: me.b, eo: me.wa, mong: me.hi }, lines = []; let worst = 0;
      ['nguc', 'eo', 'mong'].forEach((k) => {
        if (!mine[k] || !src[k]) return;
        const j = judge(mine[k], src[k]);
        lines.push(`${NAME3[k]} ${mine[k]}cm: ${LBL[j]} (váy ${src[k][0] === src[k][1] ? src[k][0] : src[k][0] + '–' + src[k][1]}cm)`);
        worst = Math.max(worst, { vua: 0, rong: 1, sat: 1, chat: 2 }[j]);
      });
      if (!lines.length) return { level: 'unk', text: 'Chưa đủ số đo của váy để so sánh. Nhắn Aurelia để được tư vấn nhé.' };
      const level = worst === 2 ? 'no' : worst === 1 ? 'mid' : 'ok';
      const head = level === 'ok' ? 'Có thể vừa với bạn.' : level === 'mid' ? 'Cần cân nhắc: có thể hơi rộng hoặc sát.' : 'Khả năng cao sẽ chật.';
      return { level, text: head + ' ' + lines.join(' · ') + (est ? ' (Số đo ước tính theo size, cửa hàng sẽ xác nhận khi bạn thử.)' : '') };
    }
    if (me.w && p.sizes.length) {
      const g = me.w <= 48 ? 'S' : me.w <= 55 ? 'M' : me.w <= 62 ? 'L' : me.w <= 70 ? 'XL' : 'XXL';
      const idx = SIZE_ORDER.indexOf(g); const ds = p.sizes.map((s) => SIZE_ORDER.indexOf(s)).filter((i) => i >= 0);
      if (!ds.length) return { level: 'unk', text: 'Nhắn Aurelia để được tư vấn size nhé.' };
      const d = Math.min(...ds.map((i) => Math.abs(i - idx)));
      const level = d === 0 ? 'ok' : d === 1 ? 'mid' : 'no';
      return { level, text: `Theo cân nặng ${me.w}kg, bạn thường mặc size ${g}. Váy này size ${p.sizes.join('/')} → ${level === 'ok' ? 'có thể vừa' : level === 'mid' ? 'cần cân nhắc' : 'khả năng không vừa'}. (Gợi ý sơ bộ – nhập thêm số đo 3 vòng để chính xác hơn.)` };
    }
    return null;
  }

  /* ---------- Bộ lọc & danh sách ---------- */
  const F = { cat: '', from: null, to: null, sizes: new Set(), colors: new Set(), price: '', q: '', onlyFit: false };
  const isBusyDay = (id, n) => (bookings[id] || []).some(([a, b]) => n >= a && n <= b);
  const isBusyRange = (id, a, b) => (bookings[id] || []).some(([x, y]) => a <= y && b >= x);
  const rangeNow = () => (F.from != null ? [F.from, F.to != null && F.to >= F.from ? F.to : F.from] : null);

  function buildCats() {
    const cnt = (id) => products.filter((p) => p.cat === id).length;
    $('cats').innerHTML = `<button class="cat" role="tab" aria-selected="${!F.cat}" data-cat="">Tất cả<small>${products.length}</small></button>` +
      CATS.filter((c) => cnt(c.id)).map((c) => `<button class="cat" role="tab" aria-selected="${F.cat === c.id}" data-cat="${c.id}">${c.name}<small>${cnt(c.id)}</small></button>`).join('');
  }
  function buildChips() {
    const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'FS'].filter((s) => products.some((p) => p.sizes.includes(s)));
    $('fSize').innerHTML = sizes.map((s) => `<button type="button" class="chip" aria-pressed="false" data-size="${s}">${s}</button>`).join('');
    const cols = [...new Set(products.map((p) => p.color).filter(Boolean))];
    $('fColor').innerHTML = cols.map((c) => `<button type="button" class="chip" aria-pressed="false" data-color="${esc(c)}"><i class="sw" style="background:${COLOR_HEX[c] || '#cbbf9c'}"></i>${esc(c)}</button>`).join('');
  }
  function matches(p) {
    if (F.cat && p.cat !== F.cat) return false;
    if (F.sizes.size && p.sizes.length && !p.sizes.some((s) => F.sizes.has(s))) return false;
    if (F.colors.size && !F.colors.has(p.color)) return false;
    if (F.price && p.p24 != null) { const [lo, hi] = F.price.split('-').map((x) => +x * 1000); if (p.p24 < lo || p.p24 >= hi) return false; }
    if (F.q && !norm([p.name, p.id, p.color, p.desc].join(' ')).includes(norm(F.q))) return false;
    return true;
  }
  const FIT_BADGE = { ok: ['fit-ok', 'Có thể vừa'], mid: ['fit-mid', 'Cân nhắc'], no: ['fit-no', 'Dễ chật'] };

  function renderGrid() {
    const r = rangeNow();
    let list = products.filter(matches).map((p) => ({ p, busy: r ? isBusyRange(p.id, r[0], r[1]) : false, fit: null }));
    if (r) list.sort((a, b) => a.busy - b.busy);
    const free = list.filter((x) => !x.busy).length;
    $('resultLine').textContent = r ? `${free} mẫu còn trống ngày ${fmtDay(r[0])}${r[1] !== r[0] ? ' → ' + fmtDay(r[1]) : ''} (tổng ${list.length} mẫu phù hợp)` : `${list.length} mẫu`;
    $('empty').hidden = list.length > 0;
    $('grid').innerHTML = list.map(({ p, busy, fit }) => {
      const img = p.imgs[0];
      const badge = r ? `<span class="badge${busy ? ' busy' : ''}">${busy ? 'Đã có người thuê' : 'Còn trống'}</span>` : (fit && FIT_BADGE[fit.level] ? `<span class="badge ${FIT_BADGE[fit.level][0]}">${FIT_BADGE[fit.level][1]}</span>` : '');
      return `<button class="card reveal${busy ? ' is-busy' : ''}" type="button" data-id="${esc(p.id)}">
        <div class="card-img">${img ? `<img class="ph-img" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="ph"><svg><use href="#hanger"/></svg><span>Ảnh đang cập nhật</span></div>`}${badge}</div>
        <div class="card-body"><div class="code">${esc(p.id)}</div><h3>${esc(p.name)}</h3>
          <div class="p">${p.p24 ? 'Từ ' + money(p.p24) + (p.accessory ? '' : ' / 24h') : 'Liên hệ để biết giá'}</div>
          <div class="c">${esc([p.color, p.sizes.join('/')].filter(Boolean).join(' · '))}</div></div></button>`;
    }).join('');
    observeReveal();
  }

  function bindFilters() {
    $('cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; F.cat = b.dataset.cat; buildCats(); renderGrid(); });
    $('fSize').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (!b) return; const s = b.dataset.size; F.sizes.has(s) ? F.sizes.delete(s) : F.sizes.add(s); b.setAttribute('aria-pressed', F.sizes.has(s)); renderGrid(); });
    $('fColor').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (!b) return; const s = b.dataset.color; F.colors.has(s) ? F.colors.delete(s) : F.colors.add(s); b.setAttribute('aria-pressed', F.colors.has(s)); renderGrid(); });
    $('fFrom').addEventListener('change', (e) => { F.from = inputToNum(e.target.value); if (F.from != null && F.to != null && F.to < F.from) { F.to = null; $('fTo').value = ''; } $('fTo').min = e.target.value; renderGrid(); });
    $('fTo').addEventListener('change', (e) => { F.to = inputToNum(e.target.value); renderGrid(); });
    $('fPrice').addEventListener('change', (e) => { F.price = e.target.value; renderGrid(); });
    $('fQ').addEventListener('input', (e) => { F.q = e.target.value.trim(); renderGrid(); });
    $('fReset').addEventListener('click', () => {
      F.cat = ''; F.from = F.to = null; F.sizes.clear(); F.colors.clear(); F.price = ''; F.q = '';
      ['fFrom', 'fTo', 'fQ'].forEach((i) => ($(i).value = '')); $('fPrice').value = '';
      document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); buildCats(); renderGrid();
    });
    $('fFrom').min = $('fTo').min = new Date().toISOString().slice(0, 10);
    $('grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openDress(c.dataset.id); });

    // số đo toàn trang
    const map = { mH: 'h', mW: 'w', mB: 'b', mWa: 'wa', mHi: 'hi' };
    Object.keys(map).forEach((id) => $(id).addEventListener('input', (e) => { ME[map[id]] = +e.target.value || null; }));
    $('mClear').addEventListener('click', () => { Object.keys(map).forEach((id) => { $(id).value = ''; ME[map[id]] = null; }); });
  }
  function bindBooking() {
    const t = new Date().toISOString().slice(0, 10);
    $('bDate').min = $('bUse').min = t;
    $('bSend').addEventListener('click', () => {
      const v = (id) => $(id).value.trim();
      const fmt = (s) => { const n = inputToNum(s); return n == null ? '' : fmtDay(n); };
      const lines = ['Chào Aurelia, mình muốn đặt lịch thử váy tại cửa hàng.'];
      if (v('bName')) lines.push('Tên: ' + v('bName'));
      if (v('bPhone')) lines.push('SĐT: ' + v('bPhone'));
      if (v('bDate')) lines.push('Ngày muốn ghé: ' + fmt(v('bDate')) + (v('bTime') ? ' lúc ' + v('bTime') : ''));
      if (v('bOcc')) lines.push('Dịp mặc: ' + v('bOcc') + (v('bUse') ? ' (ngày ' + fmt(v('bUse')) + ')' : ''));
      if (v('bCodes')) lines.push('Muốn thử mã: ' + v('bCodes'));
      const me = measureText('').trim(); if (me) lines.push(me);
      if (v('bNote')) lines.push('Lời nhắn: ' + v('bNote'));
      lines.push('Nhờ Aurelia xác nhận lịch giúp mình nhé!');
      contact('messenger', lines.join('\n'));
    });
  }
  function measureText(prefix) {
    const bits = [ME.h && 'cao ' + ME.h + 'cm', ME.w && 'nặng ' + ME.w + 'kg', ME.b && 'ngực ' + ME.b, ME.wa && 'eo ' + ME.wa, ME.hi && 'mông ' + ME.hi].filter(Boolean);
    return prefix + (bits.length ? ' Số đo của mình: ' + bits.join(', ') + '.' : '');
  }

  /* ---------- Liên hệ ---------- */
  const phone = () => String(CFG.hotline || '').replace(/\D/g, '');
  const zaloUrl = () => 'https://zalo.me/' + phone();
  function contact(kind, text) {
    if (text) { try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {} toast('Đã chép tin nhắn. Dán vào ' + (kind === 'zalo' ? 'Zalo' : 'Messenger') + ' rồi gửi cho Aurelia nhé!'); }
    window.open(kind === 'zalo' ? zaloUrl() : CFG.messenger, '_blank', 'noopener');
  }
  function fillContact() {
    const p = phone(), pretty = p.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1.$2.$3');
    $('topMsg').href = CFG.messenger;
    $('cMsg').href = CFG.messenger; $('cTel').href = 'tel:' + p; $('cMap').href = CFG.mapLink;
    $('cPhone').textContent = pretty; $('cAddr').textContent = CFG.diaChi; $('cRoute').textContent = CFG.chiDuong;
    $('bAddr').textContent = CFG.diaChi; $('bRoute').textContent = CFG.chiDuong; $('bPhoneShow').textContent = pretty;
    $('bMap').href = CFG.mapLink; $('bCall').href = 'tel:' + p;
    if (CFG.gioMoCua) { $('cHours').textContent = CFG.gioMoCua; $('cHoursLi').hidden = false; }
    $('fbMaps').href = CFG.mapLink;
  }

  /* ---------- Chi tiết + lịch ---------- */
  let cur = null, calY, calM, selA = null, selB = null;
  function openDress(id) {
    cur = products.find((d) => d.id === id); if (!cur) return;
    $('ddCode').textContent = 'Mã ' + cur.id;
    $('ddName').textContent = cur.name;
    $('ddPrice').innerHTML = !cur.p24 ? '<li>Liên hệ để biết giá thuê</li>' : cur.accessory ? `<li>Thuê <b>${money(cur.p24)}</b></li>` :
      `<li>Gói thuê 24 giờ: <b>${money(cur.p24)}</b></li>` + (cur.p48 ? `<li>Gói thuê 48 giờ: <b>${money(cur.p48)}</b></li>` : '') +
      '<li class="extra">Từ ngày thứ 4 trở đi chỉ thêm 10.000 – 20.000đ/ngày tùy mẫu</li>';
    const meta = [['Màu', cur.color], ['Size gốc', cur.sizes.join(', ')], ['Chiều dài', cur.length ? cur.length + ' cm' : '']].filter((m) => m[1]);
    $('ddMeta').innerHTML = meta.map((m) => `<dt>${m[0]}</dt><dd>${esc(m[1])}</dd>`).join('');
    $('ddDesc').textContent = cur.desc;
    $('ddFit').hidden = !!cur.accessory;
    if (cur.imgs.length) {
      if (!$('ddMain')) restoreMain();
      $('ddMain').hidden = false; setMain(0);
      $('ddThumbs').innerHTML = cur.imgs.map((u, i) => `<img src="${esc(u)}" alt="Ảnh ${i + 1}" data-i="${i}" class="${i === 0 ? 'on' : ''}">`).join('');
    } else { $('ddMain').hidden = true; $('ddThumbs').innerHTML = `<div class="ph dd-noimg" style="position:relative;width:100%"><svg><use href="#hanger"/></svg><span>Ảnh đang cập nhật</span></div>`; }
    [['dH', 'h'], ['dW', 'w'], ['dB', 'b'], ['dWa', 'wa'], ['dHi', 'hi']].forEach(([i, k]) => ($(i).value = ME[k] || ''));
    const r = rangeNow(); selA = r ? r[0] : null; selB = r ? r[1] : null;
    const t = new Date(); calY = t.getFullYear(); calM = t.getMonth();
    if (selA != null) { const d = numToDate(selA); calY = d.getUTCFullYear(); calM = d.getUTCMonth(); }
    renderCal();
    if (!$('dressDlg').open) $('dressDlg').showModal();
    $('dressDlg').scrollTop = 0;
  }
  function restoreMain() {}
  function setMain(i) { $('ddMain').src = cur.imgs[i]; $('ddMain').alt = cur.name; document.querySelectorAll('#ddThumbs img').forEach((im, k) => im.classList.toggle('on', k === i)); }
  $('ddThumbs').addEventListener('click', (e) => { const im = e.target.closest('img'); if (im && im.dataset.i) setMain(+im.dataset.i); });
  $('dressClose').addEventListener('click', () => $('dressDlg').close());

  [['dH', 'h'], ['dW', 'w'], ['dB', 'b'], ['dWa', 'wa'], ['dHi', 'hi']].forEach(([i, k]) => $(i).addEventListener('input', (e) => {
    ME[k] = +e.target.value || null;
    const g = { h: 'mH', w: 'mW', b: 'mB', wa: 'mWa', hi: 'mHi' }[k]; $(g).value = e.target.value;
  }));
  $('ddAsk').addEventListener('click', () => contact('messenger', measureText(`Chào Aurelia, mình muốn gặp nhân viên tư vấn size váy "${cur.name}" (mã ${cur.id}).`)));

  function renderCal() {
    const first = new Date(Date.UTC(calY, calM, 1)); const lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(calY, calM + 1, 0)).getUTCDate(); const today = todayNum();
    $('calMonth').textContent = `Tháng ${calM + 1}/${calY}`;
    let h = '';
    for (let i = 0; i < lead; i++) h += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const n = dayNum(calY, calM, d); let cls = 'free';
      if (n < today) cls = 'past'; else if (isBusyDay(cur.id, n)) cls = 'busy';
      const lo = selA, hi = selB != null ? selB : selA;
      if (lo != null && n >= lo && n <= hi && cls !== 'busy') cls += (n === lo || n === hi) ? ' sel' : ' inrange';
      if (n === today) cls += ' today';
      h += `<button type="button" class="${cls}" data-n="${n}" ${cls.startsWith('past') ? 'disabled' : ''} aria-label="${fmtDay(n)}">${d}</button>`;
    }
    $('calGrid').innerHTML = h; updateStatus();
  }
  function updateStatus() {
    const s = $('calStatus'); s.className = 'cal-status';
    if (selA == null) { s.textContent = 'Bấm ngày nhận, rồi bấm ngày trả.'; return; }
    const b = selB != null ? selB : selA;
    if (isBusyRange(cur.id, selA, b)) { s.textContent = 'Khoảng ngày này đã có người thuê. Bạn chọn ngày khác nhé.'; s.classList.add('bad'); return; }
    s.textContent = `Còn trống: ${fmtDay(selA)}${b !== selA ? ' → ' + fmtDay(b) : ''}. Bấm "Nhắn Messenger" để giữ váy!`; s.classList.add('ok');
  }
  $('calGrid').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return; const n = +b.dataset.n;
    if (isBusyDay(cur.id, n)) { toast('Ngày này đã có người thuê.'); return; }
    if (selA == null || selB != null) { selA = n; selB = null; } else if (n < selA) { selA = n; } else { selB = n; }
    renderCal();
  });
  $('calPrev').addEventListener('click', () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
  $('calNext').addEventListener('click', () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });

  function bookingText(d, a, b) {
    let t = `Chào Aurelia Dress Up, mình muốn thuê "${d.name}" (mã ${d.id})`;
    if (a != null) t += ` từ ${fmtDay(a)}` + (b != null && b !== a ? ` đến ${fmtDay(b)}` : '');
    return measureText(t + '.') + ' Nhờ shop kiểm tra giúp mình nhé!';
  }
  $('ddBook').addEventListener('click', () => $('dressDlg').close());
  $('ddMsg').addEventListener('click', () => contact('messenger', bookingText(cur, selA, selB)));
  $('lightClose').addEventListener('click', () => $('lightDlg').close());
  ['dressDlg', 'lightDlg'].forEach((i) => $(i).addEventListener('click', (e) => { if (e.target === $(i)) $(i).close(); }));

  /* ---------- Feedback ---------- */
  function renderFeedback() {
    const photos = feedback.filter((f) => f.imgs.length), reviews = feedback.filter((f) => f.text);
    $('fbReviews').innerHTML = reviews.map((f) => `<div class="rv"><div class="stars" aria-label="${f.stars} sao">${'★'.repeat(f.stars)}${'☆'.repeat(5 - f.stars)}</div><p>${esc(f.text)}</p><b>${esc(f.name || 'Khách hàng Aurelia')}</b></div>`).join('');
    $('fbGrid').innerHTML = photos.flatMap((f) => f.imgs).map((u) => `<img src="${esc(u)}" alt="Feedback của khách" loading="lazy" data-light="${esc(u)}">`).join('');
    $('fbEmpty').hidden = feedback.length > 0;
    document.querySelectorAll('#fbReviews').forEach((e) => (e.previousElementSibling.hidden = !reviews.length));
    $('fbGrid').previousElementSibling.hidden = !photos.length;
    const strip = photos.flatMap((f) => f.imgs).slice(0, 4);
    $('fbStrip').innerHTML = strip.map((u) => `<button class="blob-s" style="background-image:url('${esc(u)}')" data-light="${esc(u)}" aria-label="Xem ảnh feedback"></button>`).join('');
    document.querySelector('.fb-teaser').hidden = !strip.length;
  }
  document.addEventListener('click', (e) => { const l = e.target.closest('[data-light]'); if (l) { $('lightImg').src = l.dataset.light; $('lightDlg').showModal(); } });

  /* ---------- Chuyển trang (Trang chủ / Feedback) ---------- */
  function route() {
    const h = location.hash.replace('#', '') || 'trang-chu';
    const fb = h === 'feedback', bk = h === 'dat-lich', ru = h === 'quy-dinh';
    $('viewHome').hidden = fb || bk || ru; $('viewFeedback').hidden = !fb; $('viewBook').hidden = !bk; $('viewRules').hidden = !ru;
    const sub = fb ? 'feedback' : bk ? 'book' : ru ? 'rules' : '';
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', sub ? a.dataset.view === sub : a.getAttribute('href') === '#' + h));
    if (sub) window.scrollTo(0, 0);
    else { const el = document.getElementById(h); if (el) setTimeout(() => el.scrollIntoView(), 30); }
    observeReveal();
  }
  window.addEventListener('hashchange', route);

  /* ---------- Hiệu ứng hiện dần khi cuộn ---------- */
  let io = null;
  function observeReveal() {
    const els = document.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    io = io || new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Màn chào ---------- */
  function initWelcome() {
    const w = $('welcome');
    let seen = false; try { seen = sessionStorage.getItem('aurelia-welcome') === '1'; } catch (e) {}
    const h = location.hash.replace('#', '');
    if (seen || (h && h !== 'trang-chu')) return;
    w.hidden = false; document.body.classList.add('no-scroll');
    const close = (go) => {
      try { sessionStorage.setItem('aurelia-welcome', '1'); } catch (e) {}
      w.classList.add('out'); document.body.classList.remove('no-scroll');
      setTimeout(() => { w.hidden = true; }, 600);
      if (go) { if (location.hash === '#' + go) route(); else location.hash = '#' + go; }
    };
    w.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) close(b.dataset.go); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.hidden) close('trang-chu'); });
    const first = w.querySelector('.w-btn'); if (first) first.focus({ preventScroll: true });
  }

  /* ---------- Khởi động ---------- */
  fillContact(); initWelcome(); bindBooking();
  Promise.all(['sanPham', 'phuKien', 'anh', 'lich', 'feedback'].map(getTab)).then(([sp, pk, anh, lich, fb]) => {
    buildProducts(toObjects(sp), toObjects(pk), toObjects(anh));
    bookings = {};
    toObjects(lich).forEach((o) => {
      const a = parseDay(o.tungay), b = parseDay(o.denngay || o.tungay), id = baseCode(o.masanpham || o.mavay || '');
      if (!id || a == null || b == null) return;
      (bookings[id] = bookings[id] || []).push([Math.min(a, b), Math.max(a, b)]);
    });
    feedback = toObjects(fb).map((o) => ({ imgs: (o.anh || '').split('|').map(fixImg).filter(Boolean), name: o.ten || '', text: o.noidung || '', stars: Math.max(1, Math.min(5, +o.sao || 5)) })).filter((f) => f.imgs.length || f.text);
    buildCats(); buildChips(); bindFilters(); renderGrid(); renderFeedback(); route();
  }).catch((e) => { $('resultLine').textContent = 'Không tải được danh sách. Hãy mở trang qua địa chỉ web (không bấm đúp vào file).'; console.error(e); });
})();
