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

// Create tables if they do not exist
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

    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            expected_budget REAL NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Error creating projects table:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating materials table:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS bill_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT,
            material TEXT,
            description TEXT,
            bill_amount REAL,
            payment_to TEXT,
            payment_by TEXT,
            payment_method TEXT,
            date TEXT,
            FOREIGN KEY(project_name) REFERENCES projects(name)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating bill_entries table:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS deleted_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT,
            material TEXT,
            description TEXT,
            bill_amount REAL,
            payment_to TEXT,
            payment_by TEXT,
            payment_method TEXT,
            date TEXT,
            FOREIGN KEY(project_name) REFERENCES projects(name)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating deleted_entries table:', err.message);
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

// Endpoint to delete a project by name
app.delete('/projects/name/:name', (req, res) => {
    const projectName = req.params.name;

    db.run('DELETE FROM projects WHERE name = ?', [projectName], function(err) {
        if (err) {
            console.error('SQLite delete error:', err.message);
            return res.status(500).json({ error: 'Failed to delete project' });
        }

        res.status(200).json({ message: 'Project deleted successfully!' });
    });
});

// Endpoint to handle user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        if (!row) {
            return res.status(401).json({ error: 'Username not registered. Please sign up.' });
        }

        if (password !== row.password) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }

        res.status(200).json({ message: 'Login successful!' });
    });
});

// Endpoint to handle user signup
app.post('/signup', (req, res) => {
    const { username, password } = req.body;

    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) {
            console.error('SQLite insert error:', err.message);
            return res.status(500).json({ error: 'Failed to create user' });
        }

        res.status(200).json({ message: 'User created successfully!' });
    });
});

// Endpoint to handle password reset
app.post('/reset-password', (req, res) => {
    const { username, oldPassword, newPassword } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        if (!row) {
            return res.status(401).json({ error: 'Username not registered. Please sign up.' });
        }

        if (oldPassword !== row.password) {
            return res.status(401).json({ error: 'Incorrect old password.' });
        }

        db.run('UPDATE users SET password = ? WHERE username = ?', [newPassword, username], function(err) {
            if (err) {
                console.error('SQLite update error:', err.message);
                return res.status(500).json({ error: 'Failed to reset password' });
            }

            res.status(200).json({ message: 'Password reset successful!' });
        });
    });
});

// Endpoint to get all projects
app.get('/projects', (req, res) => {
    db.all('SELECT * FROM projects', (err, rows) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(rows);
    });
});

// Endpoint to add a project
app.post('/projects', (req, res) => {
    const { name, expected_budget } = req.body;

    db.run('INSERT INTO projects (name, expected_budget) VALUES (?, ?)', [name, expected_budget], function(err) {
        if (err) {
            console.error('SQLite insert error:', err.message);
            return res.status(500).json({ error: 'Failed to add project' });
        }

        res.status(200).json({ message: 'Project added successfully!' });
    });
});
// Endpoint to get a project by name
app.get('/projects/:name/expected_budget', (req, res) => {
    const projectName = req.params.name;

    db.get('SELECT expected_budget FROM projects WHERE name = ?', [projectName], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ expected_budget: row.expected_budget });
    });
});
app.post('/save-entry', (req, res) => {
    const { projectName, date, material, description, billAmount, paymentTo, paymentBy, paymentMethod } = req.body;

    if (!projectName || !date || !material || !description || !billAmount || isNaN(billAmount) || billAmount <= 0 || !paymentTo || !paymentBy || !paymentMethod) {
        return res.status(400).json({ error: 'Please provide all required fields correctly.' });
    }

    db.run(`INSERT INTO bill_entries (project_name, date, material, description, bill_amount, payment_to, payment_by, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectName, date, material, description, billAmount, paymentTo, paymentBy, paymentMethod],
        function(err) {
            if (err) {
                console.error('SQLite insert error:', err.message);
                return res.status(500).json({ error: 'Failed to add bill entry' });
            }
            res.status(200).json({ message: 'Bill entry added successfully!' });
        }
    );
});

// Endpoint to update a project
app.put('/projects/:id', (req, res) => {
    const projectId = req.params.id;
    const { name, expected_budget } = req.body;

    db.run('UPDATE projects SET name = ?, expected_budget = ? WHERE id = ?', [name, expected_budget, projectId], function(err) {
        if (err) {
            console.error('SQLite update error:', err.message);
            return res.status(500).json({ error: 'Failed to update project' });
        }

        res.status(200).json({ message: 'Project updated successfully!' });
    });
});

// Endpoint to delete a project
app.delete('/projects/:id', (req, res) => {
    const projectId = req.params.id;

    db.run('DELETE FROM projects WHERE id = ?', [projectId], function(err) {
        if (err) {
            console.error('SQLite delete error:', err.message);
            return res.status(500).json({ error: 'Failed to delete project' });
        }

        res.status(200).json({ message: 'Project deleted successfully!' });
    });
});

// Endpoint to add a bill entry
app.get('/bill_entries', (req, res) => {
    const { project_name, material, description, bill_amount, payment_to, payment_by, payment_method, date } = req.body;

    db.run(`INSERT INTO bill_entries (project_name, material, description, bill_amount, payment_to, payment_by, payment_method, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [project_name, material, description, bill_amount, payment_to, payment_by, payment_method, date],
        function(err) {
            if (err) {
                console.error('SQLite insert error:', err.message);
                return res.status(500).json({ error: 'Failed to add bill entry' });
            }
            res.status(201).json({ message: 'Bill entry added successfully!' });
        }
    );
});

// Endpoint to get bill entries by project name
app.get('/bill_entries/projectName', (req, res) => {
    const { projectName, material, date } = req.query;

    let sql = 'SELECT * FROM bill_entries WHERE project_name = ?';
    let params = [projectName];

    if (material) {
        sql += ' AND material = ?';
        params.push(material);
    }

    if (date) {
        sql += ' AND date = ?';
        params.push(date);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(rows);
    });
});
app.get('/delete_bill_entries', (req, res) => {
    db.all('SELECT * FROM deleted_entries', (err, rows) => {
        if (err) {
            console.error('SQLite error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch deleted entries' });
        }
        res.status(200).json(rows); // Assuming `rows` is an array of deleted entries
    });
});



// Endpoint to delete a bill entry
app.delete('/delete_bill_entries/:id', (req, res) => {
    const billEntryId = req.params.id;

    // Select the bill entry to be deleted
    db.get('SELECT * FROM bill_entries WHERE id = ?', [billEntryId], (err, row) => {
        if (err) {
            console.error('SQLite select error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch bill entry' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Bill entry not found' });
        }

        // Insert the entry into deleted_entries table
        db.run(`INSERT INTO deleted_entries (project_name, date, material, description, bill_amount, payment_to, payment_by, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [row.project_name, row.date, row.material, row.description, row.bill_amount, row.payment_to, row.payment_by, row.payment_method],
            function(err) {
                if (err) {
                    console.error('SQLite insert error:', err.message);
                    return res.status(500).json({ error: 'Failed to move bill entry to deleted entries' });
                }

                // Delete the entry from bill_entries table
                db.run('DELETE FROM bill_entries WHERE id = ?', [billEntryId], function(err) {
                    if (err) {
                        console.error('SQLite delete error:', err.message);
                        return res.status(500).json({ error: 'Failed to delete bill entry' });
                    }

                    res.status(200).json({ message: 'Bill entry deleted successfully!' });
                });
            }
        );
    });
});




// Endpoint to restore a deleted entry
app.post('/restore_entry', (req, res) => {
    const { id } = req.body;

    db.get('SELECT * FROM deleted_entries WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Entry not found in deleted entries' });
        }

        const { project_name, material, description, bill_amount, payment_to, payment_by, payment_method, date } = row;

        db.run(`INSERT INTO bill_entries (project_name, material, description, bill_amount, payment_to, payment_by, payment_method, date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [project_name, material, description, bill_amount, payment_to, payment_by, payment_method, date],
            function(err) {
                if (err) {
                    console.error('SQLite insert error:', err.message);
                    return res.status(500).json({ error: 'Failed to restore bill entry' });
                }

                db.run('DELETE FROM deleted_entries WHERE id = ?', [id], function(err) {
                    if (err) {
                        console.error('SQLite delete error:', err.message);
                        return res.status(500).json({ error: 'Failed to remove entry from deleted entries' });
                    }

                    res.status(200).json({ message: 'Bill entry restored successfully!' });
                });
            }
        );
    });
});

app.get('/materials', (req, res) => {
    db.all('SELECT * FROM materials', (err, rows) => {
        if (err) {
            console.error('SQLite query error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(rows);
    });
});

// Endpoint to add a new material
app.post('/materials', (req, res) => {
    const { name } = req.body;

    db.run('INSERT INTO materials (name) VALUES (?)', [name], function(err) {
        if (err) {
            console.error('SQLite insert error:', err.message);
            return res.status(500).json({ error: 'Failed to add material' });
        }

        res.status(200).json({ message: 'Material added successfully!' });
    });
});

// Endpoint to update a material
app.put('/materials/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    db.run('UPDATE materials SET name = ? WHERE id = ?', [name, id], function(err) {
        if (err) {
            console.error('SQLite update error:', err.message);
            return res.status(500).json({ error: 'Failed to update material' });
        }

        res.status(200).json({ message: 'Material updated successfully!' });
    });
});

// Endpoint to delete a material
app.delete('/materials/:name', (req, res) => {
    const materialName = req.params.name;

    db.run('DELETE FROM materials WHERE name = ?', [materialName], function(err) {
        if (err) {
            console.error('SQLite delete error:', err.message);
            return res.status(500).json({ error: 'Failed to delete material' });
        }

        res.status(200).json({ message: 'Material deleted successfully!' });
    });
});
app.get('/bill_entries/:entryId', (req, res) => {
    const entryId = req.params.entryId;

    // Query database to get the bill entry details by entryId
    db.get(`SELECT * FROM bill_entries WHERE id = ?`, [entryId], (err, row) => {
        if (err) {
            console.error('SQLite select error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch bill entry' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Bill entry not found' });
        }

        // Return the bill entry details as JSON response
        res.status(200).json({
            id: row.id,
            date: row.date,
            material: row.material,
            description: row.description,
            billAmount: row.bill_amount,
            paymentTo: row.payment_to,
            paymentBy: row.payment_by,
            paymentMethod: row.payment_method
        });
    });
});
// Endpoint to update a bill entry
app.put('/bill_entries/:id', (req, res) => {
    const billEntryId = req.params.id;
    const { date, material, description, billAmount, paymentTo, paymentBy, paymentMethod } = req.body;

    db.run(`UPDATE bill_entries SET date = ?, material = ?, description = ?, bill_amount = ?, payment_to = ?, payment_by = ?, payment_method = ? WHERE id = ?`,
        [date, material, description, billAmount, paymentTo, paymentBy, paymentMethod, billEntryId],
        function(err) {
            if (err) {
                console.error('SQLite update error:', err.message);
                return res.status(500).json({ error: 'Failed to update bill entry' });
            }
            res.status(200).json({ message: 'Bill entry updated successfully!' });
        }
    );
});




app.get('/projects/:projectName/expected_budget', (req, res) => {
    const projectName = req.params.projectName;

    db.get('SELECT expected_budget FROM projects WHERE name = ?', [projectName], (err, row) => {
        if (err) {
            console.error('SQLite select error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch project budget' });
        }
        if (!row) {
            console.log('Project not found:', projectName);
            return res.status(404).json({ error: 'Project not found' });
        }
        console.log('Fetched project budget:', row.expected_budget); // Log fetched budget
        res.status(200).json({ expected_budget: row.expected_budget });
    });
});
app.use('/krishnalanka-data', express.static(path.join(__dirname, '/public/krishnalanka.xlsx')));
app.use('/suryaraopet-data', express.static(path.join(__dirname, '/public/suryaraopet_site.xlsx')));
app.use('/sivalayam-data', express.static(path.join(__dirname, '/public/sivalayam.xlsx')));


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
