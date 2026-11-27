(function () {
    const modal = document.getElementById('bookingModal');
    const closeBtn = document.querySelector('.modal-close');
    const bookingForm = document.querySelector('.booking-form');
    const masterSelect = document.getElementById('master-select');
    const bookButtons = document.querySelectorAll('.master-book-btn');

    if (!modal) return;

    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const ruMonths = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    const ALL_TIMES = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

    let busySlots = {};

    function getServiceMeta(serviceName) {
        const all = window.SERVICES || {};
        return all[serviceName] || {};
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function parseBookingDate(str) {
        if (!str) return null;
        str = String(str).trim();

        let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return { y: +m[1], m: +m[2], d: +m[3] };

        m = str.match(/^(\d{1,2})\s+([a-zа-я]+)$/i);
        if (m) {
            const day = +m[1];
            const name = m[2].toLowerCase();
            const idx = monthNames.indexOf(name);
            const ruIdx = ruMonths.indexOf(name);
            const monthIdx = idx >= 0 ? idx : ruIdx;
            if (monthIdx >= 0) {
                const now = new Date();
                return { y: now.getFullYear(), m: monthIdx + 1, d: day };
            }
        }
        return null;
    }

    function toISO(y, m, d) {
        return `${y}-${pad(m)}-${pad(d)}`;
    }

    function todayISO() {
        const d = new Date();
        return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

    function fillFreeTimes(isoDate) {
        const timeSelect = document.getElementById('booking-time');
        if (!timeSelect) return;

        const busy = busySlots[isoDate] || [];
        const prevValue = timeSelect.value;
        timeSelect.innerHTML = '<option value="" disabled selected>выберите время</option>';

        ALL_TIMES.forEach(t => {
            if (busy.includes(t)) return;
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            timeSelect.appendChild(opt);
        });

        if (prevValue && !busy.includes(prevValue)) {
            timeSelect.value = prevValue;
        }

        if (timeSelect.options.length <= 1) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.disabled = true;
            opt.textContent = 'нет свободного времени';
            timeSelect.appendChild(opt);
        }
    }

    async function loadBusySlots() {
        try {
            const res = await fetch('/api/bookings', { credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();

            const all = []
                .concat(Array.isArray(data) ? data : [])
                .concat(data.active || [])
                .concat(data.done || [])
                .concat(data.allBusy || []);

            busySlots = {};
            all.forEach(b => {
                const parsed = parseBookingDate(b.booking_date);
                if (!parsed) return;
                const key = toISO(parsed.y, parsed.m, parsed.d);
                if (!busySlots[key]) busySlots[key] = [];
                const time = b.booking_time || b.time;
                if (time && !busySlots[key].includes(time)) {
                    busySlots[key].push(time);
                }
            });
        } catch (e) {}
    }

    bookButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            const card = btn.closest('.master-card');
            const masterName = card ? card.dataset.master : null;

            if (masterName && masterSelect) {
                let found = false;
                Array.from(masterSelect.options).forEach(function (opt) {
                    if (opt.value === masterName || opt.textContent.trim() === masterName) {
                        masterSelect.value = opt.value;
                        found = true;
                    }
                });
                if (!found) {
                    const opt = document.createElement('option');
                    opt.value = masterName;
                    opt.textContent = masterName;
                    masterSelect.appendChild(opt);
                    masterSelect.value = masterName;
                }
            }

            const dateInput = document.getElementById('booking-date-input');
            if (dateInput && dateInput.value) {
                fillFreeTimes(dateInput.value);
            }

            modal.classList.add('active');
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            modal.classList.remove('active');
        });
    }

    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('active');
    });

    async function handleBookingSubmit(e) {
        e.preventDefault();

        const meRes = await fetch('/api/me', { credentials: 'same-origin' });
        if (!meRes.ok) {
            window.location.href = '/login.html';
            return;
        }

        const serviceName = (document.getElementById('service-select') || {}).value || '';
        const meta = getServiceMeta(serviceName);

        const payload = {
            service: serviceName,
            master: (masterSelect || {}).value || '',
            address: (document.getElementById('booking-address') || {}).value || '',
            booking_date: (document.getElementById('booking-date-input') || {}).value || '',
            booking_time: (document.getElementById('booking-time') || {}).value || '',
            client_name: (document.getElementById('client-name') || {}).value || '',
            client_phone: (document.getElementById('client-phone') || {}).value || '',
            price: meta.price || 0,
            image: meta.image || null
        };

        const required = ['service', 'master', 'address', 'booking_date', 'booking_time', 'client_name', 'client_phone'];
        const missing = required.filter(k => !payload[k]);
        if (missing.length) {
            alert('Заполните все поля');
            return;
        }

        if (payload.booking_date < todayISO()) {
            alert('Нельзя записаться на прошедшую дату');
            return;
        }

        const parsed = parseBookingDate(payload.booking_date);
        const iso = parsed ? toISO(parsed.y, parsed.m, parsed.d) : payload.booking_date;

        const busy = busySlots[iso] || [];
        if (busy.includes(payload.booking_time)) {
            alert('Это время уже занято, выберите другое');
            fillFreeTimes(iso);
            return;
        }

        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(data.error || 'Не удалось создать запись');
            return;
        }

        alert('спасибо за запись! заявка отправлена');
        modal.classList.remove('active');
        if (bookingForm) bookingForm.reset();

        await loadBusySlots();
    }

    if (bookingForm && bookingForm.dataset.submitBound !== '1') {
        bookingForm.dataset.submitBound = '1';
        bookingForm.addEventListener('submit', handleBookingSubmit);
    }

    const dateInput = document.getElementById('booking-date-input');
    if (dateInput && dateInput.type === 'date') {
        dateInput.min = todayISO();
    }

    loadBusySlots();
})();