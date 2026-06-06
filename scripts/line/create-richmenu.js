/**
 * DENE CRM — LINE Rich Menu Creator
 *
 * ต้องใช้:
 *   LINE_CHANNEL_ACCESS_TOKEN=<token> node scripts/line/create-richmenu.js
 *   node scripts/line/create-richmenu.js <token>
 *
 * หรือตั้ง VITE_LIFF_ID เพื่อให้ปุ่มเปิดผ่าน LIFF URL จริง
 *   VITE_LIFF_ID=1234567890-AbCdEfGh node scripts/line/create-richmenu.js <token>
 *   node scripts/line/create-richmenu.js <token> 1234567890-AbCdEfGh
 *
 * หรือตั้ง LIFF_BASE_URL / APP_URL ถ้าต้องการใช้ URL ปกติแทน
 *   LIFF_BASE_URL=https://your-liff-url.com
 *   APP_URL=https://your-app-url.com
 */

import https  from 'node:https';
import fs     from 'node:fs';
import path   from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.argv[2];
const LIFF_ID = process.env.VITE_LIFF_ID || process.env.LIFF_ID || process.argv[3] || '';
const BASE_URL = (process.env.LIFF_BASE_URL || process.env.APP_URL || 'http://crm.serveftp.com').replace(/\/$/, '');
const LIFF_WEB_PATH = '/liff';
const PNG_PATH = path.join(__dirname, 'richmenu.png');
const SVG_PATH = path.join(__dirname, 'richmenu-template.svg');

if (!TOKEN) {
  console.error('❌  กรุณาตั้งค่า LINE_CHANNEL_ACCESS_TOKEN\n');
  console.error('   ตัวอย่าง:');
  console.error('   LINE_CHANNEL_ACCESS_TOKEN=your_token node scripts/line/create-richmenu.js\n');
  process.exit(1);
}

function buildActionUrl(route) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

  if (LIFF_ID) {
    return `https://liff.line.me/${LIFF_ID}${normalizedRoute}`;
  }
  return `${BASE_URL}${LIFF_WEB_PATH}${normalizedRoute}`;
}

// ─── Rich Menu JSON ───────────────────────────────────
// ขนาด 2500 × 1686 (full height) แบ่ง 3 ช่อง
const RICHMENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'DENE CRM Menu',
  chatBarText: 'เมนูสมาชิก DENE',
  areas: [
    {
      // ช่องซ้าย — สมัครสมาชิก
      bounds: { x: 0, y: 0, width: 833, height: 1686 },
      action: { type: 'uri', label: 'สมัครสมาชิก', uri: buildActionUrl('/register') },
    },
    {
      // ช่องกลาง — ส่งสลิป
      bounds: { x: 833, y: 0, width: 834, height: 1686 },
      action: { type: 'uri', label: 'ส่งสลิป', uri: buildActionUrl('/slip') },
    },
    {
      // ช่องขวา — บัตรสมาชิก
      bounds: { x: 1667, y: 0, width: 833, height: 1686 },
      action: { type: 'uri', label: 'บัตรสมาชิก', uri: buildActionUrl('/member') },
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────
function lineApi(method, path, body, isData = false) {
  return new Promise((resolve, reject) => {
    const host   = isData ? 'api-data.line.me' : 'api.line.me';
    const isJSON = body && !(body instanceof Buffer);
    const payload = isJSON ? Buffer.from(JSON.stringify(body)) : body;

    const opts = {
      hostname: host,
      path,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...(payload && isJSON ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...(payload && !isJSON ? { 'Content-Type': 'image/png', 'Content-Length': payload.length } : {}),
      },
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Generate rich menu image (PNG) ───────────────────
function buildRichMenuSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#253728"/>
      <stop offset="55%" stop-color="#2f4330"/>
      <stop offset="100%" stop-color="#1f2d21"/>
    </linearGradient>
    <linearGradient id="panelLeft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4efe6" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#f4efe6" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="panelCenter" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4efe6" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#f4efe6" stop-opacity="0.03"/>
    </linearGradient>
    <linearGradient id="panelRight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4efe6" stop-opacity="0.11"/>
      <stop offset="100%" stop-color="#f4efe6" stop-opacity="0.04"/>
    </linearGradient>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.18"/>
    </filter>
    <style>
      .brand {
        font-family: "Noto Sans Thai", "Tahoma", "Arial", sans-serif;
        font-weight: 700;
        fill: #f7f1e8;
        letter-spacing: 0.28em;
      }
      .title {
        font-family: "Noto Sans Thai", "Tahoma", "Arial", sans-serif;
        font-weight: 700;
        fill: #fffdf7;
      }
      .sub {
        font-family: "Noto Sans Thai", "Tahoma", "Arial", sans-serif;
        font-weight: 400;
        fill: #e8dfcf;
        opacity: 0.88;
      }
      .label {
        font-family: "Noto Sans Thai", "Tahoma", "Arial", sans-serif;
        font-weight: 700;
        fill: #f7f1e8;
        opacity: 0.72;
        letter-spacing: 0.18em;
      }
    </style>
  </defs>

  <rect width="2500" height="1686" fill="url(#bg)"/>
  <circle cx="2300" cy="260" r="240" fill="#f4efe6" opacity="0.06"/>
  <circle cx="180" cy="1480" r="260" fill="#f4efe6" opacity="0.05"/>
  <circle cx="540" cy="240" r="120" fill="#f4efe6" opacity="0.05"/>
  <circle cx="1940" cy="1330" r="180" fill="#f4efe6" opacity="0.04"/>

  <rect x="0" y="0" width="833" height="1686" fill="url(#panelLeft)" filter="url(#softShadow)"/>
  <rect x="833" y="0" width="834" height="1686" fill="url(#panelCenter)" filter="url(#softShadow)"/>
  <rect x="1667" y="0" width="833" height="1686" fill="url(#panelRight)" filter="url(#softShadow)"/>

  <line x1="833" y1="0" x2="833" y2="1686" stroke="#ffffff18" stroke-width="3"/>
  <line x1="1667" y1="0" x2="1667" y2="1686" stroke="#ffffff18" stroke-width="3"/>

  <text x="1250" y="120" class="brand" font-size="42" text-anchor="middle">DENE CRM</text>
  <text x="1250" y="170" class="sub" font-size="26" text-anchor="middle">เปิดเมนูสมาชิกได้ในครั้งเดียว</text>

  <g transform="translate(0 0)">
    <rect x="56" y="280" width="721" height="1020" rx="54" fill="#f4efe6" opacity="0.04" stroke="#f4efe6" stroke-opacity="0.16"/>
    <text x="416" y="360" class="label" font-size="22" text-anchor="middle">01</text>
    <circle cx="416" cy="560" r="132" fill="none" stroke="#f4efe6" stroke-opacity="0.25" stroke-width="18"/>
    <circle cx="416" cy="510" r="56" fill="none" stroke="#f4efe6" stroke-width="16"/>
    <path d="M310 710c22-92 84-144 106-144s84 52 106 144" fill="none" stroke="#f4efe6" stroke-width="16" stroke-linecap="round"/>
    <path d="M520 438h72v72M556 402v144" fill="none" stroke="#d9d0bf" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="416" y="930" class="title" font-size="78" text-anchor="middle">สมัครสมาชิก</text>
    <text x="416" y="1002" class="sub" font-size="34" text-anchor="middle">เปิดฟอร์มสมัครสมาชิก</text>
    <path d="M240 1112h352" stroke="#f4efe6" stroke-opacity="0.25" stroke-width="8" stroke-linecap="round"/>
    <text x="416" y="1188" class="sub" font-size="25" text-anchor="middle">เริ่มใช้งาน DENE CRM</text>
  </g>

  <g transform="translate(833 0)">
    <rect x="56" y="280" width="722" height="1020" rx="54" fill="#f4efe6" opacity="0.05" stroke="#f4efe6" stroke-opacity="0.16"/>
    <text x="417" y="360" class="label" font-size="22" text-anchor="middle">02</text>
    <rect x="272" y="408" width="290" height="400" rx="44" fill="none" stroke="#f4efe6" stroke-opacity="0.28" stroke-width="18"/>
    <path d="M417 500v122" fill="none" stroke="#f4efe6" stroke-width="18" stroke-linecap="round"/>
    <path d="M367 560l50-50 50 50" fill="none" stroke="#f4efe6" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="326" y="660" width="182" height="58" rx="22" fill="#f4efe6" opacity="0.12"/>
    <path d="M332 452h170" stroke="#d9d0bf" stroke-opacity="0.75" stroke-width="14" stroke-linecap="round"/>
    <path d="M332 720h170" stroke="#d9d0bf" stroke-opacity="0.65" stroke-width="14" stroke-linecap="round"/>
    <text x="417" y="930" class="title" font-size="78" text-anchor="middle">ส่งสลิป</text>
    <text x="417" y="1002" class="sub" font-size="34" text-anchor="middle">อัปโหลดหลักฐานการโอน</text>
    <path d="M241 1112h352" stroke="#f4efe6" stroke-opacity="0.25" stroke-width="8" stroke-linecap="round"/>
    <text x="417" y="1188" class="sub" font-size="25" text-anchor="middle">รอตรวจสอบจากแอดมิน</text>
  </g>

  <g transform="translate(1667 0)">
    <rect x="56" y="280" width="721" height="1020" rx="54" fill="#f4efe6" opacity="0.05" stroke="#f4efe6" stroke-opacity="0.16"/>
    <text x="417" y="360" class="label" font-size="22" text-anchor="middle">03</text>
    <rect x="250" y="414" width="334" height="300" rx="38" fill="none" stroke="#f4efe6" stroke-opacity="0.28" stroke-width="18"/>
    <path d="M278 486h278M278 548h220M278 610h170" stroke="#f4efe6" stroke-width="14" stroke-linecap="round" stroke-opacity="0.9"/>
    <circle cx="545" cy="610" r="40" fill="none" stroke="#d9d0bf" stroke-width="16"/>
    <path d="M525 610h40M545 590v40" stroke="#d9d0bf" stroke-width="14" stroke-linecap="round"/>
    <rect x="342" y="772" width="150" height="48" rx="18" fill="#f4efe6" opacity="0.12"/>
    <text x="417" y="930" class="title" font-size="78" text-anchor="middle">บัตรสมาชิก</text>
    <text x="417" y="1002" class="sub" font-size="34" text-anchor="middle">ดูแต้มและระดับสมาชิก</text>
    <path d="M241 1112h352" stroke="#f4efe6" stroke-opacity="0.25" stroke-width="8" stroke-linecap="round"/>
    <text x="417" y="1188" class="sub" font-size="25" text-anchor="middle">เช็กสิทธิ์ของคุณได้ทันที</text>
  </g>
</svg>`;
}

async function generateOrLoadImage() {
  if (fs.existsSync(PNG_PATH)) {
    console.log('📷  ใช้รูปจาก scripts/line/richmenu.png');
    return fs.readFileSync(PNG_PATH);
  }

  console.log('🎨  กำลัง generate รูป Rich Menu...');
  const svg = buildRichMenuSvg().trim();
  fs.writeFileSync(SVG_PATH, svg);
  console.log('💾  บันทึก SVG template ไว้ที่ scripts/line/richmenu-template.svg');

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync(PNG_PATH, png);
  console.log('✅  สร้าง PNG ไว้ที่ scripts/line/richmenu.png');
  return png;
}

// ─── Main ─────────────────────────────────────────────
async function main() {
  console.log('🚀  DENE CRM — LINE Rich Menu Creator');
  console.log('━'.repeat(50));
  console.log(`📡  Base URL: ${BASE_URL}`);
  console.log(`🔗  LIFF URL mode: ${LIFF_ID ? `enabled (${LIFF_ID})` : 'disabled'}`);
  console.log();

  // 1. Create Rich Menu
  console.log('1️⃣   สร้าง Rich Menu...');
  const createRes = await lineApi('POST', '/v2/bot/richmenu', RICHMENU);
  if (createRes.status !== 200) {
    console.error('❌  สร้าง Rich Menu ล้มเหลว:', createRes.body);
    process.exit(1);
  }
  const richMenuId = createRes.body.richMenuId;
  console.log(`✅  Rich Menu ID: ${richMenuId}`);

  // 2. Upload Image
  console.log('\n2️⃣   Upload รูป Rich Menu...');
  const imgBuf = await generateOrLoadImage();
  const uploadRes = await lineApi('POST', `/v2/bot/richmenu/${richMenuId}/content`, imgBuf, true);
  if (uploadRes.status !== 200) {
    console.warn('⚠️   Upload รูปล้มเหลว:', uploadRes.body);
    console.warn('    Rich Menu ถูกสร้างแล้วแต่ไม่มีรูป — กรุณา upload ด้วยตนเองผ่าน LINE Developers Console');
  } else {
    console.log('✅  Upload รูปสำเร็จ');
  }

  // 3. Set as Default
  console.log('\n3️⃣   ตั้งเป็น Default Rich Menu...');
  const defaultRes = await lineApi('POST', `/v2/bot/user/all/richmenu/${richMenuId}`, null);
  if (defaultRes.status !== 200) {
    console.error('❌  ตั้ง Default ล้มเหลว:', defaultRes.body);
  } else {
    console.log('✅  ตั้ง Default Rich Menu สำเร็จ');
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  console.log('🎉  เสร็จเรียบร้อย!\n');
  console.log('Rich Menu ID:', richMenuId);
  console.log();
  console.log('📋  Rich Menu Actions:');
  RICHMENU.areas.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.action.label.padEnd(14)} → ${a.action.uri}`);
  });
  console.log();
  if (LIFF_ID) {
    console.log('💡  เมนูนี้เปิดผ่าน LIFF URL จริงแล้ว');
    console.log(`    ตรวจให้แน่ใจว่า LIFF app endpoint ใน LINE Developers เป็น https://...${LIFF_WEB_PATH}`);
  } else {
    console.log('💡  หมายเหตุ: ถ้าต้องการใช้ LIFF URL จริงๆ (ให้ LINE auto-inject userId)');
    console.log('    ตั้งค่า VITE_LIFF_ID แล้วรันสคริปต์นี้ใหม่');
  }
  console.log('\n📖  จัดการ Rich Menu เพิ่มเติมที่:');
  console.log('    https://developers.line.biz/console/');

  // Save result
  const result = { richMenuId, createdAt: new Date().toISOString(), baseUrl: BASE_URL };
  fs.writeFileSync(path.join(__dirname, 'richmenu-result.json'), JSON.stringify(result, null, 2));
  console.log('\n💾  บันทึกผลลัพธ์ไว้ที่ scripts/line/richmenu-result.json');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
