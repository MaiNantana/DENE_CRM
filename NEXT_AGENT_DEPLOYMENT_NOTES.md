# Deployment Notes for the Next Codex

Project: `DENE_CRM`
Target URL: `http://crm.serveftp.com/admin`
Target host: `hr.iexcellence.cloud`
Target IP: `13.55.200.177`
Target folder on server: `C:\Program Files\iisnode\www\crm`

---

## วิธี Deploy (ปกติ — แนะนำ)

**รันจาก bash เท่านั้น ห้ามรันจาก PowerShell โดยตรง**

```bash
cd /d/dev/aruns/crm/DENE_CRM
DEPLOY_PASSWORD='<server password>' bash scripts/deploy/prod_windows_static.sh
```

Script จะทำครบ: build → upload ผ่าน SSH → backup เดิม → deploy `dist/` + `server/` + `web.config` ไปที่ IIS → ตรวจสอบ URL

ตรวจสอบอย่างเดียว (ไม่ deploy):
```bash
DEPLOY_PASSWORD='<server password>' bash scripts/deploy/prod_windows_static.sh --check-only
```

Deploy โดยไม่ build ใหม่ (ใช้ dist ที่มีอยู่):
```bash
DEPLOY_PASSWORD='<server password>' bash scripts/deploy/prod_windows_static.sh --skip-build
```

---

## สิ่งที่ app เป็น

- Vite + React frontend + Node.js backend ผ่าน iisnode
- Deploy ทั้ง `dist/` และ `server/` พร้อม `web.config`
- ใช้ client-side router สำหรับ `/admin` และ `/liff/*`
- IIS ต้อง rewrite path ที่ไม่ใช่ `/api/*` และไม่ใช่ไฟล์จริงไปที่ `index.html`

Build output:
- `dist/index.html`
- `dist/assets/index-*.css`
- `dist/assets/index-*.js`

---

## Credential notes

- username: `Administrator`
- password: รับจาก user ใน chat — **ห้าม commit ลงไฟล์**

---

## ข้อควรระวัง: SSH จาก PowerShell

รันสคริปต์ผ่าน `$env:DEPLOY_PASSWORD = "..." ; bash scripts/...` ใน PowerShell แล้ว SSH ค้าง
สาเหตุ: PowerShell set `DISPLAY=:0` ไม่ได้ผลและ `setsid` ไม่มีใน environment นี้
**แก้:** รัน bash โดยตรงจาก Git Bash terminal หรือบอก Codex ให้ใช้ Bash tool (ไม่ใช่ PowerShell tool)

---

## RDP Fallback (ถ้า SSH ใช้ไม่ได้)

1. บันทึก credentials และเปิด RDP:
   ```powershell
   cmdkey /generic:"13.55.200.177" /user:"Administrator" /pass:"<password>"
   mstsc "d:\dev\aruns\crm\DENE_CRM\crm-deploy.rdp"
   ```
2. บน server — เปิด PowerShell as Administrator แล้วรัน:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "\\tsclient\D\dev\aruns\crm\DENE_CRM\crm-deploy-package\deploy_crm_zip_on_server.ps1"
   ```
   (`\\tsclient\D` = D: drive ของเครื่อง local ที่ redirect เข้า RDP session)
3. ลบ credentials หลังเสร็จ:
   ```powershell
   cmdkey /delete:"13.55.200.177"
   ```
4. เช็ค `http://crm.serveftp.com/`

ก่อน RDP ต้องเตรียม deploy package ให้ทันสมัยก่อน:
```bash
npm run build
# จากนั้น PowerShell:
Compress-Archive -Path "dist\*" -DestinationPath "crm-dist.zip" -Force
Copy-Item "crm-dist.zip" "crm-deploy-package\crm-dist.zip" -Force
# ถ้า backend เปลี่ยนด้วย ให้คัดลอกโฟลเดอร์ server และ web.config เข้า package ด้วย
Copy-Item "server" "crm-deploy-package\server" -Recurse -Force
Copy-Item "web.config" "crm-deploy-package\web.config" -Force
Compress-Archive -Path "crm-deploy-package\*" -DestinationPath "crm-deploy-package.zip" -Force
```

---

## Network / Access

- `crm.serveftp.com` → `hr.iexcellence.cloud` → `iexcellence.cloud` → `13.55.200.177`
- Port ที่ใช้งานได้: `22` (SSH), `80`, `443`, `3389` (RDP)
- Port ที่ปิด: `21`, `445`, `5985`, `5986`

---

## Checklist หลัง Deploy

- [ ] `http://crm.serveftp.com/` redirect ไป `/admin`
- [ ] `http://crm.serveftp.com/admin` โหลดหน้าแอดมินได้
- [ ] `http://crm.serveftp.com/liff` เปิดหน้า LIFF gateway ได้
- [ ] `index.html` อยู่ที่ root ของ `C:\Program Files\iisnode\www\crm` (ไม่ใช่ใน subfolder)
- [ ] `/assets/*.js` และ `/assets/*.css` โหลดได้
