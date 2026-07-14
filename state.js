// state.js - Quản lý trạng thái và dữ liệu giả lập cho Quinn House (Đã cập nhật dữ liệu thật)

(function () {
    const STORAGE_KEY = 'QuinnHouseState';
    const DB_VERSION = 'v6_clean';
    const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
    const PAYMENT_DAY_BY_ROOM = {
        '102': 'Ngày 18',
        '103': 'Ngày 5 -> 7',
        '201': 'Ngày 8',
        '202': 'Ngày 7 -> 9',
        '203': 'Ngày 1',
        '301': 'Ngày 15',
        '302': 'Ngày 10',
        '303': 'Ngày 23',
        'Gác mái': 'Ngày 15'
    };

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function getVietnamParts(date = new Date()) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: VIETNAM_TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).formatToParts(date);

        return parts.reduce((acc, part) => {
            if (part.type !== 'literal') {
                acc[part.type] = part.value;
            }
            return acc;
        }, {});
    }

    function getVietnamDateString(date = new Date()) {
        const parts = getVietnamParts(date);
        return `${parts.day}/${parts.month}/${parts.year}`;
    }

    function getVietnamDateTimeString(date = new Date()) {
        const parts = getVietnamParts(date);
        return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
    }

    function getVietnamDatePlusYears(years) {
        const parts = getVietnamParts();
        return `${parts.day}/${parts.month}/${Number(parts.year) + years}`;
    }

    function getRecentPeriods(count) {
        const parts = getVietnamParts();
        const monthIndex = Number(parts.month) - 1;
        const year = Number(parts.year);
        const periods = [];

        for (let offset = count - 1; offset >= 0; offset--) {
            const absoluteMonth = year * 12 + monthIndex - offset;
            const periodYear = Math.floor(absoluteMonth / 12);
            const periodMonthIndex = ((absoluteMonth % 12) + 12) % 12;
            const periodMonth = periodMonthIndex + 1;

            periods.push({
                label: `Thg ${periodMonth}`,
                periodKey: `Tháng ${pad2(periodMonth)}/${periodYear}`,
                year: periodYear,
                month: periodMonth,
                isCurrent: offset === 0
            });
        }

        return periods;
    }

    function getVietnamDateEpoch(dateString) {
        const parts = dateString.split('/');
        if (parts.length !== 3) return null;

        const day = Number(parts[0]);
        const month = Number(parts[1]);
        const year = Number(parts[2]);

        if (!day || !month || !year) return null;
        return Date.UTC(year, month - 1, day);
    }

    function reloadStateFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                state = JSON.parse(stored);
                return true;
            }
        } catch (e) {
            console.error('KhÃ´ng thá»ƒ refresh state tá»« LocalStorage:', e);
        }
        return false;
    }

    function getCurrentPeriod() {
        const parts = getVietnamParts();
        return `Tháng ${parts.month}/${parts.year}`;
    }

    // Dữ liệu thật từ 2 file tài liệu của khách hàng
    const initialData = {
        version: DB_VERSION,
        settings: {
            dienGia: 3500,
            dienMethod: 'Theo đồng hồ',
            nuocGia: 25000,
            nuocMethod: 'Theo khối (m³)',
            services: []
        },
        rooms: [
            {
                id: '101',
                title: 'Phòng 101',
                floor: 1,
                price: 0,
                size: 25,
                status: 'rented',
                occupants: 2,
                maxOccupants: 3,
                deposit: 0,
                paymentDay: 'Mùng 1',
                fixedUtilities: 1000000,
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Điều hòa'],
                tenant: {
                    name: 'Mộng Tuyền & Quốc Việt',
                    phone: '0327868787 / 0981012420',
                    startDate: '01/08/2023',
                    endDate: '01/08/2026',
                    vehicles: 2
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '102',
                title: 'Phòng 102',
                floor: 1,
                price: 2200000,
                size: 22,
                status: 'rented',
                occupants: 1,
                maxOccupants: 3,
                deposit: 2200000,
                paymentDay: 'Ngày 18',
                furniture: ['Giường ngủ', 'Tủ quần áo'],
                tenant: {
                    name: 'Huỳnh Công Trình',
                    phone: '0375950260',
                    startDate: '01/08/2023',
                    endDate: '01/08/2024',
                    vehicles: 1
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '103',
                title: 'Phòng 103',
                floor: 1,
                price: 4000000,
                size: 30,
                status: 'rented',
                occupants: 3,
                maxOccupants: 3,
                deposit: 4000000,
                paymentDay: 'Ngày 5 -> 7',
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Điều hòa', 'Tủ lạnh'],
                tenant: {
                    name: 'Lê Nguyễn Tuấn Nguyên, Trà Thị Như Linh, Đoàn Thanh Hậu',
                    phone: 'Không có',
                    startDate: '05/09/2023',
                    endDate: '05/09/2024',
                    vehicles: 0
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '201',
                title: 'Phòng 201',
                floor: 2,
                price: 3000000,
                size: 25,
                status: 'rented',
                occupants: 2,
                maxOccupants: 3,
                deposit: 3000000,
                paymentDay: 'Ngày 8',
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Điều hòa'],
                tenant: {
                    name: 'Dương Thái Sang & Trịnh Tấn Phát',
                    phone: 'Không có',
                    startDate: '08/09/2023',
                    endDate: '08/09/2024',
                    vehicles: 0
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '202',
                title: 'Phòng 202',
                floor: 2,
                price: 2100000,
                size: 22,
                status: 'rented',
                occupants: 1,
                maxOccupants: 2,
                deposit: 2100000,
                paymentDay: 'Ngày 7 -> 9',
                furniture: ['Giường ngủ', 'Tủ quần áo'],
                tenant: {
                    name: 'Lê Trúc Uyên Thy',
                    phone: '0343386764',
                    startDate: '07/09/2023',
                    endDate: '07/09/2024',
                    vehicles: 1
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '203',
                title: 'Phòng 203',
                floor: 2,
                price: 3500000,
                size: 25,
                status: 'rented',
                occupants: 1,
                maxOccupants: 2,
                deposit: 3500000,
                paymentDay: 'Ngày 1',
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Điều hòa', 'Tủ lạnh'],
                tenant: {
                    name: 'Dương Duy Linh',
                    phone: '0329239456',
                    startDate: '01/09/2023',
                    endDate: '01/09/2024',
                    vehicles: 1
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '301',
                title: 'Phòng 301',
                floor: 3,
                price: 3000000,
                size: 26,
                status: 'rented',
                occupants: 2,
                maxOccupants: 3,
                deposit: 3000000,
                paymentDay: 'Ngày 15',
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Điều hòa', 'Tủ lạnh'],
                tenant: {
                    name: 'Trần Thị Diệu Hương & Võ Cao Phát',
                    phone: '0783300212',
                    startDate: '15/09/2023',
                    endDate: '15/09/2024',
                    vehicles: 2
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '302',
                title: 'Phòng 302',
                floor: 3,
                price: 2200000,
                size: 22,
                status: 'rented',
                occupants: 1,
                maxOccupants: 2,
                deposit: 2200000,
                paymentDay: 'Ngày 10',
                furniture: ['Giường ngủ', 'Tủ quần áo'],
                tenant: {
                    name: 'Nguyễn Văn Chương',
                    phone: 'Không có',
                    startDate: '10/09/2023',
                    endDate: '10/09/2024',
                    vehicles: 0
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: '303',
                title: 'Phòng 303',
                floor: 3,
                price: 3000000,
                size: 25,
                status: 'rented',
                occupants: 1,
                maxOccupants: 2,
                deposit: 3000000,
                paymentDay: 'Ngày 23',
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Điều hòa'],
                tenant: {
                    name: 'Bùi Minh Hiếu',
                    phone: '0976597821',
                    startDate: '23/09/2023',
                    endDate: '23/09/2024',
                    vehicles: 1
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            },
            {
                id: 'Gác mái',
                title: 'Gác mái',
                floor: 4,
                price: 2500000,
                size: 24,
                status: 'rented',
                occupants: 2,
                maxOccupants: 2,
                deposit: 2500000,
                paymentDay: 'Ngày 15',
                furniture: ['Giường ngủ', 'Tủ quần áo', 'Quạt máy'],
                tenant: {
                    name: 'Hà Tôn Kim Hồng & Nguyễn Trần Nhật Đan',
                    phone: '0917695839',
                    startDate: '15/09/2023',
                    endDate: '15/09/2024',
                    vehicles: 1
                },
                utilities: { utilityCost: 0 },
                utilityHistory: [],
                maintenanceLogs: []
            }
        ],
        invoices: []
    };

    function applyPaymentDaySchedule(targetState) {
        if (!targetState || !Array.isArray(targetState.rooms)) return false;

        let changed = false;
        targetState.rooms.forEach(room => {
            const paymentDay = PAYMENT_DAY_BY_ROOM[room.id];
            if (paymentDay && room.paymentDay !== paymentDay) {
                room.paymentDay = paymentDay;
                changed = true;
            }
        });

        return changed;
    }

    // Load state từ LocalStorage
    let state = null;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            state = JSON.parse(stored);
            
            // Đồng bộ lại dữ liệu thật nếu cấu trúc bị lỗi hoặc theo yêu cầu
            const r101 = state.rooms.find(r => r.id === '101');
            const needsReset = state.rooms.some(r => r.utilities && ('electricity' in r.utilities || 'electricityCost' in r.utilities || 'waterCost' in r.utilities)) ||
                               state.rooms.some(r => r.utilityHistory && r.utilityHistory.some(h => 'electricityCost' in h || 'waterCost' in h)) ||
                               (state.invoices && state.invoices.some(i => 'electricityCost' in i || 'waterCost' in i));
            if (needsReset || !r101 || r101.price !== 0 || !state.rooms.some(r => r.id === 'Gác mái') || state.version !== DB_VERSION) {
                state = initialData;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }

            if (applyPaymentDaySchedule(state)) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }
        }
    } catch (e) {
        console.error('Không thể load state từ LocalStorage:', e);
    }

    if (!state) {
        state = initialData;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Không thể lưu state ban đầu vào LocalStorage:', e);
        }
    }

    let API_URL = localStorage.getItem('QuinnAPIUrl') || '';
    let API_KEY = localStorage.getItem('QuinnAPIKey') || '';
    let isConnected = false;
    let sseSource = null;

    function getEffectiveAPIUrl() {
        if (API_URL) return API_URL + '/api/v1';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:8080/api/v1';
        }
        return window.location.origin + '/api/v1';
    }

    function getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (API_KEY) {
            headers['X-API-Key'] = API_KEY;
        }
        return headers;
    }

    async function loadStateFromServer() {
        API_URL = localStorage.getItem('QuinnAPIUrl') || '';
        API_KEY = localStorage.getItem('QuinnAPIKey') || '';

        try {
            const url = getEffectiveAPIUrl() + '/snapshot';
            const response = await fetch(url, {
                headers: getHeaders()
            });
            if (response.ok) {
                const resData = await response.json();
                if (resData && resData.data) {
                    state = resData.data;
                    isConnected = true;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                    return true;
                }
            }
        } catch (e) {
            console.warn('Không thể kết nối Backend API, sử dụng LocalStorage làm dự phòng:', e);
        }

        isConnected = false;
        return reloadStateFromStorage();
    }

    function setupRealtimeSSE(onUpdate) {
        if (sseSource) {
            sseSource.close();
            sseSource = null;
        }

        if (!isConnected) return;

        try {
            const baseUrl = getEffectiveAPIUrl().replace(/\/api\/v1$/, '');
            const sseUrl = baseUrl + '/events' + (API_KEY ? `?api_key=${encodeURIComponent(API_KEY)}` : '');
            
            sseSource = new EventSource(sseUrl);
            
            const handleUpdate = async () => {
                console.log('Realtime update detected, reloading state...');
                const success = await loadStateFromServer();
                if (success && typeof onUpdate === 'function') {
                    onUpdate();
                }
            };

            sseSource.addEventListener('state.updated', handleUpdate);
            sseSource.addEventListener('room.updated', handleUpdate);
            sseSource.addEventListener('invoice.updated', handleUpdate);

            sseSource.onerror = (err) => {
                console.warn('Realtime connection error, attempting to reconnect...');
            };
        } catch (e) {
            console.error('Không thể kết nối Realtime SSE:', e);
        }
    }

    async function initAPIConnection() {
        return loadStateFromServer();
    }

    // Hàm lưu trạng thái hiện tại vào LocalStorage và Backend
    async function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            window.dispatchEvent(new CustomEvent('quinn-state-updated'));

            if (isConnected) {
                const url = getEffectiveAPIUrl() + '/sync';
                await fetch(url, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(state)
                });
            }
        } catch (e) {
            console.error('Không thể lưu state:', e);
        }
    }

    // API quản lý trạng thái xuất ra ngoài
    window.QuinnState = {
        loadStateFromServer: loadStateFromServer,
        setupRealtimeSSE: setupRealtimeSSE,
        initAPIConnection: initAPIConnection,
        getCurrentPeriod: getCurrentPeriod,

        getStorageKey: () => STORAGE_KEY,

        getTimeZone: () => VIETNAM_TIME_ZONE,

        getVietnamDateString: getVietnamDateString,

        getVietnamDateTimeString: getVietnamDateTimeString,

        getVietnamDatePlusYears: getVietnamDatePlusYears,

        getRecentPeriods: getRecentPeriods,

        refreshFromStorage: reloadStateFromStorage,

        getSettings: () => state.settings,

        updateSettings: (dienGia, dienMethod, nuocGia, nuocMethod, servicesList) => {
            state.settings.dienGia = Number(dienGia);
            state.settings.dienMethod = dienMethod;
            state.settings.nuocGia = Number(nuocGia);
            state.settings.nuocMethod = nuocMethod;
            if (servicesList) {
                state.settings.services = servicesList;
            }
            saveState();
        },

        getRooms: () => state.rooms,

        getRoomById: (id) => state.rooms.find(r => r.id === id),

        addRoom: (room) => {
            state.rooms.push({
                id: room.id,
                title: 'Phòng ' + room.id,
                floor: Number(room.floor),
                price: Number(room.price),
                size: Number(room.size),
                status: 'vacant',
                occupants: 0,
                maxOccupants: Number(room.maxOccupants) || 3,
                deposit: 0,
                paymentDay: 'Chưa đặt',
                furniture: room.furniture || ['Giường ngủ', 'Tủ quần áo'],
                tenant: null,
                utilities: {
                    utilityCost: Number(room.utilityCost) || 0
                },
                utilityHistory: [],
                maintenanceLogs: []
            });
            saveState();
        },

        addTenant: (roomId, tenantName, phone, startDate, endDate, occupants, deposit, vehicles, paymentDay) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.status = 'rented';
                room.occupants = Number(occupants);
                room.deposit = Number(deposit);
                room.paymentDay = paymentDay || 'Ngày 15';
                room.tenant = {
                    name: tenantName,
                    phone: phone,
                    startDate: startDate,
                    endDate: endDate,
                    vehicles: Number(vehicles) || 1
                };
                saveState();
            }
        },

        updateTenant: (roomId, tenantName, phone, startDate, endDate, occupants, deposit, vehicles, paymentDay) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room && room.tenant) {
                room.occupants = Number(occupants);
                room.deposit = Number(deposit);
                room.paymentDay = paymentDay || 'Ngày 15';
                room.tenant.name = tenantName;
                room.tenant.phone = phone;
                room.tenant.startDate = startDate;
                room.tenant.endDate = endDate;
                room.tenant.vehicles = Number(vehicles) || 1;
                saveState();
            }
        },

        updateRoomStatus: (roomId, status) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.status = status;
                if (status === 'vacant' || status === 'repair') {
                    room.tenant = null;
                    room.occupants = 0;
                    room.deposit = 0;
                    room.paymentDay = 'Trống';
                }
                saveState();
            }
        },

        updateRoomPrice: (roomId, price) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.price = Number(price);
                saveState();
            }
        },

        updateRoomDeposit: (roomId, deposit) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.deposit = Number(deposit);
                saveState();
            }
        },

        updateRoomMaxOccupants: (roomId, maxOccupants) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.maxOccupants = Number(maxOccupants);
                saveState();
            }
        },

        updateRoomFixedUtilities: (roomId, amount) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.fixedUtilities = Number(amount);
                saveState();
            }
        },

        addMaintenanceLog: (roomId, title) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                const newId = room.maintenanceLogs.length > 0 
                    ? Math.max(...room.maintenanceLogs.map(l => l.id)) + 1 
                    : 1;
                
                const dateString = getVietnamDateString();
                
                room.maintenanceLogs.unshift({
                    id: newId,
                    title: title,
                    date: dateString,
                    status: 'Mới'
                });
                saveState();
            }
        },

        recordUtilities: (roomId, utilityCost, period) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (!room || room.status !== 'rented') return null;

            let utilCost = Number(utilityCost) || 0;

            if (room.fixedUtilities) {
                utilCost = room.fixedUtilities;
            }

            room.utilities = {
                utilityCost: utilCost
            };

            const dateString = getVietnamDateString();
            
            room.utilityHistory.unshift({
                period: period,
                utilityCost: utilCost,
                recordedDate: dateString
            });

            let servicesCost = 0;

            const invoiceId = 'INV' + Math.floor(1000 + Math.random() * 9000);
            const newInvoice = {
                id: invoiceId,
                roomId: roomId,
                tenantName: room.tenant.name,
                period: period,
                createdDate: dateString,
                roomPrice: room.price,
                utilityCost: utilCost,
                servicesCost: 0,
                total: room.price + utilCost,
                status: 'Unpaid',
                paymentDate: '',
                details: {
                    vehiclesCount: room.tenant.vehicles || 0
                }
            };

            state.invoices.unshift(newInvoice);
            saveState();
            return newInvoice;
        },

        updateRecordedUtilityCost: (roomId, period, amount) => {
            const room = state.rooms.find(r => r.id === roomId);
            if (room) {
                room.utilities.utilityCost = Number(amount);
                const log = room.utilityHistory.find(h => h.period === period);
                if (log) {
                    log.utilityCost = Number(amount);
                }
                const inv = state.invoices.find(i => i.roomId === roomId && i.period === period);
                if (inv) {
                    inv.utilityCost = Number(amount);
                    inv.total = inv.roomPrice + inv.utilityCost;
                }
                saveState();
            }
        },

        saveState: () => {
            saveState();
        },

        getInvoices: () => state.invoices,

        payInvoice: (invoiceId) => {
            const invoice = state.invoices.find(i => i.id === invoiceId);
            if (invoice) {
                invoice.status = 'Paid';
                invoice.paymentDate = getVietnamDateString();
                saveState();
            }
        },

        updateInvoiceStatus: (invoiceId, status) => {
            const invoice = state.invoices.find(i => i.id === invoiceId);
            if (invoice) {
                invoice.status = status;
                if (status === 'Paid') {
                    invoice.paymentDate = getVietnamDateString();
                } else {
                    invoice.paymentDate = '';
                }
                saveState();
            }
        },

        deleteInvoice: (invoiceId) => {
            state.invoices = state.invoices.filter(i => i.id !== invoiceId);
            saveState();
        },

        getContracts: () => {
            const activeContracts = state.rooms
                .filter(r => r.status === 'rented' && r.tenant)
                .map(r => {
                    let status = 'Active';
                    const endDateEpoch = getVietnamDateEpoch(r.tenant.endDate);
                    if (endDateEpoch !== null) {
                        const todayEpoch = getVietnamDateEpoch(getVietnamDateString());
                        const diffTime = endDateEpoch - todayEpoch;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays <= 30 && diffDays >= 0) {
                            status = 'Expiring';
                        } else if (diffDays < 0) {
                            status = 'Expired';
                        }
                    }

                    return {
                        id: 'CON-' + r.id,
                        roomId: r.id,
                        tenantName: r.tenant.name,
                        startDate: r.tenant.startDate,
                        endDate: r.tenant.endDate,
                        paymentDay: r.paymentDay,
                        deposit: r.deposit,
                        status: status
                    };
                });

            const terminatedContracts = [
                {
                    id: 'CON-302-OLD',
                    roomId: '302',
                    tenantName: 'Lê Văn C',
                    startDate: '10/02/2022',
                    endDate: '10/02/2023',
                    deposit: 2200000,
                    status: 'Terminated'
                }
            ];

            return [...activeContracts, ...terminatedContracts];
        }
    };
})();
