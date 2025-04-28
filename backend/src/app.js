const express = require('express');
const cors = require('cors');
const db = require('./database'); // connect to SQLite
const app = express();
const bcrypt = require('bcrypt');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
    res.status(200).send('Hello from ScorePlayer API!');
});

// Signup Route
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    // Check missing fields
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required.' });
    }

    try {
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user into database
        const query = `INSERT INTO users (email, password_hash) VALUES (?, ?)`;
        db.run(query, [email, hashedPassword], function(err) {
            if (err) {
                console.error(err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Email already registered.' });
                }
                return res.status(500).json({ message: 'Database error.' });
            }

            // Success
            res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
        });
    } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Internal server error.' });
}

});

// Login Route
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

        // Compare passwords
        const match = await bcrypt.compare(password, row.password_hash);

        if (match) {
            res.status(200).json({ message: 'Login successful!', userId: row.id });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    });
});


// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
