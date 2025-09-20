// server.js
import express from 'express';
import db from './db.js';

const app = express();
app.use(express.json());

// Simple helpers
const pickEmployee = (obj = {}) => {
  const {
    UserId, FirstName, LastName, EmployeeType,
    Email, BeginDate, JobTitle, Manager
  } = obj;
  return { UserId, FirstName, LastName, EmployeeType, Email, BeginDate, JobTitle, Manager };
};

const requiredFields = ['FirstName', 'LastName', 'EmployeeType', 'Email', 'BeginDate', 'JobTitle'];

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// List + filters (by EmployeeType, Manager, search by name/email)
app.get('/employees', (req, res) => {
  const { type, manager, q, limit = 50, offset = 0 } = req.query;

  const clauses = [];
  const params = {};

  if (type) {
    clauses.push('EmployeeType = @type');
    params.type = String(type);
  }
  if (manager) {
    clauses.push('Manager = @manager');
    params.manager = String(manager);
  }
  if (q) {
    clauses.push('(FirstName LIKE @like OR LastName LIKE @like OR Email LIKE @like)');
    params.like = `%${q}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT UserId, FirstName, LastName, EmployeeType, Email, BeginDate, JobTitle, Manager
    FROM Employees
    ${where}
    ORDER BY UserId ASC
    LIMIT @limit OFFSET @offset
  `;

  params.limit = Number(limit);
  params.offset = Number(offset);

  const rows = db.prepare(sql).all(params);
  res.json(rows);
});

// Get by id
app.get('/employees/:id', (req, res) => {
  const row = db.prepare(`
    SELECT UserId, FirstName, LastName, EmployeeType, Email, BeginDate, JobTitle, Manager
    FROM Employees WHERE UserId = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Create
app.post('/employees', (req, res) => {
  const body = pickEmployee(req.body);

  // Basic validation
  const missing = requiredFields.filter((f) => !body[f]);
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const info = db.prepare(`
      INSERT INTO Employees
      (FirstName, LastName, EmployeeType, Email, BeginDate, JobTitle, Manager)
      VALUES (@FirstName, @LastName, @EmployeeType, @Email, @BeginDate, @JobTitle, @Manager)
    `).run(body);

    const created = db.prepare(`
      SELECT UserId, FirstName, LastName, EmployeeType, Email, BeginDate, JobTitle, Manager
      FROM Employees WHERE UserId = ?
    `).get(info.lastInsertRowid);

    res.status(201).json(created);
  } catch (e) {
    if (String(e.message).includes('UNIQUE constraint failed: Employees.Email')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Replace (PUT)
app.put('/employees/:id', (req, res) => {
  const body = pickEmployee(req.body);

  const missing = requiredFields.filter((f) => !body[f]);
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const stmt = db.prepare(`
      UPDATE Employees SET
        FirstName=@FirstName, LastName=@LastName, EmployeeType=@EmployeeType,
        Email=@Email, BeginDate=@BeginDate, JobTitle=@JobTitle, Manager=@Manager
      WHERE UserId=@UserId
    `);
    const result = stmt.run({ ...body, UserId: req.params.id });

    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    const updated = db.prepare(`SELECT * FROM Employees WHERE UserId = ?`).get(req.params.id);
    res.json(updated);
  } catch (e) {
    if (String(e.message).includes('UNIQUE constraint failed: Employees.Email')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Partial update (PATCH)
app.patch('/employees/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM Employees WHERE UserId = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const merged = { ...existing, ...pickEmployee(req.body) };

  try {
    const stmt = db.prepare(`
      UPDATE Employees SET
        FirstName=@FirstName, LastName=@LastName, EmployeeType=@EmployeeType,
        Email=@Email, BeginDate=@BeginDate, JobTitle=@JobTitle, Manager=@Manager
      WHERE UserId=@UserId
    `);
    stmt.run({ ...merged, UserId: req.params.id });
    const updated = db.prepare(`SELECT * FROM Employees WHERE UserId = ?`).get(req.params.id);
    res.json(updated);
  } catch (e) {
    if (String(e.message).includes('UNIQUE constraint failed: Employees.Email')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Delete
app.delete('/employees/:id', (req, res) => {
  const result = db.prepare('DELETE FROM Employees WHERE UserId = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Employees API running on http://localhost:${PORT}`);
});
