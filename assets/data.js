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

/* ---------- storage ---------- */
const KEY_BOOKINGS = 'gkm_bookings_v1';
const KEY_BLOCKED = 'gkm_blocked_v1';

function loadBookings() {
  try {
    const raw = localStorage.getItem(KEY_BOOKINGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seed = seedBookings();
  saveBookings(seed);
  return seed;
}
function saveBookings(list) {
  try { localStorage.setItem(KEY_BOOKINGS, JSON.stringify(list)); } catch (e) {}
}
function loadBlocked() {
  try {
    const raw = localStorage.getItem(KEY_BLOCKED);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seed = seedBlocked();
  saveBlocked(seed);
  return seed;
}
function saveBlocked(list) {
  try { localStorage.setItem(KEY_BLOCKED, JSON.stringify(list)); } catch (e) {}
}
function resetData() {
  try { localStorage.removeItem(KEY_BOOKINGS); localStorage.removeItem(KEY_BLOCKED); } catch (e) {}
}
function newId(list) {
  const max = list.reduce((m, b) => Math.max(m, parseInt(b.id.replace('GKM-', ''), 10) || 0), 0);
  return 'GKM-' + String(max + 1).padStart(4, '0');
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
