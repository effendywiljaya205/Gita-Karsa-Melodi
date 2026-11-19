/* ===== Halaman publik: paket, kalender, form pemesanan ===== */
const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- katalog paket ---------- */
$('packageList').innerHTML = GKM.PACKAGES.map((p, i) => `
  <div class="pkg ${i === 0 ? 'featured' : ''}">
    <div class="tag">${i === 0 ? 'Paling lengkap' : p.watt >= 3000 ? 'Acara besar' : p.watt >= 2000 ? 'Acara sedang' : 'Acara kecil'}</div>
    <h3>${p.name}</h3>
    <div class="watt">${p.watt.toLocaleString('id-ID')} Watt</div>
    <div class="price">${rupiah(p.price)}</div>
    <ul>${p.items.map(it => `<li>${it}</li>`).join('')}</ul>
    <a href="#pesan" class="btn btn-sm" data-choose="${p.id}">Pilih ${p.name}</a>
  </div>`).join('');

document.addEventListener('click', e => {
  const c = e.target.closest('[data-choose]');
  if (c) { $('fPkg').value = c.dataset.choose; updateSummary(); }
});

/* ---------- isi dropdown ---------- */
$('fEvent').innerHTML = '<option value="">Pilih jenis acara</option>' + GKM.EVENTS.map(e => `<option>${e}</option>`).join('');
$('fPkg').innerHTML = GKM.PACKAGES.map(p => `<option value="${p.id}">${p.name} · ${p.watt}W · ${rupiah(p.price)}</option>`).join('');
$('fPkg').value = 'P3';
const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
$('fDate').min = toISO(tmr);

/* ---------- kalender ---------- */
const cal = createCalendar($('calendar'), {
  onPick(iso, status, past) {
    if (past) return toast('Tanggal sudah lewat.');
    if (status !== 'free') return toast('Tanggal ini tidak tersedia, pilih tanggal lain.');
    $('fDate').value = iso;
    validateDate();
    updateSummary();
    cal.select(iso);
    document.getElementById('pesan').scrollIntoView();
    toast('Tanggal ' + fmtDate(iso) + ' dipilih.');
  },
});
cal.onRender = ({ year, month, bookings, blocked }) => {
  const days = new Date(year, month + 1, 0).getDate();
  const today = todayISO();
  let free = 0, taken = 0;
  const freeWeekends = [];
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    if (iso <= today) continue;
    const st = dateStatus(iso, bookings, blocked);
    if (st === 'free') {
      free++;
      const dow = new Date(year, month, d).getDay();
      if ((dow === 6 || dow === 0) && freeWeekends.length < 5) freeWeekends.push(iso);
    } else taken++;
  }
  $('monthSummary').textContent = `${BULAN[month]} ${year}: ${free} tanggal masih kosong, ${taken} sudah terisi atau tutup.`;
  $('freeWeekends').innerHTML = freeWeekends.length
    ? '<li style="border:0;color:#fff;font-weight:600">Akhir pekan yang masih kosong</li>' + freeWeekends.map(iso => `<li>${fmtDate(iso)}<span>Kosong</span></li>`).join('')
    : '<li>Akhir pekan bulan ini sudah penuh.</li>';
};
cal.render();

/* ---------- ringkasan biaya ---------- */
function formData() {
  return {
    name: $('fName').value.trim(),
    phone: $('fPhone').value.replace(/\D/g, ''),
    event: $('fEvent').value,
    date: $('fDate').value,
    address: $('fAddress').value.trim(),
    pkg: $('fPkg').value,
    addon: Math.max(0, parseInt($('fAddon').value, 10) || 0),
    overtime: Math.max(0, parseInt($('fOvertime').value, 10) || 0),
    payment: $('fPayment').value,
    notes: $('fNotes').value.trim(),
  };
}
function updateSummary() {
  const f = formData();
  const pr = calcPrice(f);
  const p = pkgById(f.pkg);
  $('sPkg').textContent = p ? `${p.name} (${rupiah(p.price)})` : '—';
  $('sDate').textContent = f.date ? fmtDate(f.date) : '—';
  $('sAddon').textContent = `${f.addon} × Rp600rb = ${rupiah(pr.addonTotal)}`;
  $('sOt').textContent = `${f.overtime} jam = ${rupiah(pr.otTotal)}`;
  $('sTotal').textContent = rupiah(pr.total);
  $('sDp').textContent = rupiah(pr.dp);
}
['fPkg', 'fAddon', 'fOvertime', 'fDate'].forEach(id => $(id).addEventListener('input', updateSummary));
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
  const inp = $(b.dataset.step);
  inp.value = Math.min(Number(inp.max), Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.dataset.d)));
  updateSummary();
}));

/* ---------- validasi ---------- */
function setInvalid(name, bad) {
  document.querySelector(`.field[data-f="${name}"]`).classList.toggle('invalid', bad);
  return !bad;
}
function validateDate() {
  const iso = $('fDate').value;
  if (!iso) { $('dateErr').textContent = 'Tanggal wajib diisi.'; return setInvalid('date', true); }
  if (iso <= todayISO()) { $('dateErr').textContent = 'Pilih tanggal mulai besok.'; return setInvalid('date', true); }
  const st = dateStatus(iso, loadBookings(), loadBlocked());
  if (st !== 'free') {
    $('dateErr').textContent = st === 'blocked' ? 'Tanggal ini ditutup oleh admin.' : 'Tanggal ini sudah dipesan orang lain.';
    return setInvalid('date', true);
  }
  $('dateHint').textContent = '✓ Tanggal tersedia';
  return setInvalid('date', false);
}
$('fDate').addEventListener('change', () => { validateDate(); if ($('fDate').value) cal.select($('fDate').value); });

$('orderForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = formData();
  let ok = true;
  ok = setInvalid('name', !f.name) && ok;
  ok = setInvalid('phone', !/^0\d{9,12}$/.test(f.phone)) && ok;
  ok = setInvalid('event', !f.event) && ok;
  ok = validateDate() && ok;
  ok = setInvalid('address', !f.address) && ok;
  if (!ok) return toast('Masih ada data yang belum benar.');
  if (!$('fAgree').checked) return toast('Centang persetujuan ketentuan sewa dulu ya.');

  const list = loadBookings();
  const pr = calcPrice(f);
  const booking = { id: newId(list), ...f, total: pr.total, dp: pr.dp, status: 'pending', createdAt: todayISO() };
  list.push(booking);
  saveBookings(list);
  showReceipt(booking);
  $('orderForm').reset();
  $('fPkg').value = 'P3';
  $('dateHint').textContent = 'Pilih tanggal, atau klik di kalender.';
  updateSummary();
  cal.select(null);
});

/* ---------- struk / bukti pemesanan ---------- */
function showReceipt(b) {
  const p = pkgById(b.pkg);
  const pr = calcPrice(b);
  const waText = encodeURIComponent(
    `Halo Gita Karsa Melodi, saya ${b.name} sudah memesan lewat website.\n` +
    `Kode: ${b.id}\nTanggal: ${fmtDate(b.date)}\nAcara: ${b.event}\nPaket: ${p.name}\n` +
    `Total: ${rupiah(b.total)}\nDP 50%: ${rupiah(b.dp)}\nBerikut bukti transfer DP saya.`);
  $('receipt').innerHTML = `
    <div class="receipt-head">
      <span class="ok">Pesanan terkirim</span>
      <h3>Bukti Pemesanan ${b.id}</h3>
      <div style="color:#aaa;font-size:13px;margin-top:4px">Status: Menunggu DP · ${fmtDate(b.createdAt)}</div>
    </div>
    <div class="receipt-body">
      <div class="sum-line"><span>Nama</span><span>${esc(b.name)}</span></div>
      <div class="sum-line"><span>No. HP</span><span>${esc(b.phone)}</span></div>
      <div class="sum-line"><span>Acara</span><span>${b.event}</span></div>
      <div class="sum-line"><span>Tanggal</span><span>${fmtDate(b.date)}</span></div>
      <div class="sum-line"><span>Lokasi</span><span style="text-align:right">${esc(b.address)}</span></div>
      <div class="sum-line"><span>${p.name} (${p.watt}W)</span><span>${rupiah(pr.base)}</span></div>
      <div class="sum-line"><span>MC / Musisi × ${b.addon}</span><span>${rupiah(pr.addonTotal)}</span></div>
      <div class="sum-line"><span>Overtime ${b.overtime} jam</span><span>${rupiah(pr.otTotal)}</span></div>
      <div class="sum-total"><span>Total</span><span>${rupiah(b.total)}</span></div>
      <div class="pay-box">
        Bayar DP 50% sebesar <b>${rupiah(b.dp)}</b> ${b.payment === 'Cash' ? 'secara cash ke admin' : 'ke rekening:<br><b>' + GKM.BANK + '</b>'}<br>
        <span style="color:#666">Lalu kirim bukti pembayaran ke WhatsApp admin. Tanggal baru dikunci setelah DP diterima. Pelunasan paling lambat H-1.</span>
      </div>
      <div class="modal-actions">
        <a class="btn" href="https://wa.me/6289531573288?text=${waText}" target="_blank">Kirim Bukti via WhatsApp</a>
        <button class="btn btn-ghost" onclick="window.print()">Cetak</button>
        <button class="btn btn-ghost" onclick="document.getElementById('receiptModal').classList.remove('show')">Tutup</button>
      </div>
    </div>`;
  $('receiptModal').classList.add('show');
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('receiptModal').addEventListener('click', e => { if (e.target.id === 'receiptModal') e.target.classList.remove('show'); });

updateSummary();
