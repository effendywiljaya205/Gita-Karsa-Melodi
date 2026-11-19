/* ===== Halaman admin: login, dashboard, data pesanan, jadwal ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = n => n >= 1e6 ? (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt' : n >= 1e3 ? Math.round(n / 1e3) + ' rb' : String(n);
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- login sederhana (prototype) ---------- */
function isLoggedIn() { try { return sessionStorage.getItem('gkm_admin') === '1'; } catch (e) { return false; } }
function showAdmin() { $('loginView').style.display = 'none'; $('adminView').classList.add('show'); renderAll(); }
$('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  if ($('pw').value === GKM.ADMIN_PASSWORD) {
    try { sessionStorage.setItem('gkm_admin', '1'); } catch (e) {}
    showAdmin();
  } else toast('Password salah.');
});
$('logoutBtn').addEventListener('click', () => { try { sessionStorage.removeItem('gkm_admin'); } catch (e) {} location.reload(); });

/* ---------- tab ---------- */
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + b.dataset.tab));
  renderAll();
});

function renderAll() { renderDashboard(); renderBookings(); if (adminCal) adminCal.render(); renderBlockList(); }

/* =================== DASHBOARD =================== */
function fillYearFilter() {
  const years = [...new Set(loadBookings().map(b => b.date.slice(0, 4)))].sort();
  const cur = $('yearFilter').value;
  $('yearFilter').innerHTML = '<option value="">Semua periode</option>' + years.map(y => `<option value="${y}">Tahun ${y}</option>`).join('');
  $('yearFilter').value = cur;
}
$('yearFilter').addEventListener('change', renderDashboard);

function hbars(rows, max) {
  return `<div class="hbars">${rows.map(r => `
    <div class="hbar"><span>${r.label}</span>
      <div class="track"><div class="fill" style="width:${max ? Math.max(4, r.value / max * 100) : 0}%">${r.value}</div></div>
      <span class="num">${r.extra || ''}</span></div>`).join('')}</div>`;
}

function renderDashboard() {
  fillYearFilter();
  const year = $('yearFilter').value;
  const all = loadBookings().filter(b => !year || b.date.startsWith(year)).sort((x, y) => x.date.localeCompare(y.date));
  const active = all.filter(b => b.status !== 'cancelled');
  const cancelled = all.filter(b => b.status === 'cancelled');
  const today = todayISO();

  const nilai = active.reduce((s, b) => s + b.total, 0);
  const kas = all.reduce((s, b) => s + received(b), 0);
  const piutang = active.reduce((s, b) => s + b.total - received(b), 0);
  const avg = active.length ? nilai / active.length : 0;
  const cancelRate = all.length ? cancelled.length / all.length * 100 : 0;
  const pendingCount = all.filter(b => b.status === 'pending').length;

  const range = all.length ? `${fmtDate(all[0].date).split(', ')[1]} – ${fmtDate(all[all.length - 1].date).split(', ')[1]}` : '';
  $('dashPeriod').textContent = `${all.length} pesanan · ${range}`;

  $('kpis').innerHTML = `
    <div class="kpi dark"><span>Uang diterima</span><b>${rupiah(kas)}</b><small>DP + pelunasan + DP hangus</small></div>
    <div class="kpi"><span>Total nilai pesanan</span><b>${rupiah(nilai)}</b><small>${active.length} pesanan aktif/selesai</small></div>
    <div class="kpi"><span>Belum dibayar (piutang)</span><b>${rupiah(piutang)}</b><small>${pendingCount} pesanan menunggu DP</small></div>
    <div class="kpi"><span>Rata-rata per pesanan</span><b>${rupiah(avg)}</b><small>Pembatalan ${cancelRate.toFixed(0)}%</small></div>`;

  /* --- per bulan --- */
  const months = {};
  active.forEach(b => { const k = b.date.slice(0, 7); months[k] = months[k] || { total: 0, count: 0 }; months[k].total += b.total; months[k].count++; });
  const mKeys = Object.keys(months).sort();
  const mMax = Math.max(1, ...mKeys.map(k => months[k].total));
  const curMonth = today.slice(0, 7);
  $('chartMonth').innerHTML = `
    <div class="vbars">${mKeys.map(k => `
      <div class="vbar" title="${BULAN[+k.slice(5) - 1]} ${k.slice(0, 4)}: ${months[k].count} pesanan, ${rupiah(months[k].total)}">
        <div class="val">${short(months[k].total)}</div>
        <div class="bar ${k > curMonth ? 'future' : ''}" style="height:${months[k].total / mMax * 85}%"></div>
      </div>`).join('')}</div>
    <div class="vlabels">${mKeys.map(k => `<span>${BULAN[+k.slice(5) - 1].slice(0, 3)} ${k.slice(2, 4)}<br><b style="color:#111">${months[k].count}</b></span>`).join('')}</div>
    <div class="chart-legend"><span><i></i>Sudah berjalan</span><span><i class="f"></i>Terjadwal (bulan depan)</span><span>Angka bawah = jumlah pesanan</span></div>`;

  /* --- status --- */
  const stRows = Object.entries(GKM.STATUS).map(([k, label]) => ({ label, value: all.filter(b => b.status === k).length }));
  $('chartStatus').innerHTML = hbars(stRows.map(r => ({ ...r, extra: all.length ? (r.value / all.length * 100).toFixed(0) + '%' : '' })), Math.max(...stRows.map(r => r.value)));

  /* --- per paket --- */
  const pkRows = GKM.PACKAGES.map(p => {
    const list = active.filter(b => b.pkg === p.id);
    return { id: p.id, label: `${p.name}`, value: list.length, money: list.reduce((s, b) => s + b.total, 0) };
  });
  $('chartPkg').innerHTML = hbars(pkRows.map(r => ({ ...r, extra: rupiah(r.money) })), Math.max(...pkRows.map(r => r.value)));

  /* --- per acara --- */
  const evRows = GKM.EVENTS.map(ev => {
    const list = active.filter(b => b.event === ev);
    return { label: ev, value: list.length, money: list.reduce((s, b) => s + b.total, 0) };
  }).sort((a, b) => b.value - a.value);
  $('chartEvent').innerHTML = hbars(evRows.map(r => ({ ...r, extra: rupiah(r.money) })), Math.max(...evRows.map(r => r.value)));

  /* --- per hari --- */
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  const dowCount = dowOrder.map(d => ({ label: HARI[d], value: active.filter(b => { const [y, m, dd] = b.date.split('-').map(Number); return new Date(y, m - 1, dd).getDay() === d; }).length }));
  $('chartDow').innerHTML = hbars(dowCount.map(r => ({ ...r, extra: active.length ? (r.value / active.length * 100).toFixed(0) + '%' : '' })), Math.max(...dowCount.map(r => r.value)));

  /* --- 14 hari ke depan --- */
  const in14 = new Date(); in14.setDate(in14.getDate() + 14);
  const up = loadBookings().filter(b => b.status !== 'cancelled' && b.date > today && b.date <= toISO(in14)).sort((a, b) => a.date.localeCompare(b.date));
  $('upcomingList').innerHTML = up.length ? `<ul class="block-list">${up.map(b => `
      <li><div><b>${fmtDate(b.date)}</b><br><span style="color:#888;font-size:13px">${esc(b.name)} · ${b.event} · ${pkgById(b.pkg).name}</span></div>
      <div style="text-align:right"><span class="badge b-${b.status}">${GKM.STATUS[b.status]}</span><br><span style="color:#888;font-size:12px">Sisa ${rupiah(b.total - received(b))}</span></div></li>`).join('')}</ul>`
    : '<p style="color:#888">Tidak ada acara dalam 14 hari ke depan.</p>';

  /* --- analisis & rekomendasi --- */
  const topPkg = [...pkRows].sort((a, b) => b.value - a.value)[0];
  const topPkgMoney = [...pkRows].sort((a, b) => b.money - a.money)[0];
  const lowPkg = [...pkRows].sort((a, b) => a.value - b.value)[0];
  const topEv = evRows[0];
  const topMonth = [...mKeys].sort((a, b) => months[b].count - months[a].count)[0];
  const weekend = dowCount[5].value + dowCount[6].value;
  const weekendPct = active.length ? weekend / active.length * 100 : 0;
  const addonPct = active.length ? active.filter(b => b.addon > 0).length / active.length * 100 : 0;
  const otPct = active.length ? active.filter(b => b.overtime > 0).length / active.length * 100 : 0;
  const forfeited = cancelled.filter(b => b.dpPaid).reduce((s, b) => s + b.dp, 0);
  const pct = (a, b) => b ? (a / b * 100).toFixed(0) : 0;

  if (!active.length) { $('insights').innerHTML = '<li>Belum ada data.</li>'; $('recs').innerHTML = ''; return; }
  $('insights').innerHTML = [
    `<b>${topPkg.label}</b> paling sering dipesan (${topPkg.value} dari ${active.length} pesanan, ${pct(topPkg.value, active.length)}%).`,
    `Pendapatan terbesar datang dari <b>${topPkgMoney.label}</b> sebesar ${rupiah(topPkgMoney.money)} (${pct(topPkgMoney.money, nilai)}% dari total nilai).`,
    `<b>${topEv.label}</b> adalah jenis acara terbanyak (${topEv.value} pesanan, ${pct(topEv.value, active.length)}%).`,
    `Bulan paling ramai: <b>${BULAN[+topMonth.slice(5) - 1]} ${topMonth.slice(0, 4)}</b> dengan ${months[topMonth].count} pesanan.`,
    `<b>${weekendPct.toFixed(0)}%</b> acara jatuh di hari Sabtu/Minggu, hari kerja masih banyak kosong.`,
    `${addonPct.toFixed(0)}% penyewa menambah MC/musisi, ${otPct.toFixed(0)}% memakai overtime.`,
    `Tingkat pembatalan ${cancelRate.toFixed(0)}%. DP hangus yang tetap jadi pemasukan: ${rupiah(forfeited)}.`,
  ].map(t => `<li>${t}</li>`).join('');

  $('recs').innerHTML = [
    `Pastikan alat untuk <b>${topPkg.label}</b> selalu siap dan pertimbangkan menambah unit, karena paket ini paling laku.`,
    `Buat paket bundling <b>${topEv.label}</b> (sound + MC) karena acara ini dominan dan ${addonPct.toFixed(0)}% penyewa sudah memakai MC/musisi.`,
    `Beri promo hari kerja (Senin–Jumat) untuk mengisi jadwal kosong, karena ${weekendPct.toFixed(0)}% pesanan menumpuk di akhir pekan.`,
    `Siapkan kru cadangan dan buka booking lebih awal menjelang bulan ramai seperti <b>${BULAN[+topMonth.slice(5) - 1]}</b>.`,
    `<b>${lowPkg.label}</b> paling jarang dipesan, evaluasi harga atau gabungkan isinya ke paket lain.`,
    pendingCount ? `Follow up <b>${pendingCount} pesanan</b> yang belum bayar DP lewat WhatsApp supaya tanggal tidak tertahan.` : `Semua pesanan sudah membayar DP, pertahankan proses konfirmasi saat ini.`,
    `Pertahankan aturan DP 50% hangus, karena melindungi pendapatan saat ada pembatalan.`,
  ].map(t => `<li>${t}</li>`).join('');
}

/* =================== DATA PESANAN =================== */
['search', 'statusFilter', 'timeFilter'].forEach(id => $(id).addEventListener('input', renderBookings));

function renderBookings() {
  const q = $('search').value.toLowerCase().trim();
  const st = $('statusFilter').value;
  const tf = $('timeFilter').value;
  const today = todayISO();
  let list = loadBookings().filter(b =>
    (!st || b.status === st) &&
    (!tf || (tf === 'upcoming' ? b.date > today : b.date <= today)) &&
    (!q || [b.id, b.name, b.phone].join(' ').toLowerCase().includes(q)));
  list.sort((a, b) => tf === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  $('bookingRows').innerHTML = list.map(b => {
    const p = pkgById(b.pkg);
    const acts = [];
    if (b.status === 'pending') acts.push(`<button class="btn btn-ok" data-act="confirm" data-id="${b.id}">Konfirmasi DP</button>`);
    if (b.status === 'confirmed') acts.push(`<button class="btn" data-act="lunas" data-id="${b.id}">Tandai Lunas</button>`);
    if (b.status === 'pending' || b.status === 'confirmed') acts.push(`<button class="btn btn-ghost" data-act="cancel" data-id="${b.id}">Batalkan</button>`);
    acts.push(`<button class="btn btn-ghost btn-del" data-act="delete" data-id="${b.id}" title="Hapus pesanan dari daftar">Hapus</button>`);
    return `<tr>
      <td><b>${b.id}</b><div class="muted">Pesan ${b.createdAt}</div></td>
      <td>${fmtDate(b.date)}</td>
      <td>${esc(b.name)}<div class="muted">${esc(b.phone)}</div><div class="muted">${esc(b.address)}</div></td>
      <td>${b.event}${b.addon ? `<div class="muted">+${b.addon} MC/musisi</div>` : ''}${b.overtime ? `<div class="muted">+${b.overtime} jam overtime</div>` : ''}</td>
      <td>${p.name}<div class="muted">${p.watt}W</div></td>
      <td><b>${rupiah(b.total)}</b><div class="muted">DP ${rupiah(b.dp)} · ${b.payment}</div></td>
      <td><span class="badge b-${b.status}">${GKM.STATUS[b.status]}</span>${b.status === 'cancelled' && b.dpPaid ? '<div class="muted">DP hangus</div>' : ''}</td>
      <td><div class="actions-cell">${acts.join('') || '<span class="muted">—</span>'}</div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="text-align:center;color:#888;padding:30px">Tidak ada pesanan.</td></tr>`;
  $('rowCount').textContent = `Menampilkan ${list.length} pesanan.`;
}

$('bookingRows').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const list = loadBookings();
  const b = list.find(x => x.id === btn.dataset.id); if (!b) return;
  const act = btn.dataset.act;
  if (act === 'confirm') {
    const clash = list.find(x => x.id !== b.id && x.date === b.date && (x.status === 'confirmed' || x.status === 'lunas'));
    if (clash) return toast(`Tanggal sudah dikunci oleh ${clash.id}.`);
    b.status = 'confirmed'; b.dpPaid = true; toast(`${b.id}: DP diterima, tanggal dikunci.`);
  }
  if (act === 'delete') {
    if (btn.dataset.sure !== '1') {
      btn.dataset.sure = '1'; btn.textContent = 'Yakin hapus?'; btn.classList.add('btn-danger'); btn.classList.remove('btn-ghost');
      setTimeout(() => { if (btn.isConnected) { btn.dataset.sure = ''; btn.textContent = 'Hapus'; btn.classList.remove('btn-danger'); btn.classList.add('btn-ghost'); } }, 4000);
      return;
    }
    saveBookings(list.filter(x => x.id !== b.id));
    toast(`${b.id} dihapus dari daftar.`);
    renderAll();
    return;
  }
  if (act === 'lunas') { b.status = 'lunas'; toast(`${b.id}: sudah lunas.`); }
  if (act === 'cancel') {
    if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Yakin batal?'; btn.classList.add('btn-danger'); btn.classList.remove('btn-ghost'); return; }
    b.status = 'cancelled'; toast(b.dpPaid ? `${b.id} dibatalkan, DP hangus.` : `${b.id} dibatalkan.`);
  }
  saveBookings(list);
  renderAll();
});

$('exportBtn').addEventListener('click', () => {
  const head = ['Kode', 'Tanggal Acara', 'Nama', 'No HP', 'Acara', 'Alamat', 'Paket', 'MC/Musisi', 'Overtime (jam)', 'Pembayaran', 'Total', 'DP', 'Diterima', 'Status', 'Tanggal Pesan'];
  const rows = loadBookings().map(b => [b.id, b.date, b.name, "'" + b.phone, b.event, b.address, pkgById(b.pkg).name, b.addon, b.overtime, b.payment, b.total, b.dp, received(b), GKM.STATUS[b.status], b.createdAt]);
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'data-pesanan-gkm.csv';
  a.click();
  toast('File CSV diunduh, bisa dibuka di Excel.');
});

$('resetBtn').addEventListener('click', e => {
  const btn = e.currentTarget;
  if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Klik lagi untuk reset'; return; }
  resetData(); loadBookings(); loadBlocked();
  btn.dataset.sure = ''; btn.textContent = 'Reset data contoh';
  renderAll(); toast('Data dikembalikan ke data contoh.');
});

/* =================== JADWAL & BLOKIR =================== */
let adminCal = null;
let pickedDate = null;
function renderDayPanel() {
  const iso = pickedDate; if (!iso) return;
  const bookings = loadBookings().filter(b => b.date === iso);
  const blk = loadBlocked().find(b => b.date === iso);
  const st = dateStatus(iso, loadBookings(), loadBlocked());
  let html = `<h3>${fmtDate(iso)}</h3>`;
  if (blk) {
    html += `<p>Tanggal ini <b>ditutup</b>: ${esc(blk.reason)}</p><button class="btn btn-sm" style="margin-top:12px" id="unblockBtn">Buka kembali tanggal ini</button>`;
  } else if (st === 'free') {
    html += `<p style="color:#777">Tanggal masih kosong.</p>
      <div class="field"><label>Tutup tanggal ini? Alasan:</label><input id="blockReason" placeholder="cth. Servis alat / tim libur"></div>
      <button class="btn btn-sm" id="blockBtn">Tutup tanggal</button>`;
  }
  const act = bookings.filter(b => b.status !== 'cancelled');
  if (act.length || bookings.length) {
    html += bookings.map(b => `<div style="border-top:1px solid #eee;margin-top:12px;padding-top:12px">
      <span class="badge b-${b.status}">${GKM.STATUS[b.status]}</span>
      <p style="margin-top:8px"><b>${b.id}</b> · ${esc(b.name)} (${esc(b.phone)})<br>${b.event} · ${pkgById(b.pkg).name} · ${rupiah(b.total)}<br><span style="color:#888">${esc(b.address)}</span></p></div>`).join('');
  }
  $('dayPanel').innerHTML = html;
}
$('dayPanel').addEventListener('click', e => {
  if (e.target.id === 'blockBtn') {
    const list = loadBlocked();
    list.push({ date: pickedDate, reason: $('blockReason').value.trim() || 'Ditutup admin' });
    saveBlocked(list); toast('Tanggal ditutup.'); renderAll(); renderDayPanel();
  }
  if (e.target.id === 'unblockBtn') {
    saveBlocked(loadBlocked().filter(b => b.date !== pickedDate)); toast('Tanggal dibuka kembali.'); renderAll(); renderDayPanel();
  }
});
function renderBlockList() {
  const list = loadBlocked().sort((a, b) => a.date.localeCompare(b.date));
  $('blockList').innerHTML = list.length ? list.map(b => `<li><div><b>${fmtDate(b.date)}</b><br><span style="color:#888;font-size:13px">${esc(b.reason)}</span></div><button class="btn btn-ghost btn-sm" data-unblock="${b.date}">Buka</button></li>`).join('') : '<li style="color:#888">Belum ada tanggal yang ditutup.</li>';
}
$('blockList').addEventListener('click', e => {
  const d = e.target.closest('[data-unblock]'); if (!d) return;
  saveBlocked(loadBlocked().filter(b => b.date !== d.dataset.unblock)); toast('Tanggal dibuka kembali.'); renderAll(); renderDayPanel();
});

adminCal = createCalendar($('adminCal'), {
  light: true, allowPast: true, showNames: true,
  onPick(iso) { pickedDate = iso; adminCal.select(iso); renderDayPanel(); },
});

if (isLoggedIn()) showAdmin();
