const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ฐานข้อมูลจำลองสำหรับเก็บคีย์
let keys = [];

// ---------------- API จัดการคีย์ (ไม่ต้องใช้รหัสผ่าน) ----------------

// ดึงรายการคีย์ทั้งหมด
app.get('/api/keys', (req, res) => {
  return res.json({ ok: true, keys: keys, now: Date.now() });
});

// สร้างคีย์ใหม่
app.post('/api/keys', (req, res) => {
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
app.delete('/api/keys/:id', (req, res) => {
  const id = req.params.id;
  keys = keys.filter(k => k.id !== id);
  return res.json({ ok: true });
});

// รีเซ็ตล็อก HWID
app.post('/api/keys/:id/reset-lock', (req, res) => {
  const id = req.params.id;
  const key = keys.find(k => k.id === id);
  if (key) key.lock = null;
  return res.json({ ok: true });
});

// รีเซ็ตเวลาคีย์
app.post('/api/keys/:id/reset-time', (req, res) => {
  const id = req.params.id;
  const key = keys.find(k => k.id === id);
  if (key && key.days > 0) {
    key.createdAt = Date.now();
    key.expiresAt = key.createdAt + (key.days * 24 * 60 * 60 * 1000);
  }
  return res.json({ ok: true });
});

// ลบคีย์ที่หมดอายุทั้งหมด
app.post('/api/keys/delete-expired', (req, res) => {
  const now = Date.now();
  keys = keys.filter(k => k.days === 0 || k.expiresAt > now);
  return res.json({ ok: true });
});

// รีเซ็ตระบบทั้งหมด (ลบทุกคีย์)
app.delete('/api/keys', (req, res) => {
  keys = [];
  return res.json({ ok: true });
});

// เริ่มต้นรันเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
