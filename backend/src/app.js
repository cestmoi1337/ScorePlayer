// Import required packages
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const db = require('./database'); // Connect to SQLite

const app = express();
const PORT = process.env.PORT || 3000;

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Middleware setup
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static('src/uploads'));

// ==============================
// Test Route
// ==============================
app.get('/', (req, res) => {
    res.status(200).send('Hello from ScorePlayer API!');
});

// ==============================
// Signup Route
// ==============================
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required.' });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const query = `INSERT INTO users (email, password_hash) VALUES (?, ?)`;
        db.run(query, [email, hashedPassword], function(err) {
            if (err) {
                console.error('Database error during signup:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Email already registered.' });
                }
                return res.status(500).json({ message: 'Database error.' });
            }

            res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// ==============================
// Login Route
// ==============================
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required.' });
    }

    const query = `SELECT * FROM users WHERE email = ?`;
    db.get(query, [email], async (err, row) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ message: 'Database error.' });
        }

        if (!row) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const match = await bcrypt.compare(password, row.password_hash);

        if (match) {
            res.status(200).json({ message: 'Login successful!', userId: row.id });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    });
});

// ==============================
// Multer Setup for File Upload
// ==============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'src/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// ==============================
// Upload Route with OMR
// ==============================
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    console.log('File uploaded:', req.file);

    // If it's a PDF, run Audiveris to extract MusicXML
    if (req.file.mimetype === 'application/pdf') {
        const pdfPath = path.resolve(__dirname, 'uploads', req.file.filename);
        const outputDir = path.resolve(__dirname, 'uploads');

        exec(`audiveris -batch -export -output "${outputDir}" "${pdfPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Audiveris error: ${error.message}`);
            } else {
                console.log(`✅ Audiveris finished processing ${req.file.filename}`);
            }
        });
    }

    res.status(200).json({
        message: 'File uploaded successfully!',
        filename: req.file.filename
    });
});

// ==============================
// List Uploaded Files Route
// ==============================
app.get('/files', (req, res) => {
    const uploadsDir = path.join(__dirname, 'uploads');

    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            console.error('Error reading uploads folder:', err);
            return res.status(500).json({ message: 'Could not list files.' });
        }

        res.status(200).json({ files: files });
    });
});

// ==============================
// Start Server
// ==============================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
