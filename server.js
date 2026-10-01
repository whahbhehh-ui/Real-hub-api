const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ฐานข้อมูลจำลองสำหรับเก็บคีย์และ Token
let keys = [];
let sessions = {};
let pendingTickets = {};

// ตั้งค่ารหัสผ่านล็อกอิน 2 ชั้น (เปลี่ยนตรงนี้ได้ตามต้องการ)
const STEP1_KEY = "admin123";
const STEP2_KEY = "admin456";

// Middleware เช็คสิทธิ์ Admin
function authAdmin(req, res, next) {
  const token = req.headers['x-token'];
  if (token && sessions[token]) {
    return next();
  }
  return res.status(401).json({ ok: false, msg: "Unauthorized" });
}

// ---------------- API ล็อกอิน 2 ชั้น ----------------

// ด่านที่ 1
app.post('/api/admin/step1', (req, res) => {
  const { k } = req.body;
  if (k === STEP1_KEY) {
    const ticket = crypto.randomBytes(16).toString('hex');
    pendingTickets[ticket] = true;
    setTimeout(() => delete pendingTickets[ticket], 60000); // Ticket หมดอายุใน 1 นาที
    return res.json({ ok: true, ticket: ticket });
  }
  return res.status(400).json({ ok: false, msg: "คีย์ชั้นแรกไม่ถูกต้อง" });
});

// ด่านที่ 2
app.post('/api/admin/step2', (req, res) => {
  const { ticket, k } = req.body;
  if (!ticket || !pendingTickets[ticket]) {
    return res.status(400).json({ ok: false, msg: "Ticket หมดอายุหรือ, กรุณาเริ่มใหม่", restart: true });
  }
  if (k === STEP2_KEY) {
    delete pendingTickets[ticket];
    const token = crypto.randomBytes(24).toString('hex');
    sessions[token] = true;
    return res.json({ ok: true, token: token });
  }
  return res.status(400).json({ ok: false, msg: "คีย์ชั้นสองไม่ถูกต้อง" });
});

// ออกจากระบบ / ล็อกหน้า
app.post('/api/admin/logout', authAdmin, (req, res) => {
  const token = req.headers['x-token'];
  if (token) delete sessions[token];
  return res.json({ ok: true });
});

// ---------------- API จัดการคีย์ ----------------

// ดึงรายการคีย์ทั้งหมด
app.get('/api/keys', authAdmin, (req, res) => {
  return res.json({ ok: true, keys: keys, now: Date.now() });
});

// สร้างคีย์ใหม่
app.post('/api/keys', authAdmin, (req, res) => {
  const { days, qty, note } = req.body;
  const count = parseInt(qty, 10) || 1;
  const parsedDays = parseInt(days, 10);
  const made = [];

  for (let i = 0; i < count; i++) {
    const keyString = "REAL-" + crypto.randomBytes(4).toString('hex').toUpperCase() + "-" + crypto.randomBytes(4).toString('hex').toUpperCase();
    const createdAt = Date.now();
    const expiresAt = parsedDays > 0 ? createdAt + (parsedDays * 24 * 60 * 60 * 1000) : 0;

    const newKey = {
      id: crypto.randomBytes(8).toString('hex'),
      key: keyString,
      days: parsedDays,
      createdAt: createdAt,
      expiresAt: expiresAt,
      note: note || "",
      lock: null
    };

    keys.push(newKey);
    made.push(keyString);
  }

  return res.json({ ok: true, made: made });
});

// ลบคีย์เดี่ยว
app.delete('/api/keys/:id', authAdmin, (req, res) => {
  const id = req.params.id;
  keys = keys.filter(k => k.id !== id);
  return res.json({ ok: true });
});

// รีเซ็ตล็อก HWID
app.post('/api/keys/:id/reset-lock', authAdmin, (req, res) => {
  const id = req.params.id;
  const key = keys.find(k => k.id === id);
  if (key) key.lock = null;
  return res.json({ ok: true });
});

// รีเซ็ตเวลาคีย์
app.post('/api/keys/:id/reset-time', authAdmin, (req, res) => {
  const id = req.params.id;
  const key = keys.find(k => k.id === id);
  if (key && key.days > 0) {
    key.createdAt = Date.now();
    key.expiresAt = key.createdAt + (key.days * 24 * 60 * 60 * 1000);
  }
  return res.json({ ok: true });
});

// ลบคีย์ที่หมดอายุทั้งหมด
app.post('/api/keys/delete-expired', authAdmin, (req, res) => {
  const now = Date.now();
  keys = keys.filter(k => k.days === 0 || k.expiresAt > now);
  return res.json({ ok: true });
});

// รีเซ็ตระบบทั้งหมด (ลบทุกคีย์)
app.delete('/api/keys', authAdmin, (req, res) => {
  keys = [];
  return res.json({ ok: true });
});

// เริ่มต้นรันเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
