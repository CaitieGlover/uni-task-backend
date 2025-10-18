const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        module VARCHAR(255) NOT NULL,
        week VARCHAR(10) NOT NULL,
        due_date DATE,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDB();

// API Routes

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'University Task Tracker API is running!' });
});

// Get all modules
app.get('/api/modules', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM modules ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// Add a module
app.post('/api/modules', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO modules (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Module already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Failed to create module' });
    }
  }
});

// Delete a module
app.delete('/api/modules/:name', async (req, res) => {
  const { name } = req.params;
  try {
    // Delete associated tasks first
    await pool.query('DELETE FROM tasks WHERE module = $1', [name]);
    // Delete the module
    await pool.query('DELETE FROM modules WHERE name = $1', [name]);
    res.json({ message: 'Module deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete module' });
  }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Add a task
app.post('/api/tasks', async (req, res) => {
  const { title, module, week, due_date, completed } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, module, week, due_date, completed) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, module, week, due_date || null, completed || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, module, week, due_date, completed } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tasks SET title = $1, module = $2, week = $3, due_date = $4, completed = $5 WHERE id = $6 RETURNING *',
      [title, module, week, due_date || null, completed, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Toggle task completion
app.patch('/api/tasks/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE tasks SET completed = NOT completed WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

// Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.json({ message: 'Task deleted successfully' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});