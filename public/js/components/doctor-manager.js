/**
 * Doctor Manager Component
 */
class DoctorManager {
    constructor() {
        this.doctors = [];
        this.currentDoctor = null;
        this.availabilitySchedule = {};
    }

    async loadDoctors() {
        try {
            const response = await window.apiClient.getDoctors();
            this.doctors = response.doctors || [];
            return this.doctors;
        } catch (error) {
            console.error('Failed to load doctors:', error);
            throw error;
        }
    }

    renderDoctorsGrid(container) {
        if (!container) return;

        if (this.doctors.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👨‍⚕️</div>
                    <h3>No doctors found</h3>
                    <p>Add your first doctor to get started.</p>
                    <button class="btn primary-btn" onclick="doctorManager.showAddDoctorModal()">
                        ➕ Add First Doctor
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="doctors-grid">
                ${this.doctors.map(doctor => this.renderDoctorCard(doctor)).join('')}
            </div>
        `;
    }

    renderDoctorCard(doctor) {
        return `
            <div class="doctor-card" data-doctor-id="${doctor.id}">
                <div class="doctor-header">
                    <div class="doctor-info">
                        <h4 class="doctor-name">${doctor.name}</h4>
                        <p class="doctor-department">${doctor.department}</p>
                        ${doctor.contact ? `<p class="doctor-contact">📞 ${doctor.contact}</p>` : ''}
                    </div>
                    <div class="doctor-status">
                        <span class="status-indicator ${doctor.is_active ? '' : 'inactive'}"></span>
                        <span class="status-text">${doctor.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                </div>
                
                <div class="doctor-stats">
                    <div class="stat-item">
                        <span class="stat-label">Joined:</span>
                        <span class="stat-value">${Utils.formatDate(doctor.created_at)}</span>
                    </div>
                </div>

                <div class="doctor-actions">
                    <button class="btn secondary-btn" onclick="doctorManager.editDoctor(${doctor.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn secondary-btn" onclick="doctorManager.manageAvailability(${doctor.id})">
                        📅 Schedule
                    </button>
                    <button class="btn ${doctor.is_active ? 'warning-btn' : 'success-btn'}" 
                            onclick="doctorManager.toggleDoctorStatus(${doctor.id})">
                        ${doctor.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                    </button>
                </div>
            </div>
        `;
    }

    showAddDoctorModal() {
        const modal = this.createDoctorModal('Add New Doctor', {
            name: '',
            department: '',
            contact: ''
        });
        
        document.body.appendChild(modal);
        modal.classList.add('active');
    }

    editDoctor(doctorId) {
        const doctor = this.doctors.find(d => d.id === doctorId);
        if (!doctor) return;

        const modal = this.createDoctorModal('Edit Doctor', doctor);
        document.body.appendChild(modal);
        modal.classList.add('active');
    }

    createDoctorModal(title, doctorData) {
        const isEdit = doctorData.id !== undefined;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal large">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="doctor-form" class="doctor-form">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="doctor-name">Doctor Name *</label>
                                <input type="text" id="doctor-name" name="name" 
                                       value="${doctorData.name || ''}" required maxlength="100">
                                <div class="form-error" id="doctor-name-error"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="doctor-department">Department/Specialty *</label>
                                <select id="doctor-department" name="department" required>
                                    <option value="">Select Department</option>
                                    ${this.getDepartmentOptions(doctorData.department)}
                                </select>
                                <div class="form-error" id="doctor-department-error"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="doctor-contact">Contact Number</label>
                                <input type="tel" id="doctor-contact" name="contact" 
                                       value="${doctorData.contact || ''}" maxlength="20">
                                <div class="form-error" id="doctor-contact-error"></div>
                            </div>
                            
                            ${isEdit ? `
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="doctor-active" name="is_active" 
                                               ${doctorData.is_active ? 'checked' : ''}>
                                        Doctor is active
                                    </label>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${isEdit ? `<input type="hidden" name="id" value="${doctorData.id}">` : ''}
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        Cancel
                    </button>
                    <button class="btn primary-btn" onclick="doctorManager.saveDoctorChanges(this)">
                        ${isEdit ? 'Update Doctor' : 'Add Doctor'}
                    </button>
                </div>
            </div>
        `;

        return modal;
    }

    getDepartmentOptions(selectedDepartment = '') {
        const departments = [
            'Cardiology',
            'Dermatology',
            'Emergency Medicine',
            'Family Medicine',
            'Gastroenterology',
            'General Surgery',
            'Internal Medicine',
            'Neurology',
            'Orthopedics',
            'Pediatrics',
            'Psychiatry',
            'Pulmonology',
            'Radiology',
            'Urology'
        ];

        return departments.map(dept => 
            `<option value="${dept}" ${dept === selectedDepartment ? 'selected' : ''}>${dept}</option>`
        ).join('');
    }

    async saveDoctorChanges(button) {
        const modal = button.closest('.modal-overlay');
        const form = modal.querySelector('#doctor-form');
        const formData = new FormData(form);
        const isEdit = formData.get('id') !== null;

        // Validate form
        if (!this.validateDoctorForm(form)) {
            return;
        }

        const doctorData = {
            name: formData.get('name').trim(),
            department: formData.get('department'),
            contact: formData.get('contact').trim(),
            is_active: isEdit ? (formData.get('is_active') === 'on' ? 1 : 0) : 1
        };

        Utils.setLoading(button, true);

        try {
            let response;
            if (isEdit) {
                const doctorId = formData.get('id');
                response = await window.apiClient.updateDoctor(doctorId, doctorData);
            } else {
                response = await window.apiClient.addDoctor(doctorData);
            }

            if (response.success) {
                Utils.showSuccess(`Doctor ${isEdit ? 'updated' : 'added'} successfully!`);
                modal.remove();
                
                // Reload doctors
                await this.loadDoctors();
                
                // Update UI
                if (window.adminDashboard) {
                    window.adminDashboard.refreshDoctors();
                }
            } else {
                Utils.showError(response.message || `Failed to ${isEdit ? 'update' : 'add'} doctor`);
            }
        } catch (error) {
            console.error('Failed to save doctor:', error);
            Utils.showError(`Failed to ${isEdit ? 'update' : 'add'} doctor. Please try again.`);
        } finally {
            Utils.setLoading(button, false);
        }
    }

    validateDoctorForm(form) {
        let isValid = true;
        const name = form.querySelector('[name="name"]').value.trim();
        const department = form.querySelector('[name="department"]').value;
        const contact = form.querySelector('[name="contact"]').value.trim();

        // Validate name
        if (!name) {
            this.showFieldError('doctor-name', 'Doctor name is required');
            isValid = false;
        } else if (name.length < 2) {
            this.showFieldError('doctor-name', 'Name must be at least 2 characters');
            isValid = false;
        } else {
            this.clearFieldError('doctor-name');
        }

        // Validate department
        if (!department) {
            this.showFieldError('doctor-department', 'Please select a department');
            isValid = false;
        } else {
            this.clearFieldError('doctor-department');
        }

        // Validate contact (optional but must be valid if provided)
        if (contact && !Utils.validatePhone(contact)) {
            this.showFieldError('doctor-contact', 'Please enter a valid phone number');
            isValid = false;
        } else {
            this.clearFieldError('doctor-contact');
        }

        return isValid;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.add('error');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
        }
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.remove('error');
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }
        }
    }

    async toggleDoctorStatus(doctorId) {
        const doctor = this.doctors.find(d => d.id === doctorId);
        if (!doctor) return;

        const newStatus = doctor.is_active ? 0 : 1;
        const action = newStatus ? 'activate' : 'deactivate';

        if (!confirm(`Are you sure you want to ${action} Dr. ${doctor.name}?`)) {
            return;
        }

        try {
            const response = await window.apiClient.updateDoctor(doctorId, {
                ...doctor,
                is_active: newStatus
            });

            if (response.success) {
                Utils.showSuccess(`Doctor ${action}d successfully!`);
                
                // Update local data
                doctor.is_active = newStatus;
                
                // Update UI
                if (window.adminDashboard) {
                    window.adminDashboard.refreshDoctors();
                }
            } else {
                Utils.showError(`Failed to ${action} doctor`);
            }
        } catch (error) {
            console.error(`Failed to ${action} doctor:`, error);
            Utils.showError(`Failed to ${action} doctor. Please try again.`);
        }
    }

    manageAvailability(doctorId) {
        const doctor = this.doctors.find(d => d.id === doctorId);
        if (!doctor) return;

        this.showAvailabilityModal(doctor);
    }

    showAvailabilityModal(doctor) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal large">
                <div class="modal-header">
                    <h3 class="modal-title">Manage Schedule - ${doctor.name}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="availability-manager">
                        <div class="availability-header">
                            <p>Set weekly schedule for ${doctor.name}</p>
                        </div>
                        
                        <div class="availability-grid" id="availability-grid">
                            ${this.renderAvailabilityGrid()}
                        </div>
                        
                        <div class="availability-settings">
                            <div class="form-group">
                                <label for="slot-duration">Appointment Duration (minutes)</label>
                                <select id="slot-duration" name="slotDuration">
                                    <option value="15">15 minutes</option>
                                    <option value="30" selected>30 minutes</option>
                                    <option value="45">45 minutes</option>
                                    <option value="60">60 minutes</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        Cancel
                    </button>
                    <button class="btn primary-btn" onclick="doctorManager.saveAvailability(${doctor.id}, this)">
                        Save Schedule
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.classList.add('active');

        // Load current availability
        this.loadDoctorAvailability(doctor.id);
    }

    renderAvailabilityGrid() {
        const days = [
            { id: 1, name: 'Monday' },
            { id: 2, name: 'Tuesday' },
            { id: 3, name: 'Wednesday' },
            { id: 4, name: 'Thursday' },
            { id: 5, name: 'Friday' },
            { id: 6, name: 'Saturday' },
            { id: 0, name: 'Sunday' }
        ];

        return `
            <div class="availability-days">
                ${days.map(day => `
                    <div class="availability-day" data-day="${day.id}">
                        <div class="day-header">
                            <label class="day-toggle">
                                <input type="checkbox" class="day-checkbox" data-day="${day.id}">
                                <span class="day-name">${day.name}</span>
                            </label>
                        </div>
                        <div class="day-times" style="display: none;">
                            <div class="time-inputs">
                                <div class="form-group">
                                    <label>Start Time</label>
                                    <input type="time" class="start-time" data-day="${day.id}" value="09:00">
                                </div>
                                <div class="form-group">
                                    <label>End Time</label>
                                    <input type="time" class="end-time" data-day="${day.id}" value="17:00">
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async loadDoctorAvailability(doctorId) {
        try {
            const response = await window.apiClient.getDoctorAvailability(doctorId);
            const availability = response.availability || [];
            
            // Populate the form with existing availability
            availability.forEach(avail => {
                const dayCheckbox = document.querySelector(`[data-day="${avail.day_of_week}"].day-checkbox`);
                const startTime = document.querySelector(`[data-day="${avail.day_of_week}"].start-time`);
                const endTime = document.querySelector(`[data-day="${avail.day_of_week}"].end-time`);
                const dayTimes = document.querySelector(`[data-day="${avail.day_of_week}"]`).querySelector('.day-times');
                
                if (dayCheckbox) {
                    dayCheckbox.checked = true;
                    if (dayTimes) dayTimes.style.display = 'block';
                }
                if (startTime) startTime.value = avail.start_time;
                if (endTime) endTime.value = avail.end_time;
                
                // Set slot duration
                const slotDuration = document.getElementById('slot-duration');
                if (slotDuration) {
                    slotDuration.value = avail.slot_duration;
                }
            });

            // Add event listeners for day toggles
            document.querySelectorAll('.day-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const day = e.target.dataset.day;
                    const dayTimes = document.querySelector(`[data-day="${day}"]`).querySelector('.day-times');
                    dayTimes.style.display = e.target.checked ? 'block' : 'none';
                });
            });

        } catch (error) {
            console.error('Failed to load doctor availability:', error);
            Utils.showError('Failed to load current schedule');
        }
    }

    async saveAvailability(doctorId, button) {
        const availability = [];
        const slotDuration = document.getElementById('slot-duration').value;

        // Collect availability data
        document.querySelectorAll('.day-checkbox:checked').forEach(checkbox => {
            const day = parseInt(checkbox.dataset.day);
            const startTime = document.querySelector(`[data-day="${day}"].start-time`).value;
            const endTime = document.querySelector(`[data-day="${day}"].end-time`).value;

            if (startTime && endTime && startTime < endTime) {
                availability.push({
                    day_of_week: day,
                    start_time: startTime,
                    end_time: endTime,
                    slot_duration: parseInt(slotDuration)
                });
            }
        });

        if (availability.length === 0) {
            Utils.showError('Please select at least one day with valid times');
            return;
        }

        Utils.setLoading(button, true);

        try {
            const response = await window.apiClient.setDoctorAvailability(doctorId, availability);

            if (response.success) {
                Utils.showSuccess('Schedule updated successfully!');
                button.closest('.modal-overlay').remove();
            } else {
                Utils.showError(response.message || 'Failed to update schedule');
            }
        } catch (error) {
            console.error('Failed to save availability:', error);
            Utils.showError('Failed to update schedule. Please try again.');
        } finally {
            Utils.setLoading(button, false);
        }
    }
}

// Create singleton instance
window.doctorManager = new DoctorManager();
