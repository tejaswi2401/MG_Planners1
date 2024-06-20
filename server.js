const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8032;

// Middleware to parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite database
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('SQLite connection error:', err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create users table (if not exists)
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating categories table:', err.message);
        } else {
            // Insert default categories if table is newly created
            db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Steel')`);
            db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Sand')`);
            db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Tapi')`);
            db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Cement')`);
            // Add more categories as needed
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            description TEXT,
            price REAL,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating items table:', err.message);
        }
    });
});

// Endpoint to get all categories
app.get('/categories', (req, res) => {
    db.all('SELECT * FROM categories', (err, rows) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(rows);
    });
});

// Endpoint to get items by category
app.get('/items/:category', (req, res) => {
    const { category } = req.params;
    db.all('SELECT * FROM items WHERE category_id = (SELECT id FROM categories WHERE name = ?)', [category], (err, rows) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(rows);
    });
});

// Endpoint to add an item
app.post('/items', (req, res) => {
    const { category, description, price } = req.body;

    db.get('SELECT id FROM categories WHERE name = ?', [category], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const categoryId = row.id;

        db.run('INSERT INTO items (category_id, description, price) VALUES (?, ?, ?)', [categoryId, description, price], function(err) {
            if (err) {
                console.error('SQLite insert error:', err.message);
                return res.status(500).json({ error: 'Failed to add item' });
            }

            res.status(200).json({ message: 'Item added successfully!' });
        });
    });
});

// Endpoint to update an item
app.put('/items/:id', (req, res) => {
    const itemId = req.params.id;
    const { description, price } = req.body;

    db.run('UPDATE items SET description = ?, price = ? WHERE id = ?', [description, price, itemId], function(err) {
        if (err) {
            console.error('SQLite update error:', err.message);
            return res.status(500).json({ error: 'Failed to update item' });
        }

        res.status(200).json({ message: 'Item updated successfully!' });
    });
});

// Endpoint to delete an item
app.delete('/items/:id', (req, res) => {
    const itemId = req.params.id;

    db.run('DELETE FROM items WHERE id = ?', [itemId], function(err) {
        if (err) {
            console.error('SQLite delete error:', err.message);
            return res.status(500).json({ error: 'Failed to delete item' });
        }

        res.status(200).json({ message: 'Item deleted successfully!' });
    });
});

// Endpoint to handle user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query database to check if user exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        if (!row) {
            return res.status(401).json({ error: 'Username not registered. Please sign up.' });
        }

        // Validate password (replace with bcrypt for production)
        if (password !== row.password) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }

        // Login successful
        res.status(200).json({ message: 'Login successful!' });
    });
});

// Endpoint to handle user signup
app.post('/signup', (req, res) => {
    const { username, password } = req.body;

    // Insert user into database
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) {
            console.error('SQLite insert error:', err.message);
            return res.status(500).json({ error: 'Failed to create user' });
        }

        // New user created successfully
        res.status(200).json({ message: 'User created successfully!' });
    });
});

// Endpoint to handle password reset
app.post('/reset-password', (req, res) => {
    const { username, oldPassword, newPassword } = req.body;

    // Query database to check if user exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        if (!row) {
            return res.status(401).json({ error: 'Username not registered. Please sign up.' });
        }

        // Validate old password (replace with bcrypt for production)
        if (oldPassword !== row.password) {
            return res.status(401).json({ error: 'Incorrect old password.' });
        }

        // Update password in the database
        db.run('UPDATE users SET password = ? WHERE username = ?', [newPassword, username], function(err) {
            if (err) {
                console.error('SQLite update error:', err.message);
                return res.status(500).json({ error: 'Failed to reset password' });
            }

            res.status(200).json({ message: 'Password reset successfully!' });
        });
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve homepage.html
app.get('/homepage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// Serve na.html
app.get('/na.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'na.html'));
});

// Serve pa.html
app.get('/pa.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pa.html'));
});

// Serve c2.css
app.get('/c2.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'c2.css'));
});
app.get('/Krishnalanka.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Krishnalanka.html'));
});
app.get('/Suryaraopet.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Suryaraopet.html'));
});
app.get('/Sivalayam.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Sivalayam.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
