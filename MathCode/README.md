# Power Arena Exponent Battle

เกมแบทเทิลเลขยกกำลังแบบสองทีม สำหรับครูเปิดเป็นห้องแข่งขันออนไลน์หรือใช้ใน Wi-Fi เดียวกัน

## รันบนเครื่องครู

```bash
npm start
```

จากนั้นเปิด URL ที่ Terminal แสดง เช่น `http://192.168.1.25:8787`

## เอาขึ้นออนไลน์ผ่าน GitHub + Render

GitHub Pages ใช้กับเกมนี้โดยตรงไม่ได้ เพราะเกมต้องมี server realtime สำหรับรับคำตอบและ sync คะแนนหลายเครื่อง ให้ใช้ GitHub เป็นที่เก็บโค้ด แล้วให้ Render รัน Node server แทน

1. สร้าง GitHub repository ใหม่
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repo
3. เข้า https://render.com
4. เลือก `New` -> `Web Service`
5. Connect GitHub repo ของเกมนี้
6. ตั้งค่า:
   - Build Command: `npm install`
   - Start Command: `npm start`
7. กด Deploy

เมื่อ deploy สำเร็จ Render จะให้ URL เช่น:

```text
https://power-arena-exponent-battle.onrender.com
```

ครูและนักเรียนใช้ URL เดียวกันได้เลย:

- ครูเข้า `Teacher Host`
- จอใหญ่เข้า `Scoreboard`
- นักเรียนเข้า `ทีมแดง` หรือ `ทีมน้ำเงิน`

## หมายเหตุสำหรับวันใช้งานจริง

- ใช้ Chrome หรือ Safari เวอร์ชันใหม่
- ถ้าใช้ Render free plan ครั้งแรกอาจต้องรอ server ตื่น 30-60 วินาที
- อย่าส่ง URL `localhost` หรือ `127.0.0.1` ให้นักเรียน เพราะเปิดได้เฉพาะเครื่องครู
