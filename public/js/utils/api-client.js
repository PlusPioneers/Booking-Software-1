/**
 * API Client for handling all server communication
 */
class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.requestQueue = new Map();
    }

    /**
     * Generic request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        // Create request key for deduplication
        const requestKey = `${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || {})}`;
        
        // Check if the same request is already in progress
        if (this.requestQueue.has(requestKey)) {
            return this.requestQueue.get(requestKey);
        }

        const requestPromise = this._makeRequest(url, options);
        
        // Store in queue
        this.requestQueue.set(requestKey, requestPromise);
        
        try {
            const result = await requestPromise;
            return result;
        } finally {
            // Remove from queue when done
            this.requestQueue.delete(requestKey);
        }
    }

    async _makeRequest(url, options) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(
                    errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    errorData
                );
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            
            // Network or other errors
            console.error('API request failed:', error);
            throw new APIError('Network error. Please check your connection.', 0, error);
        }
    }

    /**
     * Cache management
     */
    _getCacheKey(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return `${endpoint}${queryString ? '?' + queryString : ''}`;
    }

    _getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    _setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    _invalidateCache(pattern) {
        for (let key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Doctor endpoints
     */
    async getDoctors() {
        const cacheKey = this._getCacheKey('/doctors');
        const cached = this._getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        const data = await this.request('/doctors');
        this._setCache(cacheKey, data);
        return data;
    }

    async addDoctor(doctorData) {
        const data = await this.request('/doctors', {
            method: 'POST',
            body: JSON.stringify(doctorData)
        });
        
        // Invalidate doctors cache
        this._invalidateCache('/doctors');
        
        return data;
    }

    async updateDoctor(doctorId, doctorData) {
        const data = await this.request(`/doctors/${doctorId}`, {
            method: 'PUT',
            body: JSON.stringify(doctorData)
        });
        
        // Invalidate related caches
        this._invalidateCache('/doctors');
        this._invalidateCache(`/doctors/${doctorId}`);
        
        return data;
    }

    async getDoctorAvailability(doctorId) {
        const cacheKey = this._getCacheKey(`/doctors/${doctorId}/availability`);
        const cached = this._getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        const data = await this.request(`/doctors/${doctorId}/availability`);
        this._setCache(cacheKey, data);
        return data;
    }

    async setDoctorAvailability(doctorId, availability) {
        const data = await this.request(`/doctors/${doctorId}/availability`, {
            method: 'POST',
            body: JSON.stringify({ availability })
        });
        
        // Invalidate availability cache
        this._invalidateCache(`/doctors/${doctorId}/availability`);
        this._invalidateCache(`/doctors/${doctorId}/slots`);
        
        return data;
    }

    async getAvailableSlots(doctorId, date) {
        const cacheKey = this._getCacheKey(`/doctors/${doctorId}/slots/${date}`);
        const cached = this._getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        const data = await this.request(`/doctors/${doctorId}/slots/${date}`);
        this._setCache(cacheKey, data);
        return data;
    }

    /**
     * Booking endpoints
     */
    async createBooking(bookingData) {
        const data = await this.request('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
        
        // Invalidate related caches
        this._invalidateCache('/bookings');
        this._invalidateCache(`/doctors/${bookingData.doctorId}/slots`);
        
        return data;
    }

    async getBookings(filters = {}) {
        const cacheKey = this._getCacheKey('/bookings', filters);
        const cached = this._getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        const queryParams = new URLSearchParams(filters).toString();
        const endpoint = `/bookings${queryParams ? '?' + queryParams : ''}`;
        
        const data = await this.request(endpoint);
        this._setCache(cacheKey, data);
        return data;
    }

    async updateBooking(bookingId, updateData) {
        const data = await this.request(`/bookings/${bookingId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        // Invalidate bookings cache
        this._invalidateCache('/bookings');
        
        return data;
    }

    async cancelBooking(bookingId) {
        return this.updateBooking(bookingId, { status: 'cancelled' });
    }

    async completeBooking(bookingId) {
        return this.updateBooking(bookingId, { status: 'completed' });
    }

    /**
     * Statistics and reports
     */
    async getStats() {
        const cacheKey = this._getCacheKey('/stats');
        const cached = this._getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        // Calculate stats from bookings data
        const bookingsData = await this.getBookings();
        const doctorsData = await this.getDoctors();
        
        const stats = this._calculateStats(bookingsData.bookings || [], doctorsData.doctors || []);
        
        this._setCache(cacheKey, stats);
        return stats;
    }

    _calculateStats(bookings, doctors) {
        const today = new Date().toISOString().split('T')[0];
        
        const totalBookings = bookings.length;
        const todayBookings = bookings.filter(b => b.appointment_date === today).length;
        const followups = bookings.filter(b => b.is_followup === 1).length;
        const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
        
            return {
            totalBookings,
            todayBookings,
            followups,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            totalDoctors: doctors.length,
            activeDoctors: doctors.filter(d => d.is_active === 1).length
        };
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            const data = await this.request('/test');
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Error handling helpers
     */
    handleError(error, customMessage) {
        console.error('API Error:', error);
        
        let message = customMessage || 'An unexpected error occurred';
        
        if (error instanceof APIError) {
            message = error.message;
        } else if (error.message) {
            message = error.message;
        }
        
        Utils.showError(message);
        return { success: false, error: message };
    }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Create singleton instance
window.apiClient = new APIClient();
