// views.js - Triển khai giao diện cho 7 màn hình của Quinn House

(function () {
    // Helper chuyển đổi chuỗi HTML thành DOM Element
    function parseHTML(htmlString) {
        const div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    }

    // Định dạng tiền tệ VND
    function formatVND(amount) {
        return amount.toLocaleString('vi-VN') + ' đ';
    }

    // Helper tự động tạo trường nhập liệu chỉnh sửa inline trên thẻ thông tin phòng
    function getVietnamToday() {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(new Date()).reduce((acc, part) => {
            if (part.type !== 'literal') acc[part.type] = Number(part.value);
            return acc;
        }, {});

        return new Date(parts.year, parts.month - 1, parts.day);
    }

    function formatDateVN(date) {
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }

    function extractPaymentDueDay(paymentDay) {
        const numbers = String(paymentDay || '').match(/\d+/g);
        if (!numbers || numbers.length === 0) return null;
        return Math.max(1, Math.min(31, Number(numbers[numbers.length - 1])));
    }

    function getPaymentDueInfo(paymentDay) {
        const dueDay = extractPaymentDueDay(paymentDay);
        if (!dueDay) {
            return {
                dueDay: null,
                dueDate: null,
                label: paymentDay || 'Chưa đặt',
                daysLeft: null
            };
        }

        const today = getVietnamToday();
        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
        if (dueDate.getMonth() !== today.getMonth()) {
            dueDate.setDate(0);
        }

        const nextDueDate = new Date(dueDate);
        if (nextDueDate < today) {
            nextDueDate.setMonth(nextDueDate.getMonth() + 1, 1);
            nextDueDate.setDate(Math.min(dueDay, new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate()));
        }

        const daysLeft = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24));
        return {
            dueDay,
            dueDate: nextDueDate,
            label: formatDateVN(nextDueDate),
            daysLeft
        };
    }

    function getTenantPaymentStatus(room, invoices) {
        const dueDay = extractPaymentDueDay(room.paymentDay);
        if (!dueDay) {
            return {
                label: 'Chưa đặt hạn',
                tone: 'bg-surface-container-high text-on-surface-variant border border-outline-variant',
                icon: 'event_busy'
            };
        }

        const today = getVietnamToday();
        const currentPeriod = window.QuinnState.getCurrentPeriod();
        const invoice = invoices.find(inv => inv.roomId === room.id && inv.period === currentPeriod);
        const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
        if (dueThisMonth.getMonth() !== today.getMonth()) dueThisMonth.setDate(0);
        const daysToDue = Math.ceil((dueThisMonth - today) / (1000 * 60 * 60 * 24));

        if (invoice && invoice.status === 'Paid') {
            return {
                label: 'Đã thanh toán kỳ này',
                tone: 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]',
                icon: 'check_circle'
            };
        }

        if (daysToDue < 0) {
            return {
                label: `Quá hạn ${Math.abs(daysToDue)} ngày`,
                tone: 'bg-error-container text-on-error-container border border-error/20',
                icon: 'warning'
            };
        }

        if (daysToDue <= 3) {
            return {
                label: daysToDue === 0 ? 'Đến hạn hôm nay' : `Còn ${daysToDue} ngày`,
                tone: 'bg-[#FFF3E0] text-[#E65100] border border-[#FFCC80]',
                icon: 'schedule'
            };
        }

        return {
            label: `Còn ${daysToDue} ngày`,
            tone: 'bg-primary-fixed text-primary border border-primary/15',
            icon: 'event_available'
        };
    }

    function makeCardInlineEditable(card, targetSelector, currentValue, onSave) {
        if (card.getAttribute('data-editing') === 'true') return;
        
        const valueEl = card.querySelector(targetSelector);
        if (!valueEl) return;

        card.setAttribute('data-editing', 'true');
        const originalHTML = valueEl.outerHTML;
        
        // Tạo input element
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        
        // Cấu hình class CSS tùy vào vị trí hiển thị để đồng bộ thẩm mỹ
        if (valueEl.classList.contains('text-primary')) {
            input.className = 'w-full bg-surface-container border border-primary rounded px-2 py-1 text-primary font-title-lg text-title-lg focus:outline-none focus:ring-1 focus:ring-primary';
        } else if (valueEl.classList.contains('fixed-utilities-value')) {
            input.className = 'w-full bg-surface-container border border-primary rounded px-2 py-1 text-primary font-bold text-xl focus:outline-none focus:ring-1 focus:ring-primary mt-1';
        } else {
            input.className = 'w-full bg-surface-container border border-outline rounded px-2 py-1 text-on-surface font-title-lg text-title-lg focus:outline-none focus:ring-1 focus:ring-primary';
        }

        // Thay thế hiển thị tĩnh bằng input nhập liệu trực tiếp
        valueEl.replaceWith(input);
        input.focus();
        input.select();

        let finished = false;

        function finishEdit(save) {
            if (finished) return;
            finished = true;

            card.removeAttribute('data-editing');

            if (save) {
                const valNum = Number(input.value);
                if (isNaN(valNum) || valNum < 0) {
                    alert('Giá trị nhập vào không hợp lệ!');
                    input.replaceWith(parseHTML(originalHTML));
                } else {
                    onSave(valNum);
                }
            } else {
                input.replaceWith(parseHTML(originalHTML));
            }
        }

        // Sự kiện bàn phím (Enter / Esc)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                finishEdit(true);
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                finishEdit(false);
            }
        });

        // Tự động lưu khi người dùng trỏ chuột ra ngoài (blur)
        input.addEventListener('blur', () => {
            setTimeout(() => {
                finishEdit(true);
            }, 150);
        });

        // Ngăn chặn sự kiện click lan ra ngoài thẻ card
        input.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Helper tạo Modal chung
    function createModal(title, contentHTML, onSave) {
        const modalId = 'quinn-modal-' + Math.floor(Math.random() * 1000);
        const modalHTML = `
            <div id="${modalId}" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
                <div class="bg-surface rounded-xl border border-outline-variant max-w-lg w-full overflow-hidden shadow-xl transform scale-95 transition-transform duration-300">
                    <div class="px-container-margin py-md bg-primary text-on-primary flex justify-between items-center">
                        <h3 class="font-title-lg text-title-lg font-bold">${title}</h3>
                        <button class="close-btn text-on-primary/70 hover:text-on-primary">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="p-container-margin max-h-[70vh] overflow-y-auto">
                        ${contentHTML}
                    </div>
                    <div class="px-container-margin py-md border-t border-outline-variant bg-surface-container-low flex justify-end gap-3">
                        <button class="cancel-btn px-4 py-2 border border-outline text-on-surface-variant hover:bg-surface-container-high rounded-lg font-label-md">
                            Hủy bỏ
                        </button>
                        <button class="save-btn px-5 py-2 bg-primary text-on-primary hover:opacity-90 rounded-lg font-label-md shadow-sm">
                            Đồng ý
                        </button>
                    </div>
                </div>
            </div>
        `;
        const modalElement = parseHTML(modalHTML);
        document.body.appendChild(modalElement);

        // Hiệu ứng Fade in
        setTimeout(() => {
            modalElement.classList.add('opacity-100');
            modalElement.firstElementChild.classList.remove('scale-95');
        }, 10);

        const closeModal = () => {
            modalElement.firstElementChild.classList.add('scale-95');
            modalElement.classList.remove('opacity-100');
            setTimeout(() => modalElement.remove(), 200);
        };

        modalElement.querySelector('.close-btn').addEventListener('click', closeModal);
        modalElement.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
        modalElement.querySelector('.save-btn').addEventListener('click', () => {
            if (onSave(modalElement)) {
                closeModal();
            }
        });
    }

    // Định nghĩa QuinnViews
    window.QuinnViews = {
        
        // 1. Màn hình Dashboard (Tổng quan)
        renderDashboard: function () {
            const rooms = window.QuinnState.getRooms();
            const invoices = window.QuinnState.getInvoices();
            const contracts = window.QuinnState.getContracts();

            const totalRooms = rooms.length;
            const rentedRooms = rooms.filter(r => r.status === 'rented').length;
            const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
            const repairRooms = rooms.filter(r => r.status === 'repair').length;

            const currentPeriod = window.QuinnState.getCurrentPeriod();
            // Tính doanh thu tháng hiện tại
            const currentPeriodInvoices = invoices.filter(i => i.period === currentPeriod);
            const expectedRevenue = currentPeriodInvoices.reduce((sum, inv) => sum + inv.total, 0);
            const actualRevenue = currentPeriodInvoices.filter(i => i.status === 'Paid').reduce((sum, inv) => sum + inv.total, 0);
            
            // Còn nợ (tất cả các hóa đơn Chưa thanh toán & Quá hạn)
            const debtRevenue = invoices.filter(i => i.status !== 'Paid').reduce((sum, inv) => sum + inv.total, 0);
            const debtRoomsCount = [...new Set(invoices.filter(i => i.status !== 'Paid').map(i => i.roomId))].length;

            // Lấy danh sách hợp đồng sắp hết hạn
            const expiringContracts = contracts.filter(c => c.status === 'Expiring');

            // Danh sách bảo trì mới
            const newMaintenanceRooms = rooms.filter(r => r.maintenanceLogs.some(l => l.status === 'Mới'));

            // Tính nhãn và doanh thu cho 6 tháng gần nhất động
            const last6Months = window.QuinnState.getRecentPeriods(6).map(period => {
                const periodKey = period.periodKey;
                
                // Doanh thu thực tế cho từng tháng trong quá khứ
                const monthInvoices = invoices.filter(inv => inv.period === periodKey);
                const monthRevenue = monthInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.total, 0);
                const monthExpected = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
                
                return {
                    label: period.label,
                    periodKey: periodKey,
                    year: period.year,
                    revenue: monthRevenue,
                    expected: monthExpected,
                    isCurrent: period.isCurrent
                };
            });
            const currentYear = last6Months[last6Months.length - 1].year;

            const maxRevenueInChart = Math.max(...last6Months.map(m => m.revenue), 10000000); // Tối thiểu là 10tr để chia tỉ lệ
            const barsHTML = last6Months.map((m, index) => {
                const heightPct = m.revenue > 0 ? Math.max(5, Math.round((m.revenue / maxRevenueInChart) * 85)) : 2;
                const barColorClass = m.isCurrent 
                    ? 'bg-primary shadow-sm' 
                    : 'bg-surface-variant group-hover:bg-primary/20 transition-colors';
                const labelColorClass = m.isCurrent
                    ? 'font-bold text-primary'
                    : 'text-on-surface-variant';
                const paddingClass = index === 0 ? 'pl-8' : '';
                
                return `
                    <div class="flex-1 flex flex-col items-center gap-2 z-10 group relative ${paddingClass}">
                        <div class="absolute bottom-[calc(100%+8px)] bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-30">
                            Thực thu: ${formatVND(m.revenue)}<br/>Dự kiến: ${formatVND(m.expected)}
                        </div>
                        <div class="w-full max-w-[40px] ${barColorClass} rounded-t-sm" style="height: ${heightPct}%;"></div>
                        <span class="font-label-md text-[11px] ${labelColorClass}">${m.label}</span>
                    </div>
                `;
            }).join('');

            const html = `
                <div>
                    <!-- Header -->
                    <div class="flex justify-between items-end mb-lg">
                        <div>
                            <h2 class="font-headline-lg text-headline-lg text-primary mb-1">Tổng quan</h2>
                            <p class="font-body-md text-body-md text-on-surface-variant">Tóm tắt tình hình kinh doanh ${currentPeriod}.</p>
                        </div>
                        <button id="add-room-quick-btn" class="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                            <span class="material-symbols-outlined text-[18px]">add</span>
                            Thêm phòng mới
                        </button>
                    </div>

                    <!-- Stats Cards Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
                        <!-- Card 1 -->
                        <div class="bg-surface rounded-xl p-md border border-outline-variant/50 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(3,22,54,0.06)] hover:border-primary/20 transition-all cursor-pointer" onclick="window.navigateTo('rooms')">
                            <div class="flex justify-between items-start mb-4">
                                <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                                    <span class="material-symbols-outlined">meeting_room</span>
                                </div>
                                <span class="bg-secondary-fixed/50 text-on-secondary-fixed px-2 py-1 rounded font-label-md text-label-md">Tổng ${totalRooms}</span>
                            </div>
                            <p class="font-label-md text-label-md text-on-surface-variant mb-1">Trạng thái phòng</p>
                            <div class="flex items-baseline gap-2">
                                <h3 class="font-headline-md text-headline-md text-primary">${rentedRooms}</h3>
                                <span class="font-body-md text-body-md text-on-surface-variant">đang thuê</span>
                            </div>
                            <div class="mt-3 flex gap-2">
                                <div class="flex-1 h-1.5 bg-[#E8F5E9] rounded-full overflow-hidden">
                                    <div class="h-full bg-[#4CAF50] rounded-full" style="width: ${(rentedRooms/totalRooms)*100}%"></div>
                                </div>
                                <span class="font-label-md text-[10px] text-on-surface-variant">${vacantRooms} trống</span>
                            </div>
                        </div>

                        <!-- Card 2 -->
                        <div class="bg-surface rounded-xl p-md border border-outline-variant/50 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(3,22,54,0.06)] hover:border-primary/20 transition-all lg:col-span-2 relative overflow-hidden group cursor-pointer" onclick="window.navigateTo('payments')">
                            <div class="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                            <div class="flex justify-between items-start mb-2">
                                <div class="w-10 h-10 rounded-lg bg-[#E3F2FD] flex items-center justify-center text-[#1976D2]">
                                    <span class="material-symbols-outlined">payments</span>
                                </div>
                                <span class="bg-[#E8F5E9] text-[#2E7D32] px-2 py-1 rounded font-label-md text-label-md flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[14px]">trending_up</span> +5.2%
                                </span>
                            </div>
                            <p class="font-label-md text-label-md text-on-surface-variant mb-1">Thực thu ${currentPeriod.toLowerCase()}</p>
                            <h3 class="text-2xl font-bold text-primary tracking-tight">
                                ${formatVND(actualRevenue)}
                            </h3>
                            <p class="text-[11px] text-on-surface-variant mt-2">Dự kiến thu: ${formatVND(expectedRevenue)}</p>
                        </div>

                        <!-- Card 3 -->
                        <div class="bg-surface rounded-xl p-md border border-outline-variant/50 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(3,22,54,0.06)] hover:border-primary/20 transition-all cursor-pointer" onclick="window.navigateTo('payments')">
                            <div class="flex justify-between items-start mb-2">
                                <div class="w-10 h-10 rounded-lg bg-error-container/50 flex items-center justify-center text-on-error-container">
                                    <span class="material-symbols-outlined">warning</span>
                                </div>
                            </div>
                            <p class="font-label-md text-label-md text-on-surface-variant mb-1">Còn nợ (${debtRoomsCount} phòng)</p>
                            <h3 class="text-2xl font-bold text-error">
                                ${formatVND(debtRevenue)}
                            </h3>
                            <span class="mt-3 text-label-md font-label-md text-primary hover:underline flex items-center gap-1">
                                Xem chi tiết <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                            </span>
                        </div>
                    </div>

                    <!-- Main Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                        <!-- Revenue Bar Chart -->
                        <div class="lg:col-span-2 bg-surface rounded-xl p-lg border border-outline-variant/50 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="font-title-lg text-title-lg text-on-surface">Doanh thu 6 tháng gần nhất</h3>
                                <select class="bg-surface-container-low border border-outline-variant rounded px-3 py-1 font-body-md text-body-md focus:outline-none focus:border-primary">
                                    <option>Năm ${currentYear}</option>
                                </select>
                            </div>
                            <!-- Bar Chart Visual -->
                            <div class="h-[280px] w-full flex items-end gap-2 sm:gap-4 px-2 relative border-b border-outline-variant/30 pb-4 pt-10">
                                <!-- Y-axis labels -->
                                <div class="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-on-surface-variant font-label-md pb-4 pointer-events-none">
                                    <span>40 Tr</span>
                                    <span>30 Tr</span>
                                    <span>20 Tr</span>
                                    <span>10 Tr</span>
                                    <span>0</span>
                                </div>
                                <!-- Grid lines -->
                                <div class="absolute left-8 right-0 top-10 h-[calc(100%-3.5rem)] flex flex-col justify-between pointer-events-none">
                                    <div class="w-full h-px bg-outline-variant/20"></div>
                                    <div class="w-full h-px bg-outline-variant/20"></div>
                                    <div class="w-full h-px bg-outline-variant/20"></div>
                                    <div class="w-full h-px bg-outline-variant/20"></div>
                                </div>
                                <!-- Bars -->
                                ${barsHTML}
                            </div>
                        </div>

                        <!-- Right Panel: Attention Needed -->
                        <div class="bg-surface rounded-xl p-lg border border-outline-variant/50 shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex flex-col">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="font-title-lg text-title-lg text-on-surface">Cần chú ý</h3>
                            </div>
                            <div class="flex flex-col gap-4 flex-1">
                                <!-- Hợp đồng sắp hết hạn -->
                                ${expiringContracts.length > 0 ? `
                                    <div class="p-3 border border-[#FFF3E0] bg-[#FFF8E1]/50 rounded-lg flex gap-3 items-start group hover:border-[#FFB74D] transition-colors cursor-pointer" onclick="window.navigateTo('contracts')">
                                        <div class="w-8 h-8 rounded-full bg-[#FFF3E0] text-[#E65100] flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span class="material-symbols-outlined text-[18px]">event_busy</span>
                                        </div>
                                        <div>
                                            <h4 class="font-label-md text-label-md font-semibold text-on-surface">${expiringContracts.length} Hợp đồng sắp hết hạn</h4>
                                            <p class="font-body-md text-[13px] text-on-surface-variant mt-1 leading-snug">
                                                Phòng ${expiringContracts.map(c => `<strong>${c.roomId}</strong>`).join(', ')} sắp hết hiệu lực trong vòng 30 ngày tới.
                                            </p>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="p-3 border border-outline-variant/30 rounded-lg flex gap-3 items-center text-on-surface-variant text-sm">
                                        <span class="material-symbols-outlined text-[20px] text-[#4CAF50]">check_circle</span>
                                        Không có hợp đồng nào sắp hết hạn.
                                    </div>
                                `}

                                <!-- Bảo trì mới -->
                                ${newMaintenanceRooms.length > 0 ? `
                                    <div class="p-3 border border-outline-variant/30 rounded-lg flex gap-3 items-start group hover:border-primary/30 hover:bg-surface-container-low transition-colors cursor-pointer" onclick="window.navigateTo('rooms')">
                                        <div class="w-8 h-8 rounded-full bg-surface-container text-surface-tint flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span class="material-symbols-outlined text-[18px]">plumbing</span>
                                        </div>
                                        <div>
                                            <h4 class="font-label-md text-label-md font-semibold text-on-surface">${newMaintenanceRooms.length} Yêu cầu bảo trì mới</h4>
                                            <p class="font-body-md text-[13px] text-on-surface-variant mt-1 leading-snug">
                                                Phòng ${newMaintenanceRooms.map(r => `<strong>${r.id}</strong>`).join(', ')} có sự cố cần xử lý.
                                            </p>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="p-3 border border-outline-variant/30 rounded-lg flex gap-3 items-center text-on-surface-variant text-sm">
                                        <span class="material-symbols-outlined text-[20px] text-[#4CAF50]">check_circle</span>
                                        Không có sự cố bảo trì tồn đọng.
                                    </div>
                                `}
                            </div>
                            <button class="w-full mt-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors" onclick="window.navigateTo('rooms')">
                                Xem danh sách phòng
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Bắt sự kiện Thêm phòng nhanh
            dom.querySelector('#add-room-quick-btn').addEventListener('click', () => {
                window.QuinnViews.showAddRoomModal();
            });

            return dom;
        },

        // 2. Màn hình Danh sách phòng (Rooms List)
        renderRooms: function () {
            const rooms = window.QuinnState.getRooms();
            const invoices = window.QuinnState.getInvoices();
            
            // Trạng thái lọc hiện tại
            let currentStatusFilter = '';
            let currentPriceFilter = '';
            let searchQuery = '';

            const renderGrid = (filteredRooms) => {
                const gridContainer = dom.querySelector('#rooms-grid-container');
                gridContainer.innerHTML = '';

                if (filteredRooms.length === 0) {
                    gridContainer.innerHTML = `
                        <div class="col-span-full py-16 text-center text-on-surface-variant">
                            <span class="material-symbols-outlined text-4xl mb-2">search_off</span>
                            <p>Không tìm thấy phòng nào phù hợp.</p>
                        </div>
                    `;
                    return;
                }

                filteredRooms.forEach(room => {
                    let statusClass = '';
                    let statusLabel = '';
                    let statusDot = '';
                    let actionButtonHTML = '';

                    let paymentBadgeHTML = '';
                    if (room.status === 'rented') {
                        const period = window.QuinnState.getCurrentPeriod();
                        const roomInvoices = invoices.filter(i => i.roomId === room.id && i.period === period);
                        const isPaid = roomInvoices.length > 0 && roomInvoices.every(i => i.status === 'Paid');
                        
                        if (isPaid) {
                            paymentBadgeHTML = `
                                <div class="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] w-fit">
                                    <span class="w-2 h-2 rounded-full bg-[#4CAF50]"></span> Đã đóng tiền
                                </div>
                            `;
                        } else {
                            paymentBadgeHTML = `
                                <div class="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2] w-fit">
                                    <span class="w-2 h-2 rounded-full bg-[#F44336]"></span> Chưa đóng tiền
                                </div>
                            `;
                        }
                    }

                    if (room.status === 'rented') {
                        statusClass = 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]';
                        statusLabel = 'Đang thuê';
                        statusDot = 'bg-[#4CAF50]';
                        actionButtonHTML = `
                            <button class="flex-1 bg-surface border border-outline-variant text-on-surface px-3 py-2 rounded-lg text-label-md hover:bg-surface-container-low transition-colors text-center detail-btn" data-id="${room.id}">Chi tiết</button>
                            <button class="bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low px-3 py-2 rounded-lg transition-colors edit-btn" data-id="${room.id}" title="Cập nhật">
                                <span class="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                        `;
                    } else if (room.status === 'vacant') {
                        statusClass = 'bg-[#EEEEEE] text-[#616161] border border-[#E0E0E0]';
                        statusLabel = 'Còn trống';
                        statusDot = 'bg-[#9E9E9E]';
                        actionButtonHTML = `
                            <button class="flex-1 bg-primary text-on-primary px-3 py-2 rounded-lg text-label-md hover:bg-primary/90 transition-colors text-center add-tenant-btn" data-id="${room.id}">Thêm khách mới</button>
                        `;
                    } else if (room.status === 'repair') {
                        statusClass = 'bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]';
                        statusLabel = 'Bảo trì';
                        statusDot = 'bg-[#F44336]';
                        actionButtonHTML = `
                            <button class="flex-1 bg-surface border border-outline-variant text-on-surface px-3 py-2 rounded-lg text-label-md hover:bg-surface-container-low transition-colors text-center detail-btn" data-id="${room.id}">Chi tiết</button>
                            <button class="bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low px-3 py-2 rounded-lg transition-colors done-repair-btn" data-id="${room.id}" title="Hoàn thành sửa chữa">
                                <span class="material-symbols-outlined text-[20px]">check</span>
                            </button>
                        `;
                    }

                    // Một vài ảnh ngẫu nhiên đẹp cho phòng trọ
                    const defaultRoomImages = [
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuBY6SIqpknWVTB4ZN8JRm9CbWOBS_LLIcR9ACdSBaI3YNitvCiFh15s6onrJNsfd0MeiGs2oAQaWMXzh3MQTn2OoJDnr3IBoWIWfWwyvQIoi_I9dM9kqsV4k8zzsQHZjGmnp4Im5VOip9AOrCy_ISKRwAQJjJQpl1LSzPtGZ2yR15h0k43F04D2RBzQIA1-VA1aPwVlvNTSK3bZEA8kWpS8y517dja9sd333cyeIopl8NDN2N6RWCUMzgeJL2aH8fRNBesMx5rkUyc',
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuCxT5TaEk1Qg9mlHtgqsjNxlNNmj1Rvevx0RqCxo9OA6S-ToJAlTvEtR6d36MIcXzSq9L6H94eIkgb7Pkhbf79cEtXq_myl4hrsV6mkvbirwRrnWMRJEnzDqfCN0UqQ29_xaS7sa_cbut4RFvQnTCK-oC-jdqvNUuG4mDUyQ6hBuxmRw3o9fJ5uT0NsPliw43u151BWpYvs2Sknana0CEYXAz2LGVgnrS41ft-Sjt-QZ-wiwLCG1bcjfOQhng7cl9rmZR3fQNOhkHI'
                    ];
                    const imageIndex = isNaN(Number(room.id)) ? 0 : Number(room.id) % defaultRoomImages.length;
                    const imageSrc = room.status === 'vacant' ? '' : (room.id === 'QH03' ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuBV455pFGBPPH7n5cb1-rCVhNFmg_hW8SoInlOnOQjZKugvR-kxvVCRf5MrEmcc_NGG--RhudJdG6EAgHi3OBydrFispw8yn6m6W4j10iY9Dw4i2n7LXDrLR8TjXpTPGcs8BHja764tbSl72PXvmPizzqui1YUGdL2Uead5XEwxnIm9m5T7SPGZ2_NUafBGqKrDPmyNi5mHBeMvB9dK7ODix0CtilxKdjQe_nkcRJQa15rLfQn8oHgVb2R9lrUo0Sy9EwVqR-2FHQk' : defaultRoomImages[imageIndex]);

                    const cardHTML = `
                        <div class="bg-surface rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group">
                            <div class="h-40 bg-surface-container relative overflow-hidden">
                                ${imageSrc ? `
                                    <img alt="Ảnh phòng ${room.id}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${imageSrc}"/>
                                ` : `
                                    <div class="w-full h-full bg-surface-variant flex items-center justify-center text-outline-variant">
                                        <span class="material-symbols-outlined text-4xl">image_not_supported</span>
                                    </div>
                                `}
                                <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                                    <div class="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${statusClass}">
                                        <span class="w-2 h-2 rounded-full ${statusDot}"></span> ${statusLabel}
                                    </div>
                                    ${paymentBadgeHTML}
                                </div>
                            </div>
                            <div class="p-lg flex-1 flex flex-col">
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="font-title-lg text-title-lg font-bold text-primary">Phòng ${room.id}</h3>
                                    <span class="text-on-surface-variant text-label-md bg-surface-container px-2 py-1 rounded">Tầng ${room.floor}</span>
                                </div>
                                <div class="text-lg font-bold text-on-surface mb-4">${formatVND(room.price)}<span class="text-xs font-normal text-on-surface-variant">/tháng</span></div>
                                <div class="grid grid-cols-2 gap-2 mb-4 text-sm text-on-surface-variant">
                                    <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px] text-outline">square_foot</span> ${room.size} m²</div>
                                    <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px] text-outline">group</span> ${room.occupants}/${room.maxOccupants} người</div>
                                </div>
                                <div class="mt-auto pt-4 border-t border-outline-variant flex gap-2">
                                    ${actionButtonHTML}
                                </div>
                            </div>
                        </div>
                    `;

                    const cardElement = parseHTML(cardHTML);
                    gridContainer.appendChild(cardElement);

                    // Gán sự kiện cho từng nút
                    cardElement.querySelectorAll('.detail-btn').forEach(btn => {
                        btn.addEventListener('click', () => window.navigateTo('roomDetail', { roomId: room.id }));
                    });

                    cardElement.querySelectorAll('.add-tenant-btn').forEach(btn => {
                        btn.addEventListener('click', () => window.QuinnViews.showAddTenantModal(room.id));
                    });

                    cardElement.querySelectorAll('.done-repair-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            window.QuinnState.updateRoomStatus(room.id, 'vacant');
                            window.navigateTo('rooms');
                        });
                    });

                    cardElement.querySelectorAll('.edit-btn').forEach(btn => {
                        btn.addEventListener('click', () => window.navigateTo('roomDetail', { roomId: room.id }));
                    });
                });
            };

            const filterAndRender = () => {
                let filtered = rooms;
                
                if (currentStatusFilter) {
                    if (currentStatusFilter === 'paid') {
                        filtered = filtered.filter(r => {
                            if (r.status !== 'rented') return false;
                            const period = window.QuinnState.getCurrentPeriod();
                            const roomInvoices = invoices.filter(i => i.roomId === r.id && i.period === period);
                            return roomInvoices.length > 0 && roomInvoices.every(i => i.status === 'Paid');
                        });
                    } else if (currentStatusFilter === 'unpaid') {
                        filtered = filtered.filter(r => {
                            if (r.status !== 'rented') return false;
                            const period = window.QuinnState.getCurrentPeriod();
                            const roomInvoices = invoices.filter(i => i.roomId === r.id && i.period === period);
                            return roomInvoices.length === 0 || roomInvoices.some(i => i.status !== 'Paid');
                        });
                    } else {
                        filtered = filtered.filter(r => r.status === currentStatusFilter);
                    }
                }

                if (currentPriceFilter) {
                    if (currentPriceFilter === '<3m') {
                        filtered = filtered.filter(r => r.price < 3500000);
                    } else if (currentPriceFilter === '3m-5m') {
                        filtered = filtered.filter(r => r.price >= 3500000 && r.price <= 4000000);
                    } else if (currentPriceFilter === '>5m') {
                        filtered = filtered.filter(r => r.price > 4000000);
                    }
                }

                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter(r => 
                        r.id.toLowerCase().includes(q) || 
                        (r.tenant && r.tenant.name.toLowerCase().includes(q))
                    );
                }

                renderGrid(filtered);
            };

            const html = `
                <div>
                    <!-- Header -->
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-lg gap-4">
                        <div>
                            <h2 class="font-headline-lg text-headline-lg font-bold text-on-surface">Danh sách phòng trọ</h2>
                            <p class="text-on-surface-variant mt-1 text-body-md">Quản lý trạng thái và thông tin chi tiết các phòng.</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-sm">
                            <div class="relative">
                                <select id="status-filter" class="appearance-none bg-surface border border-outline-variant rounded-lg pl-4 pr-10 py-2 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary hover:bg-surface-container-low transition-colors cursor-pointer text-on-surface">
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="rented">Đang thuê</option>
                                    <option value="vacant">Còn trống</option>
                                    <option value="repair">Đang sửa chữa</option>
                                    <option value="paid">Đã đóng tiền</option>
                                    <option value="unpaid">Chưa đóng tiền</option>
                                </select>
                                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                            </div>
                            <div class="relative">
                                <select id="price-filter" class="appearance-none bg-surface border border-outline-variant rounded-lg pl-4 pr-10 py-2 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary hover:bg-surface-container-low transition-colors cursor-pointer text-on-surface">
                                    <option value="">Lọc theo giá</option>
                                    <option value="<3m">&lt; 3.500.000 đ</option>
                                    <option value="3m-5m">3.500.000 - 4.000.000 đ</option>
                                    <option value=">5m">&gt; 4.000.000 đ</option>
                                </select>
                                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                            </div>
                            <button id="add-room-btn" class="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                                <span class="material-symbols-outlined text-[18px]">add</span>
                                Thêm phòng mới
                            </button>
                        </div>
                    </div>

                    <!-- Search Bar -->
                    <div class="bg-surface-container-lowest rounded-xl border border-outline-variant p-md mb-lg flex items-center gap-3">
                        <div class="relative flex-1">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                            <input id="search-input" class="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="Tìm theo mã phòng, tên khách thuê..." type="text"/>
                        </div>
                    </div>

                    <!-- Room Grid Container -->
                    <div id="rooms-grid-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-lg">
                        <!-- Thẻ phòng sẽ được render ở đây -->
                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Bắt sự kiện thay đổi bộ lọc
            dom.querySelector('#status-filter').addEventListener('change', (e) => {
                currentStatusFilter = e.target.value;
                filterAndRender();
            });

            dom.querySelector('#price-filter').addEventListener('change', (e) => {
                currentPriceFilter = e.target.value;
                filterAndRender();
            });

            dom.querySelector('#search-input').addEventListener('input', (e) => {
                searchQuery = e.target.value;
                filterAndRender();
            });

            dom.querySelector('#add-room-btn').addEventListener('click', () => {
                window.QuinnViews.showAddRoomModal();
            });

            // Lần chạy đầu tiên
            setTimeout(filterAndRender, 0);

            return dom;
        },

        // 3. Màn hình Chi tiết phòng (Room Detail)
        renderRoomDetail: function (params) {
            const roomId = params ? params.roomId : '101';
            const room = window.QuinnState.getRoomById(roomId);
            const settings = window.QuinnState.getSettings();
            
            if (!room) {
                return parseHTML(`<div class="p-8 text-center text-error font-bold">Phòng ${roomId} không tồn tại!</div>`);
            }

            const invoices = window.QuinnState.getInvoices().filter(i => i.roomId === roomId);

            let statusBadge = '';
            if (room.status === 'rented') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]">Đang thuê</span>`;
            } else if (room.status === 'vacant') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEEEEE] text-[#616161] border border-[#E0E0E0]">Còn trống</span>`;
            } else if (room.status === 'repair') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">Bảo trì</span>`;
            }

            // Tính tiền điện nước tháng này của phòng (chỉ lấy log mới nhất nếu có)
            const latestLog = room.utilityHistory[0];
            let utilityCost = 0;
            if (latestLog) {
                utilityCost = latestLog.utilityCost || 0;
            }

            const html = `
                <div>
                    <!-- Breadcrumb & Header -->
                    <div class="flex justify-between items-end mb-lg">
                        <div>
                            <nav class="flex text-on-surface-variant font-label-md text-label-md mb-2">
                                <a class="hover:text-primary cursor-pointer" onclick="window.navigateTo('rooms')">Danh sách phòng</a>
                                <span class="mx-2">/</span>
                                <span class="text-on-surface">Tầng ${room.floor}</span>
                            </nav>
                            <h2 class="font-headline-lg text-headline-lg text-on-surface flex items-center gap-3">
                                ${room.id}
                                ${statusBadge}
                            </h2>
                        </div>
                        <div class="flex gap-3">
                            <button id="add-maintenance-btn" class="px-4 py-2 border border-[#FF9800] text-[#E65100] rounded-lg font-label-md text-label-md hover:bg-[#FFF3E0] transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-[18px]">build</span>
                                Yêu cầu sửa chữa
                            </button>
                            ${room.status === 'rented' ? `
                                <button id="vacant-room-btn" class="px-4 py-2 border border-error text-error rounded-lg font-label-md text-label-md hover:bg-error-container/20 transition-colors flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[18px]">logout</span>
                                    Trả phòng
                                </button>
                            ` : `
                                <button id="add-tenant-detail-btn" class="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-colors flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[18px]">person_add</span>
                                    Nhận phòng
                                </button>
                            `}
                        </div>
                    </div>

                    <!-- Main Grid -->
                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-lg">
                        
                        <!-- Cột Trái (Rộng) -->
                        <div class="xl:col-span-2 flex flex-col gap-lg">
                            
                            <!-- Gallery & Specs -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="col-span-2 sm:col-span-1 rounded-xl overflow-hidden h-[240px] relative shadow-sm border border-outline-variant">
                                    <img class="w-full h-full object-cover" src="${room.status === 'repair' ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuBV455pFGBPPH7n5cb1-rCVhNFmg_hW8SoInlOnOQjZKugvR-kxvVCRf5MrEmcc_NGG--RhudJdG6EAgHi3OBydrFispw8yn6m6W4j10iY9Dw4i2n7LXDrLR8TjXpTPGcs8BHja764tbSl72PXvmPizzqui1YUGdL2Uead5XEwxnIm9m5T7SPGZ2_NUafBGqKrDPmyNi5mHBeMvB9dK7ODix0CtilxKdjQe_nkcRJQa15rLfQn8oHgVb2R9lrUo0Sy9EwVqR-2FHQk' : 'https://lh3.googleusercontent.com/aida-public/AB6AXuC44GHdnl6_qQru6DdiDzGQmssmpmUbHEwVuzEMeWvcpIg4tCwMTGuiT1QJFNEFNLCOvgeyqMTgRxQUfRPHSXenJMrcqlD4zDktEI4pFBnv5X9JGAfj0qMZihjLAAAvPdo0joFSVHXJIGijXZ0FTSqIbkcuxm85ElvsuP-SuOOh24Ga0b05N9zTiKwTAR8K0dqGHJZaNFxNPLwxQmqJytmbhMpDFyG3nVlCDWdgOlv_ojbk6e0cqSvfKbbM0UrbxXH4ez5qbX-224Y'}"/>
                                </div>
                                <div class="col-span-2 sm:col-span-1 grid grid-cols-2 gap-4">
                                    <div id="edit-price-card" class="bg-surface rounded-xl p-md border border-outline-variant shadow-sm flex flex-col justify-center cursor-pointer hover:bg-surface-container-low transition-all group relative" title="Nhấp để chỉnh sửa Giá thuê">
                                        <span class="text-on-surface-variant font-label-md text-label-md mb-1 flex items-center gap-1">
                                            Giá thuê
                                            <span class="material-symbols-outlined text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                        </span>
                                        <span class="font-title-lg text-title-lg text-primary">${formatVND(room.price)}</span>
                                    </div>
                                    <div class="bg-surface rounded-xl p-md border border-outline-variant shadow-sm flex flex-col justify-center">
                                        <span class="text-on-surface-variant font-label-md text-label-md mb-1">Diện tích</span>
                                        <span class="font-title-lg text-title-lg text-on-surface">${room.size}m²</span>
                                    </div>
                                    <div id="edit-deposit-card" class="bg-surface rounded-xl p-md border border-outline-variant shadow-sm flex flex-col justify-center cursor-pointer hover:bg-surface-container-low transition-all group relative" title="Nhấp để chỉnh sửa Tiền cọc">
                                        <span class="text-on-surface-variant font-label-md text-label-md mb-1 flex items-center gap-1">
                                            Tiền cọc
                                            <span class="material-symbols-outlined text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                        </span>
                                        <span class="font-title-lg text-title-lg text-on-surface">${formatVND(room.deposit)}</span>
                                    </div>
                                    <div id="edit-max-occupants-card" class="bg-surface rounded-xl p-md border border-outline-variant shadow-sm flex flex-col justify-center cursor-pointer hover:bg-surface-container-low transition-all group relative" title="Nhấp để chỉnh sửa Số lượng tối đa">
                                        <span class="text-on-surface-variant font-label-md text-label-md mb-1 flex items-center gap-1">
                                            Số lượng tối đa
                                            <span class="material-symbols-outlined text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                        </span>
                                        <span class="font-title-lg text-title-lg text-on-surface">${room.maxOccupants} người</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Nội thất & Tiện ích -->
                            <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                                <h3 class="font-title-lg text-title-lg text-on-surface mb-md flex items-center gap-2">
                                    <span class="material-symbols-outlined text-primary">chair</span>
                                    Nội thất & Tiện ích
                                </h3>
                                <div class="flex flex-wrap gap-2">
                                    ${room.furniture.map(item => `
                                        <span class="px-3 py-1 bg-surface-container rounded-full text-on-surface font-body-md text-body-md border border-outline-variant">${item}</span>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Điện Nước tháng này -->
                            <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                                <div class="flex justify-between items-center mb-md">
                                    <h3 class="font-title-lg text-title-lg text-on-surface flex items-center gap-2">
                                        <span class="material-symbols-outlined text-primary">speed</span>
                                        Tiền Điện Nước ghi nhận mới nhất
                                    </h3>
                                    ${room.status === 'rented' ? `
                                        <button id="chot-so-btn" class="text-primary font-label-md text-label-md hover:underline">Nhập tiền điện nước</button>
                                    ` : ''}
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                                    ${room.fixedUtilities ? `
                                        <div id="edit-fixed-utilities-card" class="col-span-2 border border-outline-variant rounded-lg p-4 bg-surface hover:bg-surface-container-low transition-all group relative flex items-center gap-4 cursor-pointer" title="Nhấp để chỉnh sửa Điện nước cố định">
                                            <div class="w-12 h-12 rounded-full bg-[#E3F2FD] flex items-center justify-center text-[#1976D2] flex-shrink-0">
                                                <span class="material-symbols-outlined text-2xl">bolt</span>
                                            </div>
                                            <div class="flex-grow">
                                                <p class="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
                                                    ĐIỆN NƯỚC CỐ ĐỊNH
                                                    <span class="material-symbols-outlined text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                                </p>
                                                <p class="text-primary text-xl font-bold mt-1 fixed-utilities-value">${formatVND(room.fixedUtilities)} / tháng</p>
                                                <p class="text-xs text-on-surface-variant mt-0.5">Không tính theo chỉ số sử dụng thực tế (Áp dụng cho phòng nội bộ/chủ nhà).</p>
                                            </div>
                                        </div>
                                    ` : `
                                        <div id="edit-utility-cost-card" class="col-span-2 border border-outline-variant rounded-lg p-4 bg-surface hover:bg-surface-container-low transition-all group relative flex items-center gap-4 cursor-pointer" title="Nhấp để chỉnh sửa tiền điện nước">
                                            <div class="w-12 h-12 rounded-full bg-[#FFF3E0] flex items-center justify-center text-[#F57F17] flex-shrink-0 relative">
                                                <span class="material-symbols-outlined text-2xl">bolt</span>
                                                <span class="material-symbols-outlined text-lg absolute -bottom-1 -right-1 bg-[#E3F2FD] rounded-full p-[2px] text-[#1976D2]">water_drop</span>
                                            </div>
                                            <div class="flex-grow">
                                                <p class="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
                                                    TIỀN ĐIỆN NƯỚC
                                                    <span class="material-symbols-outlined text-[16px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                                </p>
                                                <p class="text-primary text-xl font-bold mt-1 utility-cost-value">${formatVND(utilityCost)}</p>
                                                <p class="text-xs text-on-surface-variant mt-0.5">Ghi nhận kỳ này. Nhấp để chỉnh sửa trực tiếp.</p>
                                            </div>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>

                        <!-- Cột Phải (Thông tin Khách thuê / Lịch sử) -->
                        <div class="flex flex-col gap-lg">
                            
                            <!-- Khách thuê hiện tại -->
                            <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                                <h3 class="font-title-lg text-title-lg text-on-surface mb-4">Người thuê hiện tại</h3>
                                ${room.tenant ? `
                                    <div class="flex items-center gap-4 mb-4">
                                        <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg">
                                            ${room.tenant.name.split(' ').pop().substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p class="font-body-md text-body-md font-semibold text-on-surface">${room.tenant.name}</p>
                                            <p class="font-body-md text-body-md text-on-surface-variant">${room.tenant.phone}</p>
                                        </div>
                                    </div>
                                    <div class="pt-4 border-t border-outline-variant text-sm space-y-2">
                                        <div class="flex justify-between">
                                            <span class="text-on-surface-variant">Ngày vào:</span>
                                            <span class="text-on-surface font-medium">${room.tenant.startDate}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-on-surface-variant">Ngày hết hạn hợp đồng:</span>
                                            <span class="text-on-surface font-medium">${room.tenant.endDate}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-on-surface-variant">Số lượng xe máy:</span>
                                            <span class="text-on-surface font-medium">${room.tenant.vehicles || 1} xe</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-on-surface-variant">Ngày đóng tiền hàng tháng:</span>
                                            <span class="text-on-surface font-medium">${room.paymentDay || 'Chưa đặt'}</span>
                                        </div>
                                    </div>
                                ` : `
                                    <p class="text-on-surface-variant italic text-sm py-4 text-center">Phòng đang trống</p>
                                `}
                            </div>

                            <!-- Lịch sử hóa đơn của phòng -->
                            <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                                <h3 class="font-title-lg text-title-lg text-on-surface mb-4 flex items-center gap-2">
                                    <span class="material-symbols-outlined text-primary">receipt_long</span>
                                    Lịch sử thanh toán
                                </h3>
                                <div class="space-y-3">
                                    ${invoices.length > 0 ? invoices.map(inv => `
                                        <div class="flex justify-between items-center p-3 bg-surface-container-low rounded-lg border border-outline-variant cursor-pointer hover:border-primary/50" onclick="window.navigateTo('payments')">
                                            <div>
                                                <p class="font-label-md text-label-md text-on-surface">${inv.period}</p>
                                                <p class="text-xs text-on-surface-variant mt-0.5">${formatVND(inv.total)}</p>
                                            </div>
                                            <div onclick="event.stopPropagation()">
                                                <select class="invoice-status-select px-2.5 py-0.5 rounded-full text-xs font-semibold border outline-none cursor-pointer transition-all ${inv.status === 'Paid' ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]' : 'bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]'}" data-id="${inv.id}">
                                                    <option value="Paid" ${inv.status === 'Paid' ? 'selected' : ''}>Hoàn tất</option>
                                                    <option value="Unpaid" ${inv.status === 'Unpaid' ? 'selected' : ''}>Chưa nộp</option>
                                                </select>
                                            </div>
                                        </div>
                                    `).join('') : `
                                        <p class="text-on-surface-variant italic text-sm text-center py-2">Chưa có hóa đơn nào.</p>
                                    `}
                                </div>
                            </div>

                            <!-- Nhật ký bảo trì của phòng -->
                            <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm relative overflow-hidden">
                                <h3 class="font-title-lg text-title-lg text-on-surface mb-md flex items-center gap-2">
                                    <span class="material-symbols-outlined text-primary">plumbing</span>
                                    Nhật ký bảo trì
                                </h3>
                                <div class="relative border-l border-outline-variant ml-3 space-y-4 pb-2">
                                    ${room.maintenanceLogs.length > 0 ? room.maintenanceLogs.map(log => `
                                        <div class="relative pl-6">
                                            <span class="absolute -left-1.5 top-1 w-3 h-3 rounded-full ${log.status === 'Mới' ? 'bg-error' : 'bg-[#4CAF50]'}"></span>
                                            <p class="font-label-md text-label-md text-on-surface">${log.title}</p>
                                            <p class="text-xs text-on-surface-variant mt-0.5">${log.date} • Trạng thái: ${log.status}</p>
                                        </div>
                                    `).join('') : `
                                        <p class="text-on-surface-variant italic text-sm pl-4">Không có nhật ký bảo trì.</p>
                                    `}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Gán sự kiện Thêm khách thuê
            if (dom.querySelector('#add-tenant-detail-btn')) {
                dom.querySelector('#add-tenant-detail-btn').addEventListener('click', () => {
                    window.QuinnViews.showAddTenantModal(room.id);
                });
            }

            // Trả phòng
            if (dom.querySelector('#vacant-room-btn')) {
                dom.querySelector('#vacant-room-btn').addEventListener('click', () => {
                    if (confirm(`Bạn có chắc muốn trả phòng ${room.id} và chấm dứt hợp đồng?`)) {
                        window.QuinnState.updateRoomStatus(room.id, 'vacant');
                        window.navigateTo('roomDetail', { roomId: room.id });
                    }
                });
            }

            // Ghi nhận chỉ số
            if (dom.querySelector('#chot-so-btn')) {
                dom.querySelector('#chot-so-btn').addEventListener('click', () => {
                    window.QuinnViews.showRecordUtilityModal(room.id);
                });
            }

            // Thêm yêu cầu sửa chữa bảo trì
            dom.querySelector('#add-maintenance-btn').addEventListener('click', () => {
                const title = prompt('Nhập nội dung hư hại cần sửa chữa:');
                if (title && title.trim()) {
                    window.QuinnState.addMaintenanceLog(room.id, title);
                    window.navigateTo('roomDetail', { roomId: room.id });
                }
            });

            // Sửa giá thuê trực tiếp inline
            dom.querySelector('#edit-price-card').addEventListener('click', () => {
                const card = dom.querySelector('#edit-price-card');
                makeCardInlineEditable(card, '.font-title-lg', room.price, (newPrice) => {
                    window.QuinnState.updateRoomPrice(room.id, newPrice);
                    window.navigateTo('roomDetail', { roomId: room.id });
                });
            });

            // Sửa tiền cọc trực tiếp inline
            dom.querySelector('#edit-deposit-card').addEventListener('click', () => {
                const card = dom.querySelector('#edit-deposit-card');
                makeCardInlineEditable(card, '.font-title-lg', room.deposit, (newDeposit) => {
                    window.QuinnState.updateRoomDeposit(room.id, newDeposit);
                    window.navigateTo('roomDetail', { roomId: room.id });
                });
            });

            // Sửa số lượng người tối đa inline
            dom.querySelector('#edit-max-occupants-card').addEventListener('click', () => {
                const card = dom.querySelector('#edit-max-occupants-card');
                makeCardInlineEditable(card, '.font-title-lg', room.maxOccupants, (newMax) => {
                    if (newMax <= 0) {
                        alert('Số lượng người tối đa phải lớn hơn 0!');
                        window.navigateTo('roomDetail', { roomId: room.id });
                    } else {
                        window.QuinnState.updateRoomMaxOccupants(room.id, newMax);
                        window.navigateTo('roomDetail', { roomId: room.id });
                    }
                });
            });

            // Sửa tiền điện nước cố định trực tiếp inline
            if (dom.querySelector('#edit-fixed-utilities-card')) {
                dom.querySelector('#edit-fixed-utilities-card').addEventListener('click', () => {
                    const card = dom.querySelector('#edit-fixed-utilities-card');
                    makeCardInlineEditable(card, '.fixed-utilities-value', room.fixedUtilities, (newFixed) => {
                        window.QuinnState.updateRoomFixedUtilities(room.id, newFixed);
                        window.navigateTo('roomDetail', { roomId: room.id });
                    });
                });
            }

            // Sửa tiền điện nước trực tiếp inline
            if (dom.querySelector('#edit-utility-cost-card')) {
                dom.querySelector('#edit-utility-cost-card').addEventListener('click', () => {
                    const card = dom.querySelector('#edit-utility-cost-card');
                    makeCardInlineEditable(card, '.utility-cost-value', utilityCost, (newAmount) => {
                        window.QuinnState.updateRecordedUtilityCost(room.id, window.QuinnState.getCurrentPeriod(), newAmount);
                        window.navigateTo('roomDetail', { roomId: room.id });
                    });
                });
            }
            // Thay đổi trạng thái thanh toán từ Lịch sử thanh toán
            dom.querySelectorAll('.invoice-status-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const invoiceId = e.target.getAttribute('data-id');
                    const status = e.target.value;
                    window.QuinnState.updateInvoiceStatus(invoiceId, status);
                    window.navigateTo('roomDetail', { roomId: room.id });
                });
            });

            return dom;
        },

        // 4. Màn hình Quản lý thanh toán (Payments)
        renderPayments: function () {
            const invoices = window.QuinnState.getInvoices();

            // Tính thống kê
            const expected = invoices.reduce((sum, inv) => sum + inv.total, 0);
            const collected = invoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.total, 0);
            const debt = invoices.filter(inv => inv.status !== 'Paid').reduce((sum, inv) => sum + inv.total, 0);
            const unpaidCount = invoices.filter(inv => inv.status !== 'Paid').length;

            const html = `
                <div>
                    <!-- Header -->
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-lg gap-md">
                        <div>
                            <h1 class="font-headline-lg text-headline-lg font-bold text-on-surface">Quản lý thanh toán</h1>
                            <p class="text-on-surface-variant mt-xs">Tổng quan tài chính và danh sách hóa đơn thu tiền.</p>
                        </div>
                        <div class="flex gap-sm w-full md:w-auto">
                            <button id="remind-all-btn" class="flex-1 md:flex-none px-4 py-2 bg-surface text-primary border border-primary rounded font-label-md text-label-md hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                                <span class="material-symbols-outlined text-[18px]">campaign</span>
                                Gửi nhắc nhở hàng loạt
                            </button>
                            <button id="add-invoice-btn" class="flex-1 md:flex-none px-4 py-2 bg-primary text-on-primary rounded font-label-md text-label-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm">
                                <span class="material-symbols-outlined text-[18px]">add</span>
                                Tạo hóa đơn
                            </button>
                        </div>
                    </div>

                    <!-- Widgets Bento Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-lg mb-lg">
                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 w-24 h-24 bg-primary-fixed rounded-full opacity-50 blur-xl pointer-events-none"></div>
                            <div class="flex items-center gap-3 mb-md">
                                <div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                                    <span class="material-symbols-outlined">account_balance_wallet</span>
                                </div>
                                <h3 class="font-title-lg text-title-lg text-on-surface">Tổng dự kiến thu</h3>
                            </div>
                            <div class="mt-auto">
                                <span class="text-2xl font-bold text-primary">${formatVND(expected)}</span>
                            </div>
                        </div>

                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 w-24 h-24 bg-[#E8F5E9] rounded-full opacity-50 blur-xl pointer-events-none"></div>
                            <div class="flex items-center gap-3 mb-md">
                                <div class="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                                    <span class="material-symbols-outlined">check_circle</span>
                                </div>
                                <h3 class="font-title-lg text-title-lg text-on-surface">Thực thu</h3>
                            </div>
                            <div class="mt-auto flex items-baseline justify-between">
                                <div>
                                    <span class="text-2xl font-bold text-on-surface">${formatVND(collected)}</span>
                                </div>
                                <div class="flex items-center text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-1 rounded-full text-xs font-bold">
                                    <span class="material-symbols-outlined text-[14px] mr-1">trending_up</span>
                                    ${expected > 0 ? Math.round((collected/expected)*100) : 0}%
                                </div>
                            </div>
                        </div>

                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 w-24 h-24 bg-error-container rounded-full opacity-50 blur-xl pointer-events-none"></div>
                            <div class="flex items-center gap-3 mb-md">
                                <div class="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-on-error-container">
                                    <span class="material-symbols-outlined">warning</span>
                                </div>
                                <h3 class="font-title-lg text-title-lg text-on-surface">Còn thiếu</h3>
                            </div>
                            <div class="mt-auto flex items-baseline justify-between">
                                <div>
                                    <span class="text-2xl font-bold text-error">${formatVND(debt)}</span>
                                </div>
                                <div class="text-on-surface-variant text-sm">
                                    Từ ${unpaidCount} hóa đơn
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bills Table Section -->
                    <div class="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
                        <div class="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                            <h2 class="font-title-lg text-title-lg text-on-surface">Danh sách hóa đơn</h2>
                        </div>
                        <div class="overflow-x-auto w-full">
                            <table class="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr class="bg-surface-container-low border-b border-outline-variant font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                                        <th class="p-4 w-24">Phòng</th>
                                        <th class="p-3">Khách thuê</th>
                                        <th class="p-3 text-right">Tổng tiền (đ)</th>
                                        <th class="p-3 text-right">Tiền điện nước</th>
                                        <th class="p-3">Ngày tạo</th>
                                        <th class="p-3 text-center">Trạng thái</th>
                                        <th class="p-3 w-32 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-outline-variant font-body-md text-body-md text-on-surface">
                                    ${invoices.map(inv => {
                                        let statusChip = '';
                                        if (inv.status === 'Paid') {
                                            statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32]">Đã thanh toán</span>`;
                                        } else if (inv.status === 'Unpaid') {
                                            statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant">Chưa thanh toán</span>`;
                                        } else if (inv.status === 'Overdue') {
                                            statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Quá hạn</span>`;
                                        }

                                        return `
                                            <tr class="hover:bg-primary-fixed-dim/5 transition-colors bg-surface-bright">
                                                <td class="p-4 font-semibold text-primary cursor-pointer hover:underline" onclick="window.navigateTo('roomDetail', { roomId: '${inv.roomId}' })">${inv.roomId}</td>
                                                <td class="p-3 font-medium">${inv.tenantName}</td>
                                                <td class="p-3 text-right font-bold ${inv.status !== 'Paid' ? 'text-error' : ''}">${inv.total.toLocaleString('vi-VN')}</td>
                                                <td class="p-3 text-right text-on-surface-variant">${inv.roomId === '101' ? `${(inv.utilityCost || 0).toLocaleString('vi-VN')} (Cố định)` : (inv.utilityCost || 0).toLocaleString('vi-VN')}</td>
                                                <td class="p-3 text-on-surface-variant">${inv.createdDate}</td>
                                                <td class="p-3 text-center">${statusChip}</td>
                                                <td class="p-3 text-center">
                                                    <div class="flex justify-center gap-1.5">
                                                        ${inv.status !== 'Paid' ? `
                                                            <button class="pay-btn px-2.5 py-1 bg-[#4CAF50] text-white hover:bg-[#43A047] rounded text-xs font-bold transition-colors shadow-sm" data-id="${inv.id}">
                                                                Thanh toán
                                                            </button>
                                                        ` : `<span class="text-xs text-on-surface-variant/70 italic">Đã chốt ngày ${inv.paymentDate}</span>`}
                                                        <button class="delete-invoice-btn text-outline hover:text-error p-1 transition-colors" data-id="${inv.id}">
                                                            <span class="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Xử lý sự kiện bấm nút Thanh toán nhanh
            dom.querySelectorAll('.pay-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (confirm('Xác nhận khách thuê đã thanh toán hóa đơn này?')) {
                        window.QuinnState.payInvoice(id);
                        window.navigateTo('payments');
                    }
                });
            });

            // Xóa hóa đơn
            dom.querySelectorAll('.delete-invoice-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('Bạn có chắc muốn xóa hóa đơn này khỏi hệ thống?')) {
                        window.QuinnState.deleteInvoice(id);
                        window.navigateTo('payments');
                    }
                });
            });

            // Tạo hóa đơn thủ công
            dom.querySelector('#add-invoice-btn').addEventListener('click', () => {
                window.navigateTo('utilities');
            });

            // Nhắc nhở hàng loạt
            dom.querySelector('#remind-all-btn').addEventListener('click', () => {
                if (unpaidCount > 0) {
                    alert(`Đã gửi thông báo nhắc nhở nộp tiền thành công đến ${unpaidCount} chủ phòng chưa thanh toán hóa đơn!`);
                } else {
                    alert('Tất cả các phòng đã thanh toán đủ hóa đơn tháng này!');
                }
            });

            return dom;
        },

        // 5. Màn hình Quản lý hợp đồng (Contracts)
        renderContracts: function () {
            const contracts = window.QuinnState.getContracts();
            const rooms = window.QuinnState.getRooms();
            const invoices = window.QuinnState.getInvoices();
            const activeContracts = contracts.filter(c => c.status !== 'Terminated');
            const overdueRooms = activeContracts.filter(c => {
                const room = rooms.find(r => r.id === c.roomId);
                return room && getTenantPaymentStatus(room, invoices).label.startsWith('Quá hạn');
            });
            const dueSoonRooms = activeContracts.filter(c => {
                const room = rooms.find(r => r.id === c.roomId);
                if (!room) return false;
                const due = getPaymentDueInfo(room.paymentDay);
                return due.daysLeft !== null && due.daysLeft <= 3;
            });
            const totalDeposit = activeContracts.reduce((sum, c) => sum + (Number(c.deposit) || 0), 0);

            const filterContracts = (filterMode) => {
                let filtered = contracts;
                if (filterMode === 'Active') {
                    filtered = contracts.filter(c => c.status === 'Active' || c.status === 'Expired');
                } else if (filterMode === 'Expiring') {
                    filtered = contracts.filter(c => c.status === 'Expiring');
                } else if (filterMode === 'Overdue') {
                    filtered = contracts.filter(c => {
                        const room = rooms.find(r => r.id === c.roomId);
                        return room && getTenantPaymentStatus(room, invoices).label.startsWith('Quá hạn');
                    });
                } else if (filterMode === 'Terminated') {
                    filtered = contracts.filter(c => c.status === 'Terminated');
                }

                const tbody = dom.querySelector('#contracts-tbody');
                tbody.innerHTML = '';

                if (filtered.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="8" class="py-8 text-center text-on-surface-variant italic">Không có khách thuê phù hợp.</td>
                        </tr>
                    `;
                    return;
                }

                filtered.forEach(c => {
                    let badge = '';
                    if (c.status === 'Active') {
                        badge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32]">Đang hiệu lực</span>`;
                    } else if (c.status === 'Expiring') {
                        badge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFF3E0] text-[#E65100]">Sắp hết hạn</span>`;
                    } else if (c.status === 'Terminated') {
                        badge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container-highest text-on-surface-variant">Đã chấm dứt</span>`;
                    } else if (c.status === 'Expired') {
                        badge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Đã hết hạn</span>`;
                    }

                    const room = rooms.find(r => r.id === c.roomId);
                    const paymentDay = c.paymentDay || room?.paymentDay || 'Chưa đặt';
                    const dueInfo = getPaymentDueInfo(paymentDay);
                    const paymentStatus = room ? getTenantPaymentStatus(room, invoices) : {
                        label: 'Đã chấm dứt',
                        tone: 'bg-surface-container-high text-on-surface-variant border border-outline-variant',
                        icon: 'block'
                    };
                    const tenantInitial = c.tenantName.split(' ').pop().substring(0, 2).toUpperCase();

                    const trHTML = `
                        <tr class="hover:bg-surface-container-lowest/70 transition-colors bg-surface-bright align-top">
                            <td class="py-4 px-md font-semibold text-primary cursor-pointer hover:underline view-room-detail" data-room="${c.roomId}">${c.roomId}</td>
                            <td class="py-4 px-md min-w-[260px]">
                                <div class="flex items-start gap-3">
                                    <div class="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-xs flex-shrink-0">${tenantInitial}</div>
                                    <div>
                                        <p class="font-semibold text-on-surface leading-snug">${c.tenantName}</p>
                                        <p class="text-xs text-on-surface-variant mt-1">HĐ: ${c.startDate} - ${c.endDate}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-md text-on-surface-variant whitespace-nowrap">${room?.tenant?.phone || '-'}</td>
                            <td class="py-4 px-md whitespace-nowrap">
                                <div class="font-semibold text-on-surface">${paymentDay}</div>
                                <div class="text-xs text-on-surface-variant mt-1">Hạn kế tiếp: ${dueInfo.label}</div>
                            </td>
                            <td class="py-4 px-md text-right whitespace-nowrap">
                                <div class="font-bold text-on-surface">${formatVND(room?.price || 0)}</div>
                                <div class="text-xs text-on-surface-variant mt-1">Cọc ${formatVND(c.deposit || 0)}</div>
                            </td>
                            <td class="py-4 px-md text-center whitespace-nowrap">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${paymentStatus.tone}">
                                    <span class="material-symbols-outlined text-[16px]">${paymentStatus.icon}</span>
                                    ${paymentStatus.label}
                                </span>
                            </td>
                            <td class="py-4 px-md text-center whitespace-nowrap">${badge}</td>
                            <td class="py-3 px-md text-right">
                                <div class="flex justify-end gap-2">
                                    <button class="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded-md hover:bg-primary-fixed/30 view-room-detail" data-room="${c.roomId}" title="Xem chi tiết phòng">
                                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                                    </button>
                                    <button class="p-1.5 text-primary hover:opacity-85 transition-colors rounded-md hover:bg-primary-fixed/30 download-pdf-btn" title="Tải hợp đồng PDF">
                                        <span class="material-symbols-outlined text-[20px]">download</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    const tr = parseHTML(trHTML);
                    tbody.appendChild(tr);

                    // Bấm vào xem chi tiết phòng
                    tr.querySelectorAll('.view-room-detail').forEach(el => {
                        el.addEventListener('click', (e) => {
                            const rid = e.currentTarget.getAttribute('data-room');
                            const targetRoom = window.QuinnState.getRoomById(rid);
                            if (!targetRoom) {
                                alert(`Phòng ${rid} đã chấm dứt hợp đồng và không còn tồn tại trong hệ thống quản lý phòng hiện tại.`);
                            } else {
                                window.navigateTo('roomDetail', { roomId: rid });
                            }
                        });
                    });

                    // Download PDF
                    tr.querySelector('.download-pdf-btn').addEventListener('click', () => {
                        alert('Đang tạo và tải xuống bản sao Hợp đồng thuê nhà dạng PDF...');
                    });
                });
            };

            const html = `
                <div>
                    <!-- Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-lg gap-4">
                        <div>
                            <h2 class="font-headline-lg text-headline-lg font-bold text-on-surface">Khách thuê</h2>
                            <p class="text-on-surface-variant font-body-md text-body-md mt-1">Theo dõi người thuê, hạn đóng tiền hằng tháng và trạng thái hợp đồng.</p>
                        </div>
                        <button id="add-contract-btn" class="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 w-fit">
                            <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
                            Thêm khách thuê
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-lg mb-lg">
                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                            <p class="text-sm text-on-surface-variant">Đang thuê</p>
                            <p class="text-3xl font-bold text-primary mt-2">${activeContracts.length}</p>
                        </div>
                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                            <p class="text-sm text-on-surface-variant">Sắp đến hạn tiền</p>
                            <p class="text-3xl font-bold text-[#E65100] mt-2">${dueSoonRooms.length}</p>
                        </div>
                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                            <p class="text-sm text-on-surface-variant">Quá hạn kỳ này</p>
                            <p class="text-3xl font-bold text-error mt-2">${overdueRooms.length}</p>
                        </div>
                        <div class="bg-surface rounded-xl p-lg border border-outline-variant shadow-sm">
                            <p class="text-sm text-on-surface-variant">Tổng tiền cọc</p>
                            <p class="text-2xl font-bold text-on-surface mt-2">${formatVND(totalDeposit)}</p>
                        </div>
                    </div>

                    <!-- Filters & Tabs -->
                    <div class="bg-surface-container-lowest rounded-xl border border-outline-variant p-md mb-lg flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            <button id="tab-all" class="tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-primary text-on-primary">Tất cả</button>
                            <button id="tab-active" class="tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors">Đang thuê</button>
                            <button id="tab-overdue" class="tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors">Quá hạn tiền</button>
                            <button id="tab-expiring" class="tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors">Sắp hết hạn HĐ</button>
                            <button id="tab-terminated" class="tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors">Đã chấm dứt</button>
                        </div>
                    </div>

                    <!-- Table -->
                    <div class="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse min-w-[1120px]">
                                <thead>
                                    <tr class="bg-surface-container-low border-b border-outline-variant font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                                        <th class="py-4 px-md">Phòng</th>
                                        <th class="py-4 px-md">Khách thuê</th>
                                        <th class="py-4 px-md">Liên hệ</th>
                                        <th class="py-4 px-md">Hạn đóng tiền</th>
                                        <th class="py-4 px-md text-right">Tiền phòng / cọc</th>
                                        <th class="py-4 px-md text-center">Thanh toán</th>
                                        <th class="py-4 px-md text-center">Hợp đồng</th>
                                        <th class="py-4 px-md text-right">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody id="contracts-tbody" class="divide-y divide-outline-variant font-body-md text-body-md text-on-surface">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Thiết lập sự kiện tab
            const setupTab = (id, filter) => {
                dom.querySelector(id).addEventListener('click', (e) => {
                    dom.querySelectorAll('.tab-btn').forEach(btn => {
                        btn.className = 'tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors';
                    });
                    e.target.className = 'tab-btn px-4 py-2 rounded-full font-label-md text-label-md bg-primary text-on-primary';
                    filterContracts(filter);
                });
            };

            setupTab('#tab-all', 'All');
            setupTab('#tab-active', 'Active');
            setupTab('#tab-overdue', 'Overdue');
            setupTab('#tab-expiring', 'Expiring');
            setupTab('#tab-terminated', 'Terminated');

            // Tạo hợp đồng mới
            dom.querySelector('#add-contract-btn').addEventListener('click', () => {
                alert('Để tạo hợp đồng mới, vui lòng vào màn hình "Danh sách phòng" -> bấm nút "Thêm khách mới" ở phòng còn trống tương ứng.');
                window.navigateTo('rooms');
            });

            // Lần chạy đầu tiên
            setTimeout(() => filterContracts('All'), 0);

            return dom;
        },

        // 6. Màn hình Quản lý điện nước (Utilities)
        renderUtilities: function () {
            const rooms = window.QuinnState.getRooms().filter(r => r.status === 'rented');
            const settings = window.QuinnState.getSettings();
            const period = window.QuinnState.getCurrentPeriod();

            // Tính thống kê
            const invoices = window.QuinnState.getInvoices();
            const totalUtilityCost = invoices.filter(i => i.period === period).reduce((sum, i) => sum + (i.utilityCost || 0), 0);
            
            // Tìm số phòng chưa chốt số trong kỳ này
            const unrecordedRooms = rooms.filter(r => !r.utilityHistory.some(h => h.period === period));
            const recordedRoomsCount = rooms.length - unrecordedRooms.length;

            const html = `
                <div>
                    <!-- Header -->
                    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-lg">
                        <div>
                            <h2 class="font-headline-lg text-headline-lg text-on-surface mb-1">Quản lý điện nước</h2>
                            <p class="font-body-md text-body-md text-on-surface-variant">Nhập tiền điện nước và ghi nhận hóa đơn định kỳ hằng tháng.</p>
                        </div>
                    </div>

                    <!-- Summary Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-lg mb-lg">
                        <div class="bg-surface p-container-margin rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant">
                            <div class="flex items-center gap-4 mb-3">
                                <div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary relative">
                                    <span class="material-symbols-outlined">bolt</span>
                                </div>
                                <h3 class="font-title-lg text-title-lg text-on-surface">Điện nước ghi nhận (tháng này)</h3>
                            </div>
                            <div class="flex items-baseline gap-2">
                                <span class="font-display-lg text-display-lg text-primary">${formatVND(totalUtilityCost)}</span>
                            </div>
                        </div>

                        <div class="bg-surface p-container-margin rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant">
                            <div class="flex items-center gap-4 mb-3">
                                <div class="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                                    <span class="material-symbols-outlined">check_circle</span>
                                </div>
                                <h3 class="font-title-lg text-title-lg text-on-surface">Phòng đã chốt tiền</h3>
                            </div>
                            <div class="flex items-baseline gap-2">
                                <span class="font-display-lg text-display-lg text-[#2E7D32]">${recordedRoomsCount}</span>
                                <span class="font-body-md text-body-md text-on-surface-variant">phòng</span>
                            </div>
                        </div>

                        <div class="bg-surface p-container-margin rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant">
                            <div class="flex items-center gap-4 mb-3">
                                <div class="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
                                    <span class="material-symbols-outlined">pending_actions</span>
                                </div>
                                <h3 class="font-title-lg text-title-lg text-on-surface">Chờ chốt tiền (${period.split('/')[0]})</h3>
                            </div>
                            <div class="flex items-baseline gap-2">
                                <span class="font-display-lg text-display-lg text-on-tertiary-fixed-variant">${unrecordedRooms.length}</span>
                                <span class="font-body-md text-body-md text-on-surface-variant">phòng đang thuê</span>
                            </div>
                        </div>
                    </div>

                    <!-- Bảng dữ liệu chốt số -->
                    <div class="bg-surface rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant overflow-hidden">
                        <div class="p-md border-b border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-container-lowest">
                            <h3 class="font-title-lg text-title-lg font-bold">Ghi nhận hóa đơn kỳ: ${period}</h3>
                        </div>

                        <div class="overflow-x-auto w-full">
                            <table class="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr class="bg-surface-container border-b border-outline-variant font-label-md text-label-md text-on-surface-variant">
                                        <th class="p-md w-24">Phòng</th>
                                        <th class="p-md">Khách thuê</th>
                                        <th class="p-md">Tiền Điện Nước</th>
                                        <th class="p-md">Tính tiền dự tính</th>
                                        <th class="p-md w-40">Trạng thái</th>
                                        <th class="p-md w-24 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody class="font-body-md text-body-md text-on-surface divide-y divide-outline-variant">
                                    ${rooms.map(room => {
                                        const logged = room.utilityHistory.find(h => h.period === period);
                                        const invoice = invoices.find(inv => inv.roomId === room.id && inv.period === period);
                                        
                                        let statusChip = '';
                                        let actionHTML = '';
                                        let utilityText = '';
                                        let totalCalcText = '';

                                        if (room.fixedUtilities) {
                                            if (logged) {
                                                statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-fixed text-on-primary-fixed">Đã chốt cố định</span>`;
                                                actionHTML = `
                                                    <button class="text-outline-variant cursor-not-allowed p-1" disabled title="Đã tạo hóa đơn cố định">
                                                        <span class="material-symbols-outlined text-[20px]">check_circle</span>
                                                    </button>
                                                `;
                                                utilityText = `<span class="text-on-surface-variant italic font-semibold">Cố định (${formatVND(room.fixedUtilities)})</span>`;
                                                totalCalcText = invoice ? `<span class="font-bold">${formatVND(invoice.total)}</span>` : `<span class="font-bold">${formatVND(room.fixedUtilities)}</span>`;
                                            } else {
                                                statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed">Chờ chốt</span>`;
                                                actionHTML = `
                                                    <button class="record-btn text-primary hover:bg-primary-fixed/30 p-1.5 rounded-md transition-colors" data-id="${room.id}" title="Tạo hóa đơn cố định">
                                                        <span class="material-symbols-outlined text-[20px]">edit_document</span>
                                                    </button>
                                                `;
                                                utilityText = `<span class="text-on-surface-variant italic">Cố định (${formatVND(room.fixedUtilities)})</span>`;
                                                totalCalcText = `<span class="text-on-surface-variant italic">-</span>`;
                                            }
                                        } else {
                                            if (logged) {
                                                statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32]">Đã nhập tiền</span>`;
                                                actionHTML = `
                                                    <button class="text-outline-variant cursor-not-allowed p-1" disabled title="Đã ghi nhận hóa đơn">
                                                        <span class="material-symbols-outlined text-[20px]">check_circle</span>
                                                    </button>
                                                `;
                                                utilityText = `<span class="font-bold text-primary">${formatVND(logged.utilityCost)}</span>`;
                                                totalCalcText = invoice ? `<span class="font-bold">${formatVND(invoice.total)}</span>` : `<span class="text-on-surface-variant italic">-</span>`;
                                            } else {
                                                statusChip = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed">Chờ chốt tiền</span>`;
                                                actionHTML = `
                                                    <button class="record-btn text-primary hover:bg-primary-fixed/30 p-1.5 rounded-md transition-colors" data-id="${room.id}" title="Nhập tiền điện nước & xuất hóa đơn">
                                                        <span class="material-symbols-outlined text-[20px]">edit_document</span>
                                                    </button>
                                                `;
                                                utilityText = `<span class="text-on-surface-variant italic">Chờ nhập</span>`;
                                                totalCalcText = `<span class="text-on-surface-variant italic">-</span>`;
                                            }
                                        }

                                        return `
                                            <tr class="hover:bg-surface-container-lowest transition-colors bg-surface-bright">
                                                <td class="p-md font-semibold text-primary cursor-pointer hover:underline" onclick="window.navigateTo('roomDetail', { roomId: '${room.id}' })">${room.id}</td>
                                                <td class="p-md font-medium">${room.tenant.name}</td>
                                                <td class="p-md">${utilityText}</td>
                                                <td class="p-md">${totalCalcText}</td>
                                                <td class="p-md">${statusChip}</td>
                                                <td class="p-md text-center">${actionHTML}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Bắt sự kiện nút chốt số
            dom.querySelectorAll('.record-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const roomId = e.currentTarget.getAttribute('data-id');
                    window.QuinnViews.showRecordUtilityModal(roomId);
                });
            });

            return dom;
        },

        // 7. Màn hình Cài đặt đơn giá & dịch vụ (Settings)
        renderSettings: function () {
            const settings = window.QuinnState.getSettings();

            const html = `
                <div>
                    <!-- Header -->
                    <div class="mb-lg">
                        <h2 class="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">Cài đặt đơn giá & Dịch vụ</h2>
                        <p class="font-body-md text-body-md text-on-surface-variant mt-1">Cấu hình bảng giá chuẩn áp dụng khi tính hóa đơn.</p>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                        <!-- Left Column (Utilities Settings) -->
                        <form id="settings-form" class="lg:col-span-3 space-y-lg">
                            <!-- Điện & Nước Info Card -->
                            <div class="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant overflow-hidden hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200">
                                <div class="px-container-margin py-md border-b border-surface-variant bg-surface flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-[#E3F2FD] flex items-center justify-center text-[#1976D2]">
                                        <span class="material-symbols-outlined">bolt</span>
                                    </div>
                                    <h3 class="font-title-lg text-title-lg font-semibold text-primary">Cấu hình Điện & Nước</h3>
                                </div>
                                <div class="p-container-margin space-y-md">
                                    <div class="p-4 bg-primary/5 border border-primary/20 rounded-lg flex gap-3">
                                        <span class="material-symbols-outlined text-primary text-2xl flex-shrink-0">info</span>
                                        <div>
                                            <p class="font-semibold text-on-surface">Phương thức ghi nhận trực tiếp</p>
                                            <p class="text-sm text-on-surface-variant mt-1">
                                                Hệ thống áp dụng ghi nhận tiền điện nước bằng cách nhập trực tiếp số tiền tổng hàng tháng cho từng phòng hoặc áp dụng phí cố định trong chi tiết phòng. Không sử dụng đơn giá để tự động tính toán. Do đó, các cấu hình đơn giá điện/nước riêng lẻ đã được đơn giản hóa.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Buttons -->
                            <div class="flex justify-end gap-md pt-4">
                                <button type="button" class="px-6 py-2.5 rounded-lg border border-primary text-primary font-label-md text-label-md font-semibold hover:bg-primary-fixed/30 transition-colors" onclick="window.navigateTo('dashboard')">
                                    Hủy bỏ
                                </button>
                                <button type="submit" class="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-md hover:bg-primary-container transition-colors flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[18px]">save</span>
                                    Lưu thay đổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            const dom = parseHTML(html);

            // Bắt sự kiện submit form để lưu cài đặt
            dom.querySelector('#settings-form').addEventListener('submit', (e) => {
                e.preventDefault();

                window.QuinnState.updateSettings(
                    settings.dienGia,
                    settings.dienMethod,
                    settings.nuocGia,
                    settings.nuocMethod,
                    []
                );
                alert('Đã lưu thay đổi cấu hình thành công!');
                window.navigateTo('dashboard');
            });

            return dom;
        },

        // Modal 1: Nhập chỉ số điện nước chốt số cho phòng
        showRecordUtilityModal: function (roomId) {
            const room = window.QuinnState.getRoomById(roomId);
            if (!room) return;

            const period = window.QuinnState.getCurrentPeriod();

            let contentHTML = '';
            if (room.fixedUtilities) {
                contentHTML = `
                    <div class="space-y-4">
                        <p class="text-sm text-on-surface-variant">Ghi nhận hóa đơn cho <strong>phòng ${roomId}</strong> (Khách thuê: ${room.tenant.name}) - Kỳ <strong>${period}</strong>.</p>
                        <div class="bg-surface-container-low p-4 border border-outline-variant rounded-lg">
                            <p class="font-semibold text-primary text-base">Phí điện nước cố định hàng tháng:</p>
                            <p class="text-2xl font-bold text-on-surface mt-2">${formatVND(room.fixedUtilities)}</p>
                            <p class="text-xs text-on-surface-variant mt-1">Phí thuê phòng: 0 đ (Miễn phí)</p>
                        </div>
                        <p class="text-xs text-on-surface-variant italic">Nhấn "Đồng ý" để xác nhận tạo hóa đơn mà không cần ghi số.</p>
                    </div>
                `;
            } else {
                contentHTML = `
                    <div class="space-y-4">
                        <p class="text-sm text-on-surface-variant">Ghi nhận tiền điện nước tháng này cho <strong>phòng ${roomId}</strong> (Khách thuê: ${room.tenant.name}) - Kỳ <strong>${period}</strong>.</p>
                        
                        <div class="flex flex-col gap-2">
                            <label class="text-xs font-semibold text-primary" for="utility-cost">Tiền điện nước tháng này (đ)</label>
                            <input id="utility-cost" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" placeholder="Ví dụ: 450000" value="${room.utilities.utilityCost || ''}" required />
                        </div>
                    </div>
                `;
            }

            createModal('Ghi nhận điện nước phòng ' + roomId, contentHTML, (modalEl) => {
                let utilityCostVal = 0;

                if (!room.fixedUtilities) {
                    utilityCostVal = Number(modalEl.querySelector('#utility-cost').value);

                    if (isNaN(utilityCostVal) || utilityCostVal < 0) {
                        alert('Tiền điện nước nhập vào không hợp lệ!');
                        return false;
                    }
                }

                const invoice = window.QuinnState.recordUtilities(roomId, utilityCostVal, period);
                if (invoice) {
                    alert(`Đã chốt tiền điện nước phòng ${roomId} thành công!\nHóa đơn ${invoice.id} với tổng số tiền ${invoice.total.toLocaleString('vi-VN')} đ đã được tạo.`);
                    // Quay về view cũ (Utilities hoặc roomDetail)
                    window.navigateTo('utilities');
                    return true;
                }
                return false;
            });
        },

        // Modal 2: Thêm khách thuê mới (Nhận phòng & Làm hợp đồng)
        showAddTenantModal: function (roomId) {
            const room = window.QuinnState.getRoomById(roomId);
            if (!room) return;

            const todayStr = window.QuinnState.getVietnamDateString();
            const nextYearStr = window.QuinnState.getVietnamDatePlusYears(1);

            const contentHTML = `
                <div class="space-y-4">
                    <p class="text-sm text-on-surface-variant">Thực hiện ký hợp đồng và giao phòng <strong>${roomId}</strong> (Giá: ${room.price.toLocaleString('vi-VN')} đ/tháng).</p>
                    
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-semibold text-primary" for="tenant-name">Họ và tên khách thuê</label>
                        <input id="tenant-name" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="text" placeholder="Nguyễn Văn A" required />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="tenant-phone">Số điện thoại</label>
                            <input id="tenant-phone" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="text" placeholder="0901234567" required />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="vehicles-count">Số lượng xe máy</label>
                            <input id="vehicles-count" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="0" value="1" required />
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="start-date">Ngày bắt đầu hợp đồng</label>
                            <input id="start-date" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="text" value="${todayStr}" placeholder="dd/mm/yyyy" required />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="end-date">Ngày kết thúc</label>
                            <input id="end-date" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="text" value="${nextYearStr}" placeholder="dd/mm/yyyy" required />
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="occupants-count">Số người ở</label>
                            <input id="occupants-count" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="1" max="${room.maxOccupants}" value="1" required />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="deposit-amount">Số tiền cọc đặt trước</label>
                            <input id="deposit-amount" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="0" value="${room.price}" required />
                        </div>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-semibold text-primary" for="payment-day">Ngày thu tiền hàng tháng (Ví dụ: Mùng 15, Mùng 5 -> 7)</label>
                        <input id="payment-day" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="text" placeholder="Mùng 15" value="Mùng 15" required />
                    </div>
                </div>
            `;

            createModal('Đăng ký khách thuê phòng ' + roomId, contentHTML, (modalEl) => {
                const name = modalEl.querySelector('#tenant-name').value.trim();
                const phone = modalEl.querySelector('#tenant-phone').value.trim();
                const vehicles = modalEl.querySelector('#vehicles-count').value;
                const startDate = modalEl.querySelector('#start-date').value.trim();
                const endDate = modalEl.querySelector('#end-date').value.trim();
                const occupants = modalEl.querySelector('#occupants-count').value;
                const deposit = modalEl.querySelector('#deposit-amount').value;
                const paymentDay = modalEl.querySelector('#payment-day').value.trim();

                if (!name || !phone || !startDate || !endDate || !paymentDay) {
                    alert('Vui lòng điền đầy đủ các thông tin!');
                    return false;
                }

                window.QuinnState.addTenant(roomId, name, phone, startDate, endDate, occupants, deposit, vehicles, paymentDay);
                alert(`Đã làm hợp đồng và bàn giao phòng ${roomId} cho khách thuê ${name} thành công!`);
                window.navigateTo('roomDetail', { roomId: roomId });
                return true;
            });
        },

        // Modal 3: Thêm phòng mới
        showAddRoomModal: function () {
            const contentHTML = `
                <div class="space-y-4">
                    <p class="text-sm text-on-surface-variant">Tạo một căn phòng trọ mới vào danh sách quản lý.</p>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="room-id">Mã phòng (Ví dụ: QH11)</label>
                            <input id="room-id" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="text" placeholder="QH11" required />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="room-floor">Tầng</label>
                            <input id="room-floor" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="1" value="1" required />
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="room-price">Giá thuê hàng tháng</label>
                            <input id="room-price" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="0" value="3500000" required />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="room-size">Diện tích (m²)</label>
                            <input id="room-size" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="0" value="25" required />
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs font-semibold text-primary" for="room-max">Số người tối đa</label>
                            <input id="room-max" class="w-full border border-outline-variant rounded py-2 px-3 outline-none focus:border-primary" type="number" min="1" value="3" required />
                        </div>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-semibold text-on-surface-variant">Tiện nghi có sẵn</label>
                        <div class="grid grid-cols-2 gap-2 mt-1">
                            <label class="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" name="furniture-check" value="Giường ngủ" checked class="rounded border-outline-variant text-primary" />
                                <span>Giường ngủ</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" name="furniture-check" value="Tủ quần áo" checked class="rounded border-outline-variant text-primary" />
                                <span>Tủ quần áo</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" name="furniture-check" value="Điều hòa" class="rounded border-outline-variant text-primary" />
                                <span>Điều hòa</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" name="furniture-check" value="Tủ lạnh" class="rounded border-outline-variant text-primary" />
                                <span>Tủ lạnh</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" name="furniture-check" value="Ban công" class="rounded border-outline-variant text-primary" />
                                <span>Ban công</span>
                            </label>
                        </div>
                    </div>
                </div>
            `;

            createModal('Thêm phòng mới', contentHTML, (modalEl) => {
                const id = modalEl.querySelector('#room-id').value.trim().toUpperCase();
                const floor = modalEl.querySelector('#room-floor').value;
                const price = modalEl.querySelector('#room-price').value;
                const size = modalEl.querySelector('#room-size').value;
                const max = modalEl.querySelector('#room-max').value;

                if (!id) {
                    alert('Vui lòng điền mã phòng!');
                    return false;
                }

                // Kiểm tra xem phòng đã tồn tại chưa
                const existing = window.QuinnState.getRoomById(id);
                if (existing) {
                    alert('Mã phòng này đã tồn tại trong hệ thống!');
                    return false;
                }

                // Lấy các tiện nghi đã chọn
                const furniture = [];
                modalEl.querySelectorAll('input[name="furniture-check"]:checked').forEach(cb => {
                    furniture.push(cb.value);
                });

                window.QuinnState.addRoom({
                    id: id,
                    floor: floor,
                    price: price,
                    size: size,
                    maxOccupants: max,
                    furniture: furniture
                });

                alert(`Đã thêm phòng ${id} thành công!`);
                window.navigateTo('rooms');
                return true;
            });
        }
    };
})();
