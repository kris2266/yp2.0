(function () {
    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const ruMonths = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    const ALL_TIMES = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth();

    let busySlots = {};

    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('monthLabel');
    const modal = document.getElementById('bookingModal');
    const modalDateSpan = document.getElementById('modalDate');
    const closeBtn = document.querySelector('.modal-close');
    const bookingForm = document.querySelector('.booking-form');

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

        m = str.match(/^(\d{1,2})\s+([a-zа-яё]+)$/i);
        if (m) {
            const day = +m[1];
            const name = m[2].toLowerCase();
            const idx = monthNames.indexOf(name);
            const ruIdx = ruMonths.indexOf(name);
            const monthIdx = idx >= 0 ? idx : ruIdx;
            if (monthIdx >= 0) return { y: currentYear, m: monthIdx + 1, d: day };
        }
        return null;
    }

    function toISO(y, m, d) {
        return `${y}-${pad(m)}-${pad(d)}`;
    }

    function isPast(y, m, d) {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const target = new Date(y, m - 1, d);
        return target < todayStart;
    }

    function getDateInputISO() {
        const dateInput = document.getElementById('booking-date-input');
        if (!dateInput) return null;
        if (dateInput.type === 'date') return dateInput.value || null;
        const parsed = parseBookingDate(dateInput.value);
        return parsed ? toISO(parsed.y, parsed.m, parsed.d) : null;
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
            const res = await fetch('/api/busy', { credentials: 'same-origin' });
            if (!res.ok) {
                console.warn('busy slots error:', res.status);
                return;
            }
            const all = await res.json();

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
        } catch (e) {
            console.error('loadBusySlots failed:', e);
        }
    }

    function renderCalendar() {
        if (!grid) return;

        const headers = Array.from(grid.children).slice(0, 7);
        grid.innerHTML = '';
        headers.forEach(h => grid.appendChild(h));

        if (monthLabel) monthLabel.textContent = monthNames[currentMonth];

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const offset = (firstDay === 0) ? 6 : firstDay - 1;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        for (let i = 0; i < offset; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-cell';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            cell.dataset.day = day;

            const num = document.createElement('span');
            num.className = 'day-number';
            num.textContent = day;
            cell.appendChild(num);

            const iso = toISO(currentYear, currentMonth + 1, day);
            const busy = busySlots[iso] || [];
            const past = isPast(currentYear, currentMonth + 1, day);

            if (past) cell.classList.add('calendar-cell--past');

            busy.forEach((time, idx) => {
                const slot = document.createElement('div');
                slot.className = 'appointment-slot';
                slot.textContent = time;
                slot.style.top = (30 + idx * 22) + '%';
                cell.appendChild(slot);
            });

            const fullyBusy = past || busy.length >= ALL_TIMES.length;

            if (!fullyBusy) {
                cell.addEventListener('click', function (e) {
                    if (e.target.classList.contains('appointment-slot')) return;
                    if (!modal) return;

                    const dateText = day + ' ' + monthNames[currentMonth];
                    if (modalDateSpan) modalDateSpan.textContent = dateText;

                    const dateInput = document.getElementById('booking-date-input');
                    if (dateInput) {
                        dateInput.value = (dateInput.type === 'date') ? iso : dateText;
                    }

                    fillFreeTimes(iso);

                    modal.classList.add('active');
                });
            } else {
                cell.classList.add('calendar-cell--past');
            }

            grid.appendChild(cell);
        }

        const totalCells = offset + daysInMonth;
        const remainder = totalCells % 7;
        if (remainder !== 0) {
            for (let i = 0; i < 7 - remainder; i++) {
                const empty = document.createElement('div');
                empty.className = 'calendar-cell';
                grid.appendChild(empty);
            }
        }
    }

    function bindServiceButtons() {
        document.querySelectorAll('.service-book-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const card = btn.closest('.service-card');
                const serviceName = card ? card.dataset.service : null;
                const serviceSelect = document.getElementById('service-select');

                if (serviceName && serviceSelect) {
                    let found = false;
                    Array.from(serviceSelect.options).forEach(function (opt) {
                        if (opt.value === serviceName || opt.textContent.trim() === serviceName) {
                            serviceSelect.value = opt.value;
                            found = true;
                        }
                    });
                    if (!found) {
                        const opt = document.createElement('option');
                        opt.value = serviceName;
                        opt.textContent = serviceName;
                        serviceSelect.appendChild(opt);
                        serviceSelect.value = serviceName;
                    }
                }

                const dateInput = document.getElementById('booking-date-input');
                if (dateInput && !dateInput.value) {
                    const today = new Date();
                    const iso = toISO(today.getFullYear(), today.getMonth() + 1, today.getDate());
                    dateInput.value = (dateInput.type === 'date')
                        ? iso
                        : today.getDate() + ' ' + monthNames[today.getMonth()];
                    if (modalDateSpan) modalDateSpan.textContent = dateInput.value;
                }

                const currentISO = getDateInputISO();
                if (currentISO) fillFreeTimes(currentISO);

                if (modal) modal.classList.add('active');
            });
        });
    }

    function bindModalClose() {
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }
    }

    async function handleBookingSubmit(e) {
        e.preventDefault();

        const meRes = await fetch('/api/me', { credentials: 'same-origin' });
        if (!meRes.ok) { window.location.href = '/login.html'; return; }

        const serviceName = (document.getElementById('service-select') || {}).value || '';
        const meta = getServiceMeta(serviceName);

        const payload = {
            service: serviceName,
            master: (document.getElementById('master-select') || {}).value || '',
            address: (document.getElementById('booking-address') || {}).value || '',
            booking_date: (document.getElementById('booking-date-input') || {}).value || '',
            booking_time: (document.getElementById('booking-time') || {}).value || '',
            client_name: (document.getElementById('client-name') || {}).value || '',
            client_phone: (document.getElementById('client-phone') || {}).value || '',
            price: meta.price || 0,
            image: meta.image || null
        };

        const required = ['service', 'master', 'address', 'booking_date', 'booking_time', 'client_name', 'client_phone'];
        if (required.some(k => !payload[k])) {
            alert('Заполните все поля');
            return;
        }

        const parsed = parseBookingDate(payload.booking_date);
        if (parsed && isPast(parsed.y, parsed.m, parsed.d)) {
            alert('Нельзя записаться на прошедшую дату');
            return;
        }

        if (parsed) {
            const iso = toISO(parsed.y, parsed.m, parsed.d);
            const busy = busySlots[iso] || [];
            if (busy.includes(payload.booking_time)) {
                alert('Это время уже занято, выберите другое');
                fillFreeTimes(iso);
                return;
            }
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
        if (modal) modal.classList.remove('active');
        if (bookingForm) bookingForm.reset();

        await loadBusySlots();
        renderCalendar();
    }

    function bindBookingForm() {
        if (!bookingForm) return;
        if (bookingForm.dataset.submitBound === '1') return;
        bookingForm.dataset.submitBound = '1';
        bookingForm.addEventListener('submit', handleBookingSubmit);
    }

    async function init() {
        const dateInput = document.getElementById('booking-date-input');
        if (dateInput && dateInput.type === 'date') {
            const d = new Date();
            dateInput.min = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }

        if (grid) {
            await loadBusySlots();
            renderCalendar();
        }

        if (modal) {
            bindServiceButtons();
            bindModalClose();
            bindBookingForm();
        }
    }

    init();
})();