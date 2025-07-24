const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Add compression middleware
app.use(compression());

// Enable CORS for all routes
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'your-domain.com' : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Set view engine for server-side rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// Initialize SQLite database
const db = new sqlite3.Database('./bookings.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Create tables if they don't exist
db.serialize(() => {
    // Doctors table
    db.run(`
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            contact TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Doctor availability table
    db.run(`
        CREATE TABLE IF NOT EXISTS doctor_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            slot_duration INTEGER DEFAULT 30,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (doctor_id) REFERENCES doctors (id)
        )
    `);

    // Doctor blocked dates table
    db.run(`
        CREATE TABLE IF NOT EXISTS doctor_blocked_dates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id INTEGER NOT NULL,
            blocked_date TEXT NOT NULL,
            reason TEXT,
            FOREIGN KEY (doctor_id) REFERENCES doctors (id)
        )
    `);

    // Updated bookings table
    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT NOT NULL,
            patient_email TEXT,
            patient_phone TEXT NOT NULL,
            doctor_id INTEGER NOT NULL,
            appointment_date TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            is_followup INTEGER DEFAULT 0,
            notes TEXT,
            status TEXT DEFAULT 'confirmed',
            booking_reference TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_id) REFERENCES doctors (id)
        )
    `);

    // Insert sample doctors if none exist
    db.get('SELECT COUNT(*) as count FROM doctors', (err, row) => {
        if (!err && row.count === 0) {
            const sampleDoctors = [
                ['Dr. Sarah Johnson', 'Cardiology', '+1-555-0101'],
                ['Dr. Michael Chen', 'Neurology', '+1-555-0102'],
                ['Dr. Emily Rodriguez', 'Pediatrics', '+1-555-0103'],
                ['Dr. David Kim', 'Orthopedics', '+1-555-0104'],
                ['Dr. Lisa Thompson', 'Dermatology', '+1-555-0105']
            ];
            
            const stmt = db.prepare('INSERT INTO doctors (name, department, contact) VALUES (?, ?, ?)');
            sampleDoctors.forEach(doctor => {
                stmt.run(doctor);
            });
            stmt.finalize();

            // Add sample availability for each doctor
            setTimeout(() => {
                db.all('SELECT id FROM doctors', (err, doctors) => {
                    if (!err) {
                        const availStmt = db.prepare(`
                            INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration)
                            VALUES (?, ?, ?, ?, ?)
                        `);
                        doctors.forEach(doctor => {
                            // Monday to Friday, 9 AM to 5 PM, 30-minute slots
                            for (let day = 1; day <= 5; day++) {
                                availStmt.run([doctor.id, day, '09:00', '17:00', 30]);
                            }
                        });
                        availStmt.finalize();
                    }
                });
            }, 100);
        }
    });
});

// Email configuration
const transporter = nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'esstellers@gmail.com',
        pass: process.env.EMAIL_PASS || 'thahir2005@'
    }
});

// Cache for frequently accessed data
const cache = {
    doctors: null,
    doctorsTimestamp: 0,
    cacheDuration: 5 * 60 * 1000 // 5 minutes
};

// Generate booking reference
function generateBookingReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Generate time slots helper function
function generateTimeSlots(startTime, endTime, duration) {
    const slots = [];
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    let current = new Date(start);

    while (current < end) {
        slots.push(current.toTimeString().slice(0, 5));
        current.setMinutes(current.getMinutes() + duration);
    }
    return slots;
}

// Routes

// Home route - serve booking page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/views/booking.html'));
});

// Admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/views/admin.html'));
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Medical booking system is working!' });
});

// Get all doctors with caching
app.get('/api/doctors', (req, res) => {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cache.doctors && (now - cache.doctorsTimestamp) < cache.cacheDuration) {
        return res.json({ success: true, doctors: cache.doctors });
    }
    
    db.all('SELECT * FROM doctors WHERE is_active = 1 ORDER BY name', (err, doctors) => {
        if (err) {
            console.error('Error fetching doctors:', err);
            return res.status(500).json({ success: false, message: 'Error fetching doctors' });
        }
        
        // Update cache
        cache.doctors = doctors;
        cache.doctorsTimestamp = now;
        
        res.json({ success: true, doctors });
    });
});

// Add new doctor
app.post('/api/doctors', (req, res) => {
    const { name, department, contact } = req.body;
    
    if (!name || !department) {
        return res.status(400).json({ success: false, message: 'Name and department are required' });
    }

    db.run(
        'INSERT INTO doctors (name, department, contact) VALUES (?, ?, ?)',
        [name, department, contact || ''],
        function(err) {
            if (err) {
                console.error('Error adding doctor:', err);
                return res.status(500).json({ success: false, message: 'Error adding doctor' });
            }
            
            // Clear cache
            cache.doctors = null;
            
            res.json({ success: true, doctorId: this.lastID });
        }
    );
});

// Update doctor
app.put('/api/doctors/:id', (req, res) => {
    const { id } = req.params;
    const { name, department, contact, is_active } = req.body;

    db.run(
        'UPDATE doctors SET name = ?, department = ?, contact = ?, is_active = ? WHERE id = ?',
        [name, department, contact, is_active !== undefined ? is_active : 1, id],
        function(err) {
            if (err) {
                console.error('Error updating doctor:', err);
                return res.status(500).json({ success: false, message: 'Error updating doctor' });
            }
            
            // Clear cache
            cache.doctors = null;
            
            res.json({ success: true });
        }
    );
});

// Get doctor availability
app.get('/api/doctors/:id/availability', (req, res) => {
    const { id } = req.params;

    db.all(
        'SELECT * FROM doctor_availability WHERE doctor_id = ? AND is_active = 1',
        [id],
        (err, availability) => {
            if (err) {
                console.error('Error fetching availability:', err);
                return res.status(500).json({ success: false, message: 'Error fetching availability' });
            }
            res.json({ success: true, availability });
        }
    );
});

// Set doctor availability
app.post('/api/doctors/:id/availability', (req, res) => {
    const { id } = req.params;
    const { availability } = req.body;

    // First, deactivate all existing availability
    db.run('UPDATE doctor_availability SET is_active = 0 WHERE doctor_id = ?', [id], (err) => {
        if (err) {
            console.error('Error updating availability:', err);
            return res.status(500).json({ success: false, message: 'Error updating availability' });
        }

        // Insert new availability
        const stmt = db.prepare(`
            INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        availability.forEach(slot => {
            stmt.run([id, slot.day_of_week, slot.start_time, slot.end_time, slot.slot_duration || 30]);
        });
        
        stmt.finalize((err) => {
            if (err) {
                console.error('Error inserting availability:', err);
                return res.status(500).json({ success: false, message: 'Error setting availability' });
            }
            res.json({ success: true });
        });
    });
});

// Get available time slots for a doctor on a specific date
app.get('/api/doctors/:id/slots/:date', (req, res) => {
    const { id, date } = req.params;
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    // Get doctor's availability for this day
    db.get(
        'SELECT * FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1',
        [id, dayOfWeek],
        (err, availability) => {
            if (err) {
                console.error('Error fetching availability:', err);
                return res.status(500).json({ success: false, message: 'Error checking availability' });
            }

            if (!availability) {
                return res.json({ success: true, availableSlots: [] });
            }

            // Check if date is blocked
            db.get(
                'SELECT * FROM doctor_blocked_dates WHERE doctor_id = ? AND blocked_date = ?',
                [id, date],
                (err, blocked) => {
                    if (err) {
                        console.error('Error checking blocked dates:', err);
                        return res.status(500).json({ success: false, message: 'Error checking availability' });
                    }

                    if (blocked) {
                        return res.json({ success: true, availableSlots: [] });
                    }

                    // Generate time slots
                    const slots = generateTimeSlots(availability.start_time, availability.end_time, availability.slot_duration);

                    // Get booked slots
                    db.all(
                        'SELECT appointment_time FROM bookings WHERE doctor_id = ? AND appointment_date = ? AND status != "cancelled"',
                        [id, date],
                        (err, bookedSlots) => {
                            if (err) {
                                console.error('Error fetching booked slots:', err);
                                return res.status(500).json({ success: false, message: 'Error checking availability' });
                            }

                            const bookedTimes = bookedSlots.map(slot => slot.appointment_time);
                            const availableSlots = slots.filter(slot => !bookedTimes.includes(slot));

                            res.json({ success: true, availableSlots });
                        }
                    );
                }
            );
        }
    );
});

// Create new booking
app.post('/api/bookings', (req, res) => {
    const { patientName, patientEmail, patientPhone, doctorId, appointmentDate, appointmentTime, isFollowup, notes } = req.body;

    // Validate required fields
    if (!patientName || !patientPhone || !doctorId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: patientName, patientPhone, doctorId, appointmentDate, appointmentTime'
        });
    }

    // Check if the selected date is not in the past
    const selectedDate = new Date(appointmentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        return res.status(400).json({
            success: false,
            message: 'Cannot book appointments in the past'
        });
    }

    // Check if slot is available
    db.get(
        'SELECT id FROM bookings WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
        [doctorId, appointmentDate, appointmentTime],
        (err, existingBooking) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Database error occurred' });
            }

            if (existingBooking) {
                return res.status(409).json({
                    success: false,
                    message: 'This time slot is already booked. Please choose a different time.'
                });
            }

            const bookingReference = generateBookingReference();

            // Insert new booking
            db.run(
                `INSERT INTO bookings (patient_name, patient_email, patient_phone, doctor_id, appointment_date, appointment_time, is_followup, notes, booking_reference)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [patientName, patientEmail || '', patientPhone, doctorId, appointmentDate, appointmentTime, isFollowup ? 1 : 0, notes || '', bookingReference],
                function(err) {
                    if (err) {
                        console.error('Insert error:', err);
                        return res.status(500).json({ success: false, message: 'Failed to save booking' });
                    }

                    // Get doctor info for confirmation
                    db.get('SELECT name FROM doctors WHERE id = ?', [doctorId], (err, doctor) => {
                        if (err) {
                            console.error('Error fetching doctor:', err);
                        }

                        const doctorName = doctor ? doctor.name : 'Unknown Doctor';

                        // Send confirmation email if email provided
                        if (patientEmail && process.env.EMAIL_USER) {
                            const mailOptions = {
                                from: process.env.EMAIL_USER,
                                to: patientEmail,
                                subject: 'Appointment Confirmation',
                                html: `
                                    <h2>Appointment Confirmation</h2>
                                    <p>Dear <strong>${patientName}</strong>,</p>
                                    <p>Your appointment has been successfully booked with the following details:</p>
                                    <ul>
                                        <li><strong>Doctor:</strong> ${doctorName}</li>
                                        <li><strong>Date:</strong> ${appointmentDate}</li>
                                        <li><strong>Time:</strong> ${appointmentTime}</li>
                                        <li><strong>Booking Reference:</strong> ${bookingReference}</li>
                                    </ul>
                                    <p>Please arrive 15 minutes before your scheduled appointment time.</p>
                                    <p>If you need to cancel or reschedule, please contact us with your booking reference: ${bookingReference}</p>
                                `
                            };

                            transporter.sendMail(mailOptions, (error, info) => {
                                if (error) {
                                    console.log('Email error:', error);
                                }
                            });
                        }

                        res.json({
                            success: true,
                            bookingId: this.lastID,
                            bookingReference,
                            appointmentTime,
                            message: 'Appointment booked successfully!'
                        });
                    });
                }
            );
        }
    );
});

// Get all bookings
app.get('/api/bookings', (req, res) => {
    const { status, date, doctorId, search } = req.query;
    let query = `
        SELECT b.*, d.name as doctor_name, d.department 
        FROM bookings b 
        JOIN doctors d ON b.doctor_id = d.id 
        WHERE 1=1
    `;
    let params = [];

    if (status) {
        query += ' AND b.status = ?';
        params.push(status);
    }

    if (date) {
        query += ' AND b.appointment_date = ?';
        params.push(date);
    }

    if (doctorId) {
        query += ' AND b.doctor_id = ?';
        params.push(doctorId);
    }

    if (search) {
        query += ' AND (b.patient_name LIKE ? OR b.booking_reference LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY b.appointment_date DESC, b.appointment_time DESC';

    db.all(query, params, (err, bookings) => {
        if (err) {
            console.error('Error fetching bookings:', err);
            return res.status(500).json({ success: false, message: 'Error fetching bookings' });
        }
        res.json({ success: true, bookings });
    });
});

// Update booking status
app.put('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    let query = 'UPDATE bookings SET ';
    let params = [];

    if (status) {
        query += 'status = ?';
        params.push(status);
    }

    if (notes) {
        if (params.length > 0) query += ', ';
        query += 'notes = ?';
        params.push(notes);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.run(query, params, function(err) {
        if (err) {
            console.error('Error updating booking:', err);
            return res.status(500).json({ success: false, message: 'Error updating booking' });
        }
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
