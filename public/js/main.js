/**
 * Main Application Controller
 */
class App {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        this.eventListeners = [];
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Initialize core systems
            await this.initializeCore();
            
            // Setup global event listeners
            this.setupGlobalEventListeners();
            
            // Initialize page-specific components
            this.initializePageComponents();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeCore() {
        // Test API connection
        const connectionTest = await window.apiClient.testConnection();
        if (!connectionTest.success) {
            throw new Error('API connection failed');
        }

        // Initialize cache manager
        if (window.CacheManager) {
            window.cacheManager = new CacheManager();
        }

        // Setup error handling
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        window.addEventListener('error', this.handleGlobalError.bind(this));
    }

    setupGlobalEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        
        // Network status monitoring
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Visibility change handling
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Scroll-based optimizations
        window.addEventListener('scroll', Utils.throttle(this.handleScroll.bind(this), 100));
        
        // Resize handling
        window.addEventListener('resize', Utils.debounce(this.handleResize.bind(this), 250));
    }

    initializePageComponents() {
        const path = window.location.pathname;
        
        // Initialize components based on current page
        if (path === '/' || path.includes('booking')) {
            this.initializeBookingPage();
        } else if (path.includes('admin')) {
            this.initializeAdminPage();
        }
    }

    initializeBookingPage() {
        // Booking widget should already be initialized
        // Add any additional booking-specific functionality here
        
        // Auto-save form data
        this.setupFormAutoSave();
        
        // Analytics tracking
        this.trackPageView('booking');
    }

    initializeAdminPage() {
        // Admin dashboard should already be initialized
        // Add any additional admin-specific functionality here
        
        // Auto-refresh data
        this.setupAutoRefresh();
        
        // Analytics tracking
        this.trackPageView('admin');
    }

    setupFormAutoSave() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('input', Utils.debounce(() => {
                    this.saveFormData(form);
                }, 1000));
            });
        });
    }

    saveFormData(form) {
        const formId = form.id || 'default-form';
        const formData = Utils.getFormData(form);
        Utils.storage.set(`form-data-${formId}`, formData);
    }

    restoreFormData(form) {
        const formId = form.id || 'default-form';
        const savedData = Utils.storage.get(`form-data-${formId}`);
        if (savedData) {
            Utils.setFormData(form, savedData);
        }
    }

    setupAutoRefresh() {
        // Refresh data every 5 minutes when page is visible
        setInterval(() => {
            if (document.visibilityState === 'visible' && window.adminDashboard) {
                window.adminDashboard.refreshData();
            }
        }, 5 * 60 * 1000);
    }

    setupPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            if ('performance' in window) {
                const perfData = performance.getEntriesByType('navigation')[0];
                console.log('Page load time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
            }
        });

        // Monitor memory usage (if supported)
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
                    console.warn('High memory usage detected');
                }
            }, 30000);
        }
    }

    handleKeyboardShortcuts(event) {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        
        // Global shortcuts
        if (isCtrlOrCmd) {
            switch (event.key.toLowerCase()) {
                case 'k':
                    event.preventDefault();
                    this.focusSearch();
                    break;
                case '/':
                    event.preventDefault();
                    this.showHelpModal();
                    break;
                case 'r':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.hardRefresh();
                    }
                    break;
            }
        }

        // Escape key handlers
        if (event.key === 'Escape') {
            this.closeActiveModals();
        }
    }

    focusSearch() {
        const searchInputs = [
            '#search-bookings',
            '.search-input',
            'input[type="search"]'
        ];

        for (const selector of searchInputs) {
            const input = document.querySelector(selector);
            if (input && input.offsetParent !== null) {
                input.focus();
                break;
            }
        }
    }

    closeActiveModals() {
        const activeModals = document.querySelectorAll('.modal-overlay.active');
        activeModals.forEach(modal => {
            modal.classList.remove('active');
        });
    }

    showHelpModal() {
        const helpModal = document.createElement('div');
        helpModal.className = 'modal-overlay active';
        helpModal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-list">
                        <div class="shortcut-item">
                            <kbd>Ctrl/Cmd + K</kbd>
                            <span>Focus search</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl/Cmd + /</kbd>
                            <span>Show this help</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Escape</kbd>
                            <span>Close modals</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl/Cmd + Shift + R</kbd>
                            <span>Hard refresh</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(helpModal);
    }

    hardRefresh() {
        // Clear all caches and reload
        if (window.cacheManager) {
            window.cacheManager.clear();
        }
        window.apiClient.clearCache();
        localStorage.clear();
        location.reload(true);
    }

    handleOnline() {
        Utils.showSuccess('Connection restored!', null, 3000);
        this.syncOfflineData();
    }

    handleOffline() {
        Utils.showWarning('You are currently offline. Some features may not work.', null, 0);
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Page became visible, refresh data if needed
            this.refreshDataIfStale();
        }
    }

    handleScroll() {
        // Implement scroll-based optimizations
        const scrollTop = window.pageYOffset;
        
        // Show/hide scroll-to-top button
        const scrollButton = document.getElementById('scroll-to-top');
        if (scrollButton) {
            scrollButton.style.display = scrollTop > 300 ? 'block' : 'none';
        }
    }

    handleResize() {
        // Handle responsive breakpoint changes
        const isMobile = Utils.isMobile();
        const isTablet = Utils.isTablet();
        
        document.body.classList.toggle('mobile', isMobile);
        document.body.classList.toggle('tablet', isTablet);
        document.body.classList.toggle('desktop', !isMobile && !isTablet);
    }

    async syncOfflineData() {
        // Implement offline data synchronization
        const offlineData = Utils.storage.get('offline-queue', []);
        
        if (offlineData.length > 0) {
            Utils.showInfo('Syncing offline data...');
            
            for (const item of offlineData) {
                try {
                    await this.processOfflineItem(item);
                } catch (error) {
                    console.error('Failed to sync offline item:', error);
                }
            }
            
            Utils.storage.remove('offline-queue');
            Utils.showSuccess('Offline data synced successfully!');
        }
    }

    async processOfflineItem(item) {
        // Process individual offline queue items
        switch (item.type) {
            case 'booking':
                return await window.apiClient.createBooking(item.data);
            case 'doctor-update':
                return await window.apiClient.updateDoctor(item.id, item.data);
            default:
                console.warn('Unknown offline item type:', item.type);
        }
    }

    refreshDataIfStale() {
        const lastRefresh = Utils.storage.get('last-data-refresh', 0);
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        
        if (Date.now() - lastRefresh > staleThreshold) {
            this.refreshAllData();
        }
    }

    async refreshAllData() {
        try {
            // Clear API cache
            window.apiClient.clearCache();
            
            // Refresh current page data
            if (window.bookingWidget) {
                await window.bookingWidget.loadDoctors();
            }
            
            if (window.adminDashboard) {
                await window.adminDashboard.refreshData();
            }
            
            Utils.storage.set('last-data-refresh', Date.now());
            
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }

    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Don't show errors for network issues in offline mode
        if (!navigator.onLine) return;
        
        // Show user-friendly error message
        Utils.showError('Something went wrong. Please try refreshing the page.');
        
        // Track error for debugging
        this.trackError('unhandled-rejection', event.reason);
    }

    handleGlobalError(event) {
        console.error('Global error:', event.error);
        
        // Show user-friendly error message
        Utils.showError('An unexpected error occurred. Please refresh the page.');
        
        // Track error for debugging
        this.trackError('global-error', event.error);
    }

    handleInitializationError(error) {
        document.body.innerHTML = `
            <div class="error-state" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 2rem;
                text-align: center;
                background: var(--gray-50);
            ">
                <h1 style="color: var(--error-color); margin-bottom: 1rem;">
                    Failed to Load Application
                </h1>
                <p style="margin-bottom: 2rem; color: var(--gray-600);">
                    There was a problem loading the application. Please check your connection and try again.
                </p>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
                    <button onclick="location.reload()" class="btn primary-btn">
                        Refresh Page
                    </button>
                    <button onclick="localStorage.clear(); location.reload()" class="btn secondary-btn">
                        Clear Data & Refresh
                    </button>
                </div>
                <details style="margin-top: 2rem; max-width: 600px;">
                    <summary style="cursor: pointer; color: var(--gray-500);">
                        Technical Details
                    </summary>
                    <pre style="
                        background: var(--gray-100);
                        padding: 1rem;
                        border-radius: 4px;
                        text-align: left;
                        font-size: 0.8rem;
                        margin-top: 1rem;
                        overflow: auto;
                    ">${error.stack || error.message}</pre>
                </details>
            </div>
        `;
    }

    trackPageView(page) {
        // Implement analytics tracking
        console.log('Page view:', page);
        
        // Example: Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                page_title: page,
                page_location: window.location.href
            });
        }
    }

    trackError(type, error) {
        // Implement error tracking
        console.log('Error tracked:', type, error);
        
        // Example: Send to error tracking service
        if (typeof gtag !== 'undefined') {
            gtag('event', 'exception', {
                description: `${type}: ${error.message || error}`,
                fatal: false
            });
        }
    }

    // Public API methods
    showNotification(message, type = 'info', duration = 5000) {
        return Utils.showAlert(message, type, document.body, duration);
    }

    clearAllCaches() {
        if (window.cacheManager) {
            window.cacheManager.clear();
        }
        window.apiClient.clearCache();
        Utils.storage.clear();
    }

    getAppStatus() {
        return {
            initialized: this.isInitialized,
            online: navigator.onLine,
            components: Object.keys(this.components),
            cacheStats: window.cacheManager ? window.cacheManager.getStats() : null
        };
    }
}

// Initialize application
window.app = new App();

// Add scroll to top button
document.addEventListener('DOMContentLoaded', () => {
    const scrollButton = document.createElement('button');
    scrollButton.id = 'scroll-to-top';
    scrollButton.innerHTML = '↑';
    scrollButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary-color);
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        display: none;
        z-index: 1000;
        box-shadow: var(--box-shadow-lg);
        transition: var(--transition);
    `;
    
    scrollButton.addEventListener('click', () => {
        Utils.scrollToTop();
    });
    
    document.body.appendChild(scrollButton);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
