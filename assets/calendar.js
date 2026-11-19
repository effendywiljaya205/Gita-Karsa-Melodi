/* Kalender ketersediaan — dipakai di halaman publik & admin */
function createCalendar(el, { onPick, light = false, allowPast = false, showNames = false } = {}) {
  const now = new Date();
  let year = now.getFullYear(), month = now.getMonth();
  let selected = null;
  if (light) el.classList.add('cal-light');

  function render() {
    const bookings = loadBookings();
    const blocked = loadBlocked();
    const today = todayISO();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    let html = `<div class="cal-head"><h3>${BULAN[month]} ${year}</h3>
      <div class="cal-nav"><button type="button" data-nav="-1" aria-label="Bulan sebelumnya">‹</button><button type="button" data-nav="1" aria-label="Bulan berikutnya">›</button></div></div>
      <div class="cal-grid">${['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => `<div class="cal-dow">${d}</div>`).join('')}`;
    for (let i = 0; i < first; i++) html += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
      const st = dateStatus(iso, bookings, blocked);
      const past = iso <= today && !allowPast;
      const label = { free: 'Kosong', booked: 'Terisi', pending: 'Proses', blocked: 'Tutup' }[st];
      let sub = label;
      if (showNames && (st === 'booked' || st === 'pending')) {
        const b = bookings.find(x => x.date === iso && x.status !== 'cancelled');
        sub = b ? b.pkg + ' · ' + b.event : label;
      }
      const cls = ['cal-day', st, past ? 'past' : '', iso === today ? 'today' : '', iso === selected ? 'selected' : ''].join(' ');
      html += `<div class="${cls}" data-date="${iso}" data-status="${st}" title="${fmtDate(iso)} — ${label}">${d}<small>${sub}</small></div>`;
    }
    html += `</div><div class="legend">
      <span><i class="lg-free"></i>Kosong</span><span><i class="lg-booked"></i>Terisi</span>
      <span><i class="lg-pending"></i>Menunggu DP</span><span><i class="lg-blocked"></i>Tutup</span></div>`;
    el.innerHTML = html;
    if (api.onRender) api.onRender({ year, month, bookings, blocked });
  }

  el.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      month += Number(nav.dataset.nav);
      if (month < 0) { month = 11; year--; }
      if (month > 11) { month = 0; year++; }
      render();
      return;
    }
    const day = e.target.closest('.cal-day[data-date]');
    if (day && onPick) onPick(day.dataset.date, day.dataset.status, day.classList.contains('past'));
  });

  const api = {
    render,
    select(iso) {
      selected = iso;
      if (iso) { const [y, m] = iso.split('-').map(Number); year = y; month = m - 1; }
      render();
    },
    onRender: null,
  };
  render();
  return api;
}
