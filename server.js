const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { login, verifyToken } = require('./auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = './blog.db';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create a new database or open an existing one
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the blog database.');
});

// Create articles table if it doesn't exist (Final Schema)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT,
        description TEXT,
        tags TEXT,
        content TEXT NOT NULL,
        readTime TEXT,
        createdAt TEXT NOT NULL
    )`);
});

// API routes
app.post('/login', login);

// GET all articles (with corrected sorting)
app.get('/api/articles', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;

    const sql = 'SELECT * FROM articles ORDER BY createdAt DESC LIMIT ? OFFSET ?';

    db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: { message: err.message } });
        }
        db.get('SELECT COUNT(*) as count FROM articles', (err, count) => {
            if (err) {
                return res.status(500).json({ error: { message: err.message } });
            }
            const results = {};
            if ((offset + limit) < count.count) {
                results.next = { page: page + 1, limit: limit };
            }
            if (offset > 0) {
                results.previous = { page: page - 1, limit: limit };
            }
            results.results = rows;
            // Set Cache-Control header as a backup server-side fix
            res.setHeader('Cache-Control', 'no-store');
            res.json(results);
        });
    });
});

// GET a single article
app.get('/api/articles/:id', (req, res) => {
    const articleId = parseInt(req.params.id);
    db.get('SELECT * FROM articles WHERE id = ?', [articleId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: { message: err.message } });
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: { message: 'Article not found' } });
        }
    });
});

// POST a new article (Final Version)
app.post('/api/articles', verifyToken, (req, res) => {
    const { title, category, description, tags, content, readTime, createdAt } = req.body;
    const tagsJson = JSON.stringify(tags);
    const sql = `INSERT INTO articles (title, category, description, tags, content, readTime, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [title, category, description, tagsJson, content, readTime, createdAt];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: { message: err.message } });
        }
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

// PUT (update) an article (Final Version)
app.put('/api/articles/:id', verifyToken, (req, res) => {
    const articleId = parseInt(req.params.id);
    const { title, category, description, tags, content, readTime } = req.body;
    const tagsJson = JSON.stringify(tags);
    const sql = `UPDATE articles SET 
                    title = ?, category = ?, description = ?, tags = ?, 
                    content = ?, readTime = ?
                 WHERE id = ?`;
    const params = [title, category, description, tagsJson, content, readTime, articleId];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: { message: err.message } });
        }
        if (this.changes > 0) {
            res.json({ id: articleId, ...req.body });
        } else {
            res.status(404).json({ error: { message: 'Article not found' } });
        }
    });
});

// DELETE an article
app.delete('/api/articles/:id', verifyToken, (req, res) => {
    const articleId = parseInt(req.params.id);
    db.run('DELETE FROM articles WHERE id = ?', [articleId], function (err) {
        if (err) {
            return res.status(500).json({ error: { message: err.message } });
        }
        if (this.changes > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: { message: 'Article not found' } });
        }
    });
});

// Serve the HTML files
app.get('/article/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'article.html'));
});

app.get('/contribute', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contribute.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});