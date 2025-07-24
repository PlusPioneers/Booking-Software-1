/**
 * Booking Widget Component
 */
class BookingWidget {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.doctors = [];
        this.selectedDoctor = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.availableSlots = [];
        this.isLoading = false;
        
        if (!this.container) {
            console.error('Booking widget container not found');
            return;
        }
        
        this.init();
    }

    async init() {
        this.render();
        await this.loadDoctors();
        this.setupEventListeners();
        this.setupFormValidation();
    }

    render() {
        this.container.innerHTML = `
            <div class="booking-widget">
                <div class="booking-header">
                    <h2>Book Medical Appointment</h2>
                    <p>Schedule your appointment with our medical professionals</p>
                </div>

                <div class="important-notice">
                    <h4>Important:</h4>
                    <p>All fields marked with <span class="required">*</span> are required. You'll receive a confirmation with your booking reference number.</p>
                </div>

                <form id="booking-form" class="booking-form" novalidate>
                    <div class="form-group">
                        <label for="patient-name">Patient Name <span class="required">*</span></label>
                        <input 
                            type="text" 
                            id="patient-name" 
                            name="patientName" 
                            required 
                            maxlength="100"
                            placeholder="Enter your full name"
                        >
                        <div class="form-error" id="patient-name-error"></div>
                    </div>

                    <div class="form-group">
                        <label for="patient-phone">Phone Number <span class="required">*</span></label>
                        <input 
                            type="tel" 
                            id="patient-phone" 
                            name="patientPhone" 
                            required
                            placeholder="Enter your phone number"
                        >
                        <div class="form-error" id="patient-phone-error"></div>
                    </div>

                    <div class="form-group">
                        <label for="patient-email">Email Address</label>
                        <input 
                            type="email" 
                            id="patient-email" 
                            name="patientEmail"
                            placeholder="Enter your email (optional)"
                        >
                        <div class="form-error" id="patient-email-error"></div>
                    </div>

                    <div class="form-group">
                        <label for="doctor-select">Preferred Doctor <span class="required">*</span></label>
                        <select id="doctor-select" name="doctorId" required>
                            <option value="">Select a doctor</option>
                        </select>
                        <div class="form-error" id="doctor-select-error"></div>
                    </div>

                    <div class="form-group">
                        <label for="appointment-date">Appointment Date <span class="required">*</span></label>
                        <input 
                            type="date" 
                            id="appointment-date" 
                            name="appointmentDate" 
                            required
                        >
                        <div class="form-error" id="appointment-date-error"></div>
                    </div>

                    <div class="form-group">
                        <label>Available Time Slots <span class="required">*</span></label>
                        <div id="time-slots" class="time-slots-container">
                            <div class="no-slots">Select date and doctor first</div>
                        </div>
                        <div class="form-error" id="time-slots-error"></div>
                    </div>

                    <div class="form-group">
                        <div class="checkbox-container">
                            <input type="checkbox" id="is-followup" name="isFollowup">
                            <label for="is-followup">This is a follow-up appointment</label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="notes">Additional Notes</label>
                        <textarea 
                            id="notes" 
                            name="notes" 
                            rows="3"
                            maxlength="500"
                            placeholder="Any additional information or special requirements"
                        ></textarea>
                        <div class="character-count">
                            <span id="notes-count">0</span>/500 characters
                        </div>
                    </div>

                    <button type="submit" class="submit-btn" data-original-text="Book Appointment">
                        Book Appointment
                    </button>
                </form>

                <div id="booking-result" class="booking-result" style="display: none;"></div>
            </div>
        `;
    }

    async loadDoctors() {
        try {
            const response = await window.apiClient.getDoctors();
            this.doctors = response.doctors || [];
            this.populateDoctorSelect();
        } catch (error) {
            console.error('Failed to load doctors:', error);
            Utils.showError('Failed to load doctors. Please refresh the page.');
        }
    }

    populateDoctorSelect() {
        const select = this.container.querySelector('#doctor-select');
        select.innerHTML = '<option value="">Select a doctor</option>';
        
        this.doctors.forEach(doctor => {
            const option = document.createElement('option');
            option.value = doctor.id;
            option.textContent = `${doctor.name} - ${doctor.department}`;
            select.appendChild(option);
        });
    }

    setupEventListeners() {
        const form = this.container.querySelector('#booking-form');
        const doctorSelect = this.container.querySelector('#doctor-select');
        const dateInput = this.container.querySelector('#appointment-date');
        const notesTextarea = this.container.querySelector('#notes');
        const notesCount = this.container.querySelector('#notes-count');

        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;

        // Set maximum date to 3 months from today
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        dateInput.max = maxDate.toISOString().split('T')[0];

        // Doctor selection handler
        doctorSelect.addEventListener('change', () => {
            this.selectedDoctor = doctorSelect.value;
            this.clearFormError('doctor-select');
            if (this.selectedDoctor && this.selectedDate) {
                this.loadAvailableSlots();
            } else {
                this.clearTimeSlots();
            }
        });

        // Date selection handler
        dateInput.addEventListener('change', () => {
            this.selectedDate = dateInput.value;
            this.clearFormError('appointment-date');
            if (this.selectedDoctor && this.selectedDate) {
                this.loadAvailableSlots();
            } else {
                this.clearTimeSlots();
            }
        });

        // Notes character counter
        if (notesTextarea && notesCount) {
            notesTextarea.addEventListener('input', () => {
                const length = notesTextarea.value.length;
                notesCount.textContent = length;
                
                if (length > 450) {
                    notesCount.style.color = 'var(--warning-color)';
                } else if (length > 480) {
                    notesCount.style.color = 'var(--error-color)';
                } else {
                    notesCount.style.color = 'var(--gray-500)';
                }
            });
        }

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBookingSubmit(e);
        });

        // Real-time validation
        this.setupRealtimeValidation();
    }

    setupRealtimeValidation() {
        const form = this.container.querySelector('#booking-form');
        const inputs = form.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });

            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.validateField(input);
                }
            });
        });
    }

    setupFormValidation() {
        // Custom validation messages
        const validationMessages = {
            'patient-name': 'Please enter your full name',
            'patient-phone': 'Please enter a valid phone number',
            'patient-email': 'Please enter a valid email address',
            'doctor-select': 'Please select a doctor',
            'appointment-date': 'Please select an appointment date',
            'appointment-time': 'Please select a time slot'
        };

        this.validationMessages = validationMessages;
    }

    validateField(field) {
        const fieldName = field.name || field.id;
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'patientName':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Patient name is required';
                } else if (value.length < 2) {
                    isValid = false;
                    errorMessage = 'Name must be at least 2 characters long';
                }
                break;

            case 'patientPhone':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Phone number is required';
                } else if (!Utils.validatePhone(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid phone number';
                }
                break;

            case 'patientEmail':
                if (value && !Utils.validateEmail(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;

            case 'doctorId':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Please select a doctor';
                }
                break;

            case 'appointmentDate':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Please select an appointment date';
                } else {
                    const selectedDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (selectedDate < today) {
                        isValid = false;
                        errorMessage = 'Cannot select a date in the past';
                    }
                }
                break;
        }

        this.showFieldError(field.id, isValid ? '' : errorMessage);
        return isValid;
    }

    showFieldError(fieldId, message) {
        const field = this.container.querySelector(`#${fieldId}`);
        const errorDiv = this.container.querySelector(`#${fieldId}-error`);
        
        if (field) {
            if (message) {
                field.classList.add('error');
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                }
            } else {
                field.classList.remove('error');
                if (errorDiv) {
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                }
            }
        }
    }

    clearFormError(fieldId) {
        this.showFieldError(fieldId, '');
    }

    async loadAvailableSlots() {
        const slotsContainer = this.container.querySelector('#time-slots');
        slotsContainer.innerHTML = '<div class="slots-loading">Loading available slots...</div>';

        try {
            const response = await window.apiClient.getAvailableSlots(
                this.selectedDoctor, 
                this.selectedDate
            );
            
            this.availableSlots = response.availableSlots || [];
            this.renderTimeSlots();
        } catch (error) {
            console.error('Failed to load time slots:', error);
            slotsContainer.innerHTML = '<div class="error">Failed to load time slots. Please try again.</div>';
        }
    }

    renderTimeSlots() {
        const slotsContainer = this.container.querySelector('#time-slots');
        
        if (this.availableSlots.length === 0) {
            slotsContainer.innerHTML = '<div class="no-slots">No available slots for this date. Please choose another date.</div>';
            return;
        }

        slotsContainer.innerHTML = `
            <div class="slots-grid">
                ${this.availableSlots.map(slot => `
                    <label class="slot-option">
                        <input type="radio" name="appointmentTime" value="${slot}" required>
                        <span class="slot-time">${Utils.formatTime(slot)}</span>
                    </label>
                `).join('')}
            </div>
        `;

        // Add event listeners to time slots
        const timeSlots = slotsContainer.querySelectorAll('input[name="appointmentTime"]');
        timeSlots.forEach(slot => {
            slot.addEventListener('change', () => {
                this.selectedTime = slot.value;
                this.clearFormError('time-slots');
            });
        });
    }

    clearTimeSlots() {
        const slotsContainer = this.container.querySelector('#time-slots');
        slotsContainer.innerHTML = '<div class="no-slots">Select date and doctor first</div>';
        this.selectedTime = null;
    }

    validateForm() {
        const form = this.container.querySelector('#booking-form');
        const formData = new FormData(form);
        const errors = [];

        // Validate required fields
        const requiredFields = ['patientName', 'patientPhone', 'doctorId', 'appointmentDate'];
        
        requiredFields.forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (!this.validateField(field)) {
                errors.push(fieldName);
            }
        });

        // Validate time slot selection
        const selectedTime = form.querySelector('input[name="appointmentTime"]:checked');
        if (!selectedTime) {
            this.showFieldError('time-slots', 'Please select a time slot');
            errors.push('appointmentTime');
        }

        return errors.length === 0;
    }

    async handleBookingSubmit(event) {
        const form = event.target;
        const submitBtn = form.querySelector('.submit-btn');
        
        // Prevent multiple submissions
        if (this.isLoading) {
            return;
        }

        // Validate form
        if (!this.validateForm()) {
            Utils.showError('Please correct the errors and try again.');
            return;
        }

        const formData = new FormData(form);
        const selectedTime = form.querySelector('input[name="appointmentTime"]:checked');
        
        if (!selectedTime) {
            Utils.showError('Please select a time slot');
            return;
        }

        const bookingData = {
            patientName: formData.get('patientName').trim(),
            patientPhone: formData.get('patientPhone').trim(),
            patientEmail: formData.get('patientEmail')?.trim() || '',
            doctorId: parseInt(formData.get('doctorId')),
            appointmentDate: formData.get('appointmentDate'),
            appointmentTime: selectedTime.value,
            isFollowup: formData.get('isFollowup') === 'on',
            notes: formData.get('notes')?.trim() || ''
        };

        this.isLoading = true;
        Utils.setLoading(submitBtn, true, 'Book Appointment');

        try {
            const response = await window.apiClient.createBooking(bookingData);
            
            if (response.success) {
                this.showSuccessMessage(response, bookingData);
                form.reset();
                this.selectedDoctor = null;
                this.selectedDate = null;
                this.selectedTime = null;
                this.clearTimeSlots();
                
                // Reset form state
                form.querySelectorAll('.error').forEach(field => {
                    field.classList.remove('error');
                });
                form.querySelectorAll('.form-error').forEach(error => {
                    error.style.display = 'none';
                });
            } else {
                Utils.showError(response.message || 'Failed to book appointment');
            }
        } catch (error) {
            console.error('Booking failed:', error);
            Utils.showError(error.message || 'Failed to book appointment. Please try again.');
        } finally {
            this.isLoading = false;
            Utils.setLoading(submitBtn, false);
        }
    }

    showSuccessMessage(response, bookingData) {
        const resultDiv = this.container.querySelector('#booking-result');
        const doctor = this.doctors.find(d => d.id == bookingData.doctorId);
        
        resultDiv.innerHTML = `
            <div class="success-message">
                <h3>🎉 Appointment Confirmed!</h3>
                <div class="booking-details">
                    <p><strong>Booking Reference:</strong> ${response.bookingReference}</p>
                    <p><strong>Patient:</strong> ${bookingData.patientName}</p>
                    <p><strong>Doctor:</strong> ${doctor ? doctor.name : 'N/A'}</p>
                    <p><strong>Department:</strong> ${doctor ? doctor.department : 'N/A'}</p>
                    <p><strong>Date:</strong> ${Utils.formatDate(bookingData.appointmentDate)}</p>
                    <p><strong>Time:</strong> ${Utils.formatTime(bookingData.appointmentTime)}</p>
                    ${bookingData.isFollowup ? '<p><strong>Type:</strong> Follow-up Appointment</p>' : ''}
                    ${bookingData.notes ? `<p><strong>Notes:</strong> ${bookingData.notes}</p>` : ''}
                </div>
                <div class="success-actions">
                    <button onclick="window.print()" class="btn primary-btn">Print Confirmation</button>
                    <button onclick="location.reload()" class="btn secondary-btn">Book Another</button>
                </div>
                <p class="success-note">
                    ${bookingData.patientEmail ? 
                        'A confirmation email has been sent to your email address.' : 
                        'Please save your booking reference number for future reference.'
                    }
                </p>
            </div>
        `;
        
        resultDiv.style.display = 'block';
        
        // Scroll to result
        setTimeout(() => {
            Utils.scrollToElement(resultDiv, 20);
        }, 100);

        // Save booking reference to local storage for user reference
        const savedBookings = Utils.storage.get('savedBookings', []);
        savedBookings.push({
            reference: response.bookingReference,
            date: bookingData.appointmentDate,
            time: bookingData.appointmentTime,
            doctor: doctor ? doctor.name : 'Unknown',
            patient: bookingData.patientName
        });
        Utils.storage.set('savedBookings', savedBookings.slice(-10)); // Keep only last 10
    }

    // Public methods for external control
    setDoctor(doctorId) {
        const select = this.container.querySelector('#doctor-select');
        if (select) {
            select.value = doctorId;
            this.selectedDoctor = doctorId;
            select.dispatchEvent(new Event('change'));
        }
    }

    setDate(date) {
        const input = this.container.querySelector('#appointment-date');
        if (input) {
            input.value = date;
            this.selectedDate = date;
            input.dispatchEvent(new Event('change'));
        }
    }

    prefillForm(data) {
        const form = this.container.querySelector('#booking-form');
        if (form) {
            Utils.setFormData(form, data);
        }
    }
}

window.BookingWidget = BookingWidget;
