// app.js - Khởi chạy và điều phối Router cho Quinn House Management System

(function () {
    // Bản đồ khớp đường dẫn (hash) với tên hàm render trong views.js
    const routes = {
        'dashboard': window.QuinnViews.renderDashboard,
        'rooms': window.QuinnViews.renderRooms,
        'roomDetail': window.QuinnViews.renderRoomDetail,
        'payments': window.QuinnViews.renderPayments,
        'contracts': window.QuinnViews.renderContracts,
        'utilities': window.QuinnViews.renderUtilities,
        'settings': window.QuinnViews.renderSettings
    };

    // Phân tích Hash URL thành View Name và Params
    // Ví dụ: #roomDetail?roomId=102  =>  viewName: 'roomDetail', params: { roomId: '102' }
    function parseHash() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        const parts = hash.split('?');
        const viewName = parts[0];
        const params = {};

        if (parts[1]) {
            const queryParams = parts[1].split('&');
            queryParams.forEach(param => {
                const pair = param.split('=');
                params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
            });
        }

        return { viewName, params };
    }

    // Hàm điều hướng chương trình
    window.navigateTo = function (viewName, params = {}) {
        let hash = viewName;
        const query = Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        
        if (query) {
            hash += '?' + query;
        }
        
        window.location.hash = hash;
    };

    // Hàm render chính
    function router() {
        const { viewName, params } = parseHash();
        const renderFunc = routes[viewName] || routes['dashboard'];
        const appContent = document.getElementById('app-content');

        if (!appContent) {
            console.error('Không tìm thấy vùng chứa app-content!');
            return;
        }

        // Thực hiện render view
        appContent.innerHTML = '';
        const viewDOM = renderFunc(params);
        appContent.appendChild(viewDOM);

        // Cập nhật trạng thái active trên Sidebar
        updateSidebarActive(viewName);

        // Cuộn về đầu trang nội dung chính
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Cập nhật class CSS Active của các liên kết trên Sidebar
    function setupRealtimeClock() {
        const clockEl = document.getElementById('vietnam-realtime-clock');
        if (!clockEl || !window.QuinnState) return;

        const updateClock = () => {
            clockEl.textContent = window.QuinnState.getVietnamDateTimeString();
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    function setupRealtimeStateSync() {
        if (!window.QuinnState) return;

        window.addEventListener('storage', (event) => {
            if (event.key !== window.QuinnState.getStorageKey()) return;
            if (!window.QuinnState.refreshFromStorage()) return;
            router();
        });
    }

    function updateSidebarActive(viewName) {
        const sidebar = document.querySelector('aside');
        if (!sidebar) return;

        // Bỏ class active ở tất cả liên kết
        sidebar.querySelectorAll('a').forEach(a => {
            a.className = 'flex items-center gap-3 px-4 py-3 text-on-primary/70 hover:text-on-primary hover:bg-primary-fixed-dim/20 transition-all duration-150 rounded-lg mx-2 font-body-md text-body-md';
            // Khôi phục icon fill của material symbols
            const icon = a.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.style.fontVariationSettings = "'FILL' 0";
            }
        });

        // Tìm liên kết tương ứng với view hiện tại để kích hoạt active
        // Lấy thẻ <a> có thuộc tính data-view khớp với viewName
        const activeLink = sidebar.querySelector(`a[data-view="${viewName}"]`);
        if (activeLink) {
            activeLink.className = 'flex items-center gap-3 px-4 py-3 text-primary bg-secondary-fixed border-l-4 border-tertiary-fixed font-bold opacity-90 transition-all duration-150 rounded-r-lg shadow-sm mx-2 font-body-md text-body-md';
            const icon = activeLink.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.style.fontVariationSettings = "'FILL' 1";
            }
        }
    }

    // Thiết lập ứng dụng khi tải trang hoàn tất
    window.addEventListener('DOMContentLoaded', () => {
        // Gán sự kiện click cho các thẻ điều hướng trên Sidebar
        const sidebar = document.querySelector('aside');
        if (sidebar) {
            sidebar.querySelectorAll('a[data-view]').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    const view = e.currentTarget.getAttribute('data-view');
                    window.navigateTo(view);

                    // Đóng sidebar trên mobile sau khi click (nếu hiển thị)
                    const aside = document.querySelector('aside');
                    if (aside && !aside.classList.contains('hidden')) {
                        aside.classList.add('hidden-mobile-nav');
                    }
                });
            });
        }

        // Lọc tìm kiếm nhanh trên TopNavBar
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = e.target.value.trim();
                    if (q) {
                        window.navigateTo('rooms');
                        // Thiết lập từ khóa tìm kiếm sau khi chuyển sang view rooms
                        setTimeout(() => {
                            const roomsSearch = document.getElementById('search-input');
                            if (roomsSearch) {
                                roomsSearch.value = q;
                                roomsSearch.dispatchEvent(new Event('input'));
                            }
                        }, 50);
                    }
                }
            });
        }

        // Xử lý nút bật/tắt Sidebar trên điện thoại di động
        const menuToggleBtn = document.getElementById('menu-toggle-btn');
        const sidebarAside = document.querySelector('aside');
        if (menuToggleBtn && sidebarAside) {
            menuToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebarAside.classList.contains('hidden-mobile-nav')) {
                    sidebarAside.classList.remove('hidden-mobile-nav');
                } else {
                    sidebarAside.classList.add('hidden-mobile-nav');
                }
            });

            // Click ra ngoài đóng sidebar mobile
            document.addEventListener('click', () => {
                sidebarAside.classList.add('hidden-mobile-nav');
            });
            sidebarAside.addEventListener('click', (e) => {
                e.stopPropagation(); // không đóng khi click trong sidebar
            });
        }

        // Lắng nghe thay đổi hash để chuyển trang động
        window.addEventListener('hashchange', router);

        setupRealtimeClock();
        setupRealtimeStateSync();

        // Khởi chạy router lần đầu tiên
        router();
    });
})();
