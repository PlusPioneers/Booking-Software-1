/**
 * Utility functions for common operations
 */
const Utils = {
    // Date and time formatting
    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatTime(time) {
        if (!time) return 'N/A';
        try {
            return new Date(`2000-01-01 ${time}`).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            return time;
        }
    },

    formatDateTime(date, time) {
        return `${this.formatDate(date)} at ${this.formatTime(time)}`;
    },

    // Get relative time (e.g., "2 hours ago")
    getRelativeTime(date) {
        const now = new Date();
        const targetDate = new Date(date);
        const diffInSeconds = Math.floor((now - targetDate) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return this.formatDate(date);
    },

    // Form validation
    validateEmail(email) {
        if (!email) return true; // Email is optional in most cases
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePhone(phone) {
        if (!phone) return false;
        const re = /^[\+]?[1-9][\d]{0,15}$/;
        return re.test(phone.replace(/[\s\-\(\)]/g, ''));
    },

    validateRequired(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },

    // Form data helpers
    getFormData(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            // Handle checkboxes
            if (form.querySelector(`[name="${key}"]`).type === 'checkbox') {
                data[key] = form.querySelector(`[name="${key}"]`).checked;
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },

    setFormData(form, data) {
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = data[key];
                } else if (field.type === 'radio') {
                    const radioOption = form.querySelector(`[name="${key}"][value="${data[key]}"]`);
                    if (radioOption) radioOption.checked = true;
                } else {
                    field.value = data[key] || '';
                }
            }
        });
    },

    // Loading states
    setLoading(element, isLoading, originalText) {
        if (!element) return;
        
        if (isLoading) {
            element.disabled = true;
            element.setAttribute('data-original-text', originalText || element.textContent);
            element.innerHTML = '<span class="spinner"></span> Loading...';
            element.classList.add('loading');
        } else {
            element.disabled = false;
            element.innerHTML = element.getAttribute('data-original-text') || 'Submit';
            element.classList.remove('loading');
        }
    },

    // Button state management
    setButtonState(button, state, text) {
        if (!button) return;
        
        button.disabled = state === 'disabled' || state === 'loading';
        
        switch (state) {
            case 'loading':
                button.innerHTML = '<span class="spinner"></span> Loading...';
                break;
            case 'success':
                button.innerHTML = '✓ ' + (text || 'Success');
                button.classList.add('success-btn');
                break;
            case 'error':
                button.innerHTML = '✗ ' + (text || 'Error');
                button.classList.add('error-btn');
                break;
            default:
                button.innerHTML = text || button.getAttribute('data-original-text') || 'Submit';
                button.classList.remove('success-btn', 'error-btn');
        }
    },

    // Alert/notification system
    showAlert(message, type = 'info', container = document.body, duration = 5000) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <span class="alert-message">${message}</span>
            <button class="close-btn" onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
        `;
        
        // Insert at the top of the container
        if (container === document.body) {
            // For body, create a fixed notification area
            let notificationArea = document.getElementById('notification-area');
            if (!notificationArea) {
                notificationArea = document.createElement('div');
                notificationArea.id = 'notification-area';
                notificationArea.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 400px;
                `;
                document.body.appendChild(notificationArea);
            }
            notificationArea.appendChild(alertDiv);
        } else {
            container.insertBefore(alertDiv, container.firstChild);
        }
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.style.opacity = '0';
                    alertDiv.style.transform = 'translateX(100%)';
                    setTimeout(() => alertDiv.remove(), 300);
                }
            }, duration);
        }
        
        return alertDiv;
    },

    showError(message, container, duration) {
        return this.showAlert(message, 'error', container, duration);
    },

    showSuccess(message, container, duration) {
        return this.showAlert(message, 'success', container, duration);
    },

    showWarning(message, container, duration) {
        return this.showAlert(message, 'warning', container, duration);
    },

    showInfo(message, container, duration) {
        return this.showAlert(message, 'info', container, duration);
    },

    // Local storage helpers
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.warn('Failed to save to localStorage:', error);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('Failed to read from localStorage:', error);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('Failed to remove from localStorage:', error);
                return false;
            }
        },

        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
                return false;
            }
        }
    },

    // DOM manipulation helpers
    createElement(tag, className, innerHTML) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    },

    show(element) {
        if (element) {
            element.style.display = 'block';
            element.classList.remove('hidden');
        }
    },

    hide(element) {
        if (element) {
            element.style.display = 'none';
            element.classList.add('hidden');
        }
    },

    toggle(element) {
        if (element) {
            if (element.style.display === 'none' || element.classList.contains('hidden')) {
                this.show(element);
            } else {
                this.hide(element);
            }
        }
    },

    // Animation helpers
    fadeIn(element, duration = 300) {
        if (!element) return;
        
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        function animate(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    },

    fadeOut(element, duration = 300) {
        if (!element) return;
        
        const start = performance.now();
        const initialOpacity = parseFloat(window.getComputedStyle(element).opacity) || 1;
        
        function animate(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = initialOpacity * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        }
        
        requestAnimationFrame(animate);
    },

    // Debounce function for search inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function for scroll events
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Copied to clipboard!');
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showError('Failed to copy to clipboard');
            return false;
        }
    },

    // Download data as file
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    // Export table data to CSV
    exportTableToCSV(table, filename = 'data.csv') {
        const rows = Array.from(table.querySelectorAll('tr'));
        const csv = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => {
                let content = cell.textContent.trim();
                // Escape quotes and wrap in quotes if necessary
                if (content.includes(',') || content.includes('"') || content.includes('\n')) {
                    content = '"' + content.replace(/"/g, '""') + '"';
                }
                return content;
            }).join(',');
        }).join('\n');
        
        this.downloadFile(csv, filename, 'text/csv');
    },

    // URL helpers
    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (let [key, value] of params) {
            result[key] = value;
        }
        return result;
    },

    setQueryParams(params) {
        const url = new URL(window.location);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.replaceState({}, '', url);
    },

    // Device detection
    isMobile() {
        return window.innerWidth <= 768;
    },

    isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    },

    isDesktop() {
        return window.innerWidth > 1024;
    },

    // Scroll helpers
    scrollToTop(smooth = true) {
        window.scrollTo({
            top: 0,
            behavior: smooth ? 'smooth' : 'auto'
        });
    },

    scrollToElement(element, offset = 0, smooth = true) {
        if (!element) return;
        
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }
};

// Make Utils available globally
window.Utils = Utils;

// Add some global event listeners for common functionality
document.addEventListener('DOMContentLoaded', () => {
    // Auto-focus first input in forms
    const firstInput = document.querySelector('form input:not([type="hidden"]):not([readonly])');
    if (firstInput) {
        firstInput.focus();
    }
    
    // Handle escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            }
        }
    });
    
    // Handle clicks outside modals to close them
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });
});
