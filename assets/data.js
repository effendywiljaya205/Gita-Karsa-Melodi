/* =========================================================
   DATA & PENYIMPANAN — Gita Karsa Melodi (prototype)
   Semua data disimpan di localStorage browser.
   ========================================================= */

const GKM = {
  PACKAGES: [
    { id: 'P1', name: 'Paket 1', watt: 4000, price: 3500000,
      items: ['2 Subwoofer 18"', '2 Speaker TW215 aktif', '4 Monitor 15"', '2 Mic wireless', '2 Mic kabel', 'Mixer + Sound man'] },
    { id: 'P2', name: 'Paket 2', watt: 3000, price: 3000000,
      items: ['2 Subwoofer 18"', '2 Speaker 15" aktif (main)', '2 Monitor 15"', '2 Mic wireless', '2 Mic kabel', 'Mixer + Sound man'] },
    { id: 'P3', name: 'Paket 3', watt: 3000, price: 2500000,
      items: ['2 Speaker TW215 aktif', '2 Monitor 15"', '2 Mic wireless', '2 Mic kabel', 'Mixer + Sound man'] },
    { id: 'P4', name: 'Paket 4', watt: 2000, price: 2000000,
      items: ['2 Speaker 15" aktif', '2 Monitor 15"', '2 Mic wireless', '2 Mic kabel', 'Mixer + Sound man'] },
    { id: 'P5', name: 'Paket 5', watt: 1000, price: 1500000,
      items: ['2 Speaker 15" aktif', '2 Mic wireless', '2 Mic kabel', 'Mixer + Sound man', 'Tanpa monitor'] },
  ],
  EVENTS: ['Wedding', 'Lamaran', 'Syukuran', 'Seminar', 'Birthday', 'Graduation', 'Karaoke', 'Lainnya'],
  ADDON_PRICE: 600000,     // MC / pemain musik per orang
  OVERTIME_PRICE: 150000,  // per jam
  DP_RATE: 0.5,
  BANK: 'BCA 123-456-7890 a.n. Gita Karsa Melodi (nomor contoh)',
  CONTACTS: [
    { name: 'Bello', phone: '089531573288' },
    { name: 'Vedro', phone: '081237757534' },
  ],
  ADMIN_PASSWORD: 'admin123',
  STATUS: {
    pending:   'Menunggu DP',
    confirmed: 'DP Diterima',
    lunas:     'Lunas',
    cancelled: 'Dibatalkan',
  },
};

/* ---------- helper ---------- */
const rupiah = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${HARI[dt.getDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
}
function pkgById(id) { return GKM.PACKAGES.find(p => p.id === id); }

function calcPrice({ pkg, addon = 0, overtime = 0 }) {
  const p = pkgById(pkg);
  const base = p ? p.price : 0;
  const addonTotal = addon * GKM.ADDON_PRICE;
  const otTotal = overtime * GKM.OVERTIME_PRICE;
  const total = base + addonTotal + otTotal;
  return { base, addonTotal, otTotal, total, dp: total * GKM.DP_RATE };
}

/* ---------- storage ----------
   Mode ONLINE  : config.js terisi -> data di Supabase (semua HP/laptop lihat data yang sama).
                  Salinan disimpan di memori/localStorage supaya tampilan cepat.
   Mode LOKAL   : config.js kosong -> data hanya di browser ini.
-------------------------------------------------------- */
const CLOUD = typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL && typeof SUPABASE_KEY !== 'undefined' && SUPABASE_KEY;
const KEY_BOOKINGS = CLOUD ? 'gkm_cloud_bookings' : 'gkm_bookings_v1';
const KEY_BLOCKED = CLOUD ? 'gkm_cloud_blocked' : 'gkm_blocked_v1';

let _bookings = null, _blocked = null;          // salinan data saat ini
let _syncedBookings = {}, _syncedBlocked = {};  // kondisi terakhir yang sama dengan server

function _readLocal(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function _writeLocal(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

function loadBookings() {
  if (!_bookings) {
    _bookings = _readLocal(KEY_BOOKINGS);
    if (!_bookings) { _bookings = CLOUD ? [] : seedBookings(); _writeLocal(KEY_BOOKINGS, _bookings); }
  }
  return _bookings.map(b => ({ ...b }));
}
function saveBookings(list) {
  _bookings = list.map(b => ({ ...b }));
  _writeLocal(KEY_BOOKINGS, _bookings);
  if (CLOUD) return _pushBookings();
  return Promise.resolve();
}
function loadBlocked() {
  if (!_blocked) {
    _blocked = _readLocal(KEY_BLOCKED);
    if (!_blocked) { _blocked = CLOUD ? [] : seedBlocked(); _writeLocal(KEY_BLOCKED, _blocked); }
  }
  return _blocked.map(b => ({ ...b }));
}
function saveBlocked(list) {
  _blocked = list.map(b => ({ ...b }));
  _writeLocal(KEY_BLOCKED, _blocked);
  if (CLOUD) return _pushBlocked();
  return Promise.resolve();
}
function newId(list) {
  const max = list.reduce((m, b) => Math.max(m, parseInt(String(b.id).replace('GKM-', ''), 10) || 0), 0);
  return 'GKM-' + String(max + 1).padStart(4, '0');
}

/* ----- Supabase (lewat REST API, tanpa library tambahan) ----- */
function _api(path, opts = {}) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (String(SUPABASE_KEY).startsWith('eyJ')) headers.Authorization = 'Bearer ' + SUPABASE_KEY;
  return fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + path, { ...opts, headers }).then(async r => {
    if (!r.ok) { const t = await r.text(); const err = new Error(t || r.statusText); err.status = r.status; err.body = t; throw err; }
    return r.status === 204 ? null : r.json().catch(() => null);
  });
}
const _toRow = b => ({ id: b.id, name: b.name, phone: b.phone, event: b.event, event_date: b.date, address: b.address,
  package: b.pkg, addon: b.addon, overtime: b.overtime, payment: b.payment, notes: b.notes || '',
  total: b.total, dp: b.dp, status: b.status, dp_paid: !!b.dpPaid, created_at: b.createdAt });
const _fromRow = r => ({ id: r.id, name: r.name, phone: r.phone, event: r.event, date: r.event_date, address: r.address,
  pkg: r.package, addon: r.addon, overtime: r.overtime, payment: r.payment, notes: r.notes || '',
  total: Number(r.total), dp: Number(r.dp), status: r.status, dpPaid: r.dp_paid, createdAt: r.created_at });
const _snap = (list, key) => Object.fromEntries(list.map(x => [x[key], JSON.stringify(x)]));

let _pushChain = Promise.resolve();
function _pushBookings() {
  _pushChain = _pushChain.then(async () => {
    const cur = _snap(_bookings, 'id');
    const prev = _syncedBookings;
    const toDelete = Object.keys(prev).filter(id => !(id in cur));
    const toInsert = _bookings.filter(b => !(b.id in prev));
    const toUpdate = _bookings.filter(b => b.id in prev && prev[b.id] !== cur[b.id]);
    for (const id of toDelete) await _api('bookings?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
    if (toInsert.length) await _api('bookings', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(toInsert.map(_toRow)) });
    for (const b of toUpdate) await _api('bookings?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(_toRow(b)) });
    _syncedBookings = cur;
  }).catch(e => { _syncError(e); throw e; });
  return _pushChain;
}
let _pushBlockChain = Promise.resolve();
function _pushBlocked() {
  _pushBlockChain = _pushBlockChain.then(async () => {
    const cur = _snap(_blocked, 'date');
    const prev = _syncedBlocked;
    for (const d of Object.keys(prev).filter(d => !(d in cur))) await _api('blocked_dates?block_date=eq.' + d, { method: 'DELETE' });
    const changed = _blocked.filter(b => prev[b.date] !== cur[b.date]);
    if (changed.length) await _api('blocked_dates', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(changed.map(b => ({ block_date: b.date, reason: b.reason }))) });
    _syncedBlocked = cur;
  }).catch(e => { _syncError(e); throw e; });
  return _pushBlockChain;
}
function _syncError(e) {
  console.error('Gagal sinkron ke Supabase:', e);
  if (typeof toast === 'function') toast('Gagal menyimpan ke database online. Cek koneksi internet.');
}

/* Ambil data terbaru dari server. Dipanggil saat halaman dibuka & berkala. */
async function refreshData() {
  if (!CLOUD) return false;
  await _pushChain.catch(() => {}); await _pushBlockChain.catch(() => {});
  const [rows, blk] = await Promise.all([
    _api('bookings?select=*&order=event_date.asc'),
    _api('blocked_dates?select=*&order=block_date.asc'),
  ]);
  const bookings = rows.map(_fromRow);
  const blocked = blk.map(r => ({ date: r.block_date, reason: r.reason || '' }));
  const changed = JSON.stringify(bookings) !== JSON.stringify(_bookings) || JSON.stringify(blocked) !== JSON.stringify(_blocked);
  _bookings = bookings; _blocked = blocked;
  _syncedBookings = _snap(bookings, 'id'); _syncedBlocked = _snap(blocked, 'date');
  _writeLocal(KEY_BOOKINGS, bookings); _writeLocal(KEY_BLOCKED, blocked);
  return changed;
}

/* Siap dipakai: di mode online, tunggu data pertama dari server. Kalau database masih kosong, isi data contoh. */
let _readyPromise = null;
let dbError = '';   // pesan kalau gagal terhubung (ditampilkan di admin)
function dbReady() {
  if (_readyPromise) return _readyPromise;
  _readyPromise = (async () => {
    if (!CLOUD) return;
    try {
      await refreshData();
      if (!_bookings.length && !_blocked.length) await _seedCloud();
    } catch (e) {
      console.error(e);
      const body = String(e.body || e.message || '');
      dbError = (e.status === 404 || /PGRST205|does not exist|schema cache/i.test(body))
        ? 'Tabel belum dibuat. Jalankan supabase-setup.sql di Supabase > SQL Editor.'
        : (e.status === 401 || /api key/i.test(body)) ? 'Key Supabase salah. Cek assets/config.js.'
        : 'Tidak bisa terhubung ke database online. Cek internet.';
      if (typeof toast === 'function') toast(dbError);
    }
  })();
  return _readyPromise;
}
async function _seedCloud() {
  _bookings = seedBookings();
  await saveBookings(_bookings);
  _blocked = seedBlocked();
  await saveBlocked(_blocked);
}
async function resetData() {
  if (CLOUD) {
    await _api('bookings?id=neq.__none__', { method: 'DELETE' });
    await _api('blocked_dates?reason=neq.__none__', { method: 'DELETE' });
    await _api('blocked_dates?reason=is.null', { method: 'DELETE' });
    _syncedBookings = {}; _syncedBlocked = {};
    await _seedCloud();
  } else {
    try { localStorage.removeItem(KEY_BOOKINGS); localStorage.removeItem(KEY_BLOCKED); } catch (e) {}
    _bookings = null; _blocked = null;
  }
}

/* Uang yang sudah benar-benar diterima dari satu pesanan */
function received(b) {
  if (b.status === 'lunas') return b.total;
  if (b.status === 'confirmed') return b.dp;
  if (b.status === 'cancelled' && b.dpPaid) return b.dp; // DP hangus
  return 0;
}

/* Status tanggal untuk kalender: 'booked' | 'pending' | 'blocked' | 'free' */
function dateStatus(iso, bookings, blocked) {
  if (blocked.some(b => b.date === iso)) return 'blocked';
  const active = bookings.filter(b => b.date === iso && b.status !== 'cancelled');
  if (active.some(b => b.status === 'confirmed' || b.status === 'lunas')) return 'booked';
  if (active.length) return 'pending';
  return 'free';
}

/* ---------- data contoh (simulasi) ---------- */
function seedBookings() {
  // generator angka acak yang selalu sama hasilnya (supaya data contoh konsisten)
  let s = 20261123;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const names = ['Rina Wulandari','Budi Santoso','Hendra Wijaya','Siti Rahmawati','Agus Pratama','Lestari Putri',
    'Yohanes Kurniawan','Fransiska Lim','Dedi Saputra','Maria Angelina','Rudi Hartono','Nur Aisyah','Kevin Tanoto',
    'Dewi Anggraini','Fajar Ramadhan','Stefani Halim','Joko Susilo','Melati Sari','Andreas Gunawan','Putri Ayu',
    'Hj. Fatimah','Ivan Setiawan','Clara Wijaya','Rizky Maulana','PT Borneo Jaya','Universitas Tanjungpura (BEM)',
    'Gereja Santo Yosef','Paguyuban Tionghoa Pontianak','SMA Negeri 1 Pontianak','Ahmad Fauzi'];
  const areas = ['Jl. Ahmad Yani','Jl. Gajah Mada','Jl. Tanjungpura','Jl. Sungai Raya Dalam','Jl. Purnama','Jl. Parit Haji Husin',
    'Jl. Imam Bonjol','Jl. Diponegoro','Jl. Sultan Abdurrahman','Jl. Reformasi','Jl. Kom Yos Sudarso','Jl. Veteran'];
  // bobot: paket & acara populer muncul lebih sering
  const pkgW = ['P1','P2','P2','P3','P3','P3','P4','P4','P4','P4','P5','P5'];
  const evW = ['Wedding','Wedding','Wedding','Wedding','Lamaran','Lamaran','Syukuran','Syukuran','Seminar','Birthday','Birthday','Graduation','Karaoke','Lainnya'];
  // jumlah acara per bulan (Juni 2026 – Januari 2027)
  const months = [[2026,5,5],[2026,6,7],[2026,7,6],[2026,8,5],[2026,9,7],[2026,10,9],[2026,11,10],[2027,0,4]];

  const today = todayISO();
  const list = [];
  const used = new Set();
  let id = 1;
  for (const [y, m, count] of months) {
    const days = new Date(y, m + 1, 0).getDate();
    let made = 0, guard = 0;
    while (made < count && guard++ < 200) {
      // akhir pekan lebih sering
      let d = 1 + Math.floor(rnd() * days);
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6 && rnd() < 0.7) continue;
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      if (used.has(iso)) continue;
      used.add(iso);

      let ev = pick(evW);
      if (m === 10 || m === 11) { if (rnd() < 0.25) ev = 'Graduation'; }  // musim wisuda
      const pkg = (ev === 'Wedding' && rnd() < 0.5) ? pick(['P1','P2']) : (ev === 'Karaoke' || ev === 'Birthday') ? pick(['P4','P5']) : pick(pkgW);
      const addon = ev === 'Wedding' ? Math.floor(rnd() * 3) : (rnd() < 0.2 ? 1 : 0);
      const overtime = rnd() < 0.3 ? 1 + Math.floor(rnd() * 3) : 0;
      const price = calcPrice({ pkg, addon, overtime });

      let status;
      if (iso < today) status = rnd() < 0.08 ? 'cancelled' : 'lunas';
      else status = rnd() < 0.6 ? 'confirmed' : (rnd() < 0.85 ? 'pending' : 'cancelled');

      const created = new Date(y, m, d - (7 + Math.floor(rnd() * 40)));
      list.push({
        id: 'GKM-' + String(id++).padStart(4, '0'),
        name: pick(names),
        phone: '08' + Math.floor(1e9 + rnd() * 8.9e9),
        event: ev,
        date: iso,
        address: `${pick(areas)} No. ${1 + Math.floor(rnd() * 150)}, Pontianak`,
        pkg, addon, overtime,
        payment: rnd() < 0.7 ? 'Transfer BCA' : 'Cash',
        notes: '',
        total: price.total,
        dp: price.dp,
        status,
        dpPaid: status === 'confirmed' || status === 'lunas' || (status === 'cancelled' && rnd() < 0.5),
        createdAt: toISO(created),
      });
      made++;
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date)).map((b, i) => ({ ...b, id: 'GKM-' + String(i + 1).padStart(4, '0') }));
}

function seedBlocked() {
  // contoh: tanggal alat sedang servis / tim libur
  const booked = new Set(loadBookings().map(b => b.date));
  const d = new Date();
  const out = [];
  for (let i = 8; out.length < 2 && i < 60; i++) {
    const iso = toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
    if (!booked.has(iso)) out.push({ date: iso, reason: 'Servis alat rutin' });
  }
  return out;
}
