-- DENE CRM Database Schema
-- Database: mtcrm

CREATE DATABASE IF NOT EXISTS mtcrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mtcrm;

-- ระดับสมาชิก (Loyalty Tiers)
CREATE TABLE IF NOT EXISTS tiers (
  id          VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  name        ENUM('Standard','Silver','Gold','Platinum') NOT NULL,
  min_points  INT            NOT NULL DEFAULT 0,
  multiplier  DECIMAL(4,2)   NOT NULL DEFAULT 1.00,
  baht_per_point DECIMAL(12,2) NOT NULL DEFAULT 10.00,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  duration_days INT          NOT NULL DEFAULT 365,
  color       VARCHAR(7)     NOT NULL DEFAULT '#b9b99d',
  benefits    JSON           NOT NULL DEFAULT (JSON_ARRAY()),
  sort_order  INT            NOT NULL DEFAULT 0,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tier_company_name (company_id, name),
  KEY idx_tier_company_sort (company_id, sort_order),
  KEY idx_tier_company_points (company_id, min_points)
) ENGINE=InnoDB;

-- บัญชีล็อกอินสำหรับแอดมิน / พนักงาน
CREATE TABLE IF NOT EXISTS staff_accounts (
  id             VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  username       VARCHAR(100)   NOT NULL,
  display_name   VARCHAR(200)   NOT NULL,
  password_hash  VARCHAR(255)   NOT NULL,
  role           ENUM('admin','manager','user') NOT NULL DEFAULT 'user',
  is_active      TINYINT(1)     NOT NULL DEFAULT 1,
  last_login_at  DATETIME       NULL,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_company_username (company_id, username),
  KEY idx_staff_company_role (company_id, role),
  KEY idx_staff_company_active (company_id, is_active)
) ENGINE=InnoDB;

-- ข้อมูลลูกค้า/สมาชิก
CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  company_id   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  line_id      VARCHAR(100)  NOT NULL,
  name         VARCHAR(200)  NOT NULL,
  phone        VARCHAR(20)   NULL,
  email        VARCHAR(200)  NULL,
  avatar       VARCHAR(500)  NULL DEFAULT 'https://i.pravatar.cc/150',
  birthday     DATE          NULL,
  tier         ENUM('Standard','Silver','Gold','Platinum') NOT NULL DEFAULT 'Standard',
  tier_expires_at DATETIME   NULL,
  points       INT           NOT NULL DEFAULT 0,
  total_spent  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  joined_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_company_line_id (company_id, line_id),
  KEY idx_user_company_tier (company_id, tier),
  KEY idx_user_company_points (company_id, points)
) ENGINE=InnoDB;

-- ตั้งค่าระดับบริษัท
CREATE TABLE IF NOT EXISTS company_settings (
  company_id        TINYINT UNSIGNED NOT NULL,
  point_expiry_days  INT            NOT NULL DEFAULT 365,
  updated_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id)
) ENGINE=InnoDB;

-- สินค้า
CREATE TABLE IF NOT EXISTS products (
  id           VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  company_id   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  name         VARCHAR(200)  NOT NULL,
  description  TEXT          NULL,
  price        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  category     VARCHAR(120)  NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_company_active (company_id, is_active),
  KEY idx_products_company_name (company_id, name)
) ENGINE=InnoDB;

-- โปรโมชั่น
CREATE TABLE IF NOT EXISTS promotions (
  id              VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  title           VARCHAR(300)   NOT NULL,
  description     TEXT           NULL,
  points_required INT            NOT NULL DEFAULT 0,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  redeem_mode     ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  expires_at      DATETIME       NULL,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_promotions_company_status (company_id, status)
) ENGINE=InnoDB;

-- ออเดอร์ / ประวัติการสั่งซื้อ
CREATE TABLE IF NOT EXISTS orders (
  id            VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  order_ref     VARCHAR(50)    NOT NULL,
  user_id       VARCHAR(36)    NOT NULL,
  amount        DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  discount      DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  discount_mode ENUM('manual','member') NOT NULL DEFAULT 'manual',
  points_earned INT            NOT NULL DEFAULT 0,
  slip_url      VARCHAR(500)   NULL,
  status        ENUM('pending','paid','cancel') NOT NULL DEFAULT 'pending',
  note          TEXT           NULL,
  ordered_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_company_ref (company_id, order_ref),
  KEY idx_order_company_user (company_id, user_id),
  KEY idx_order_company_status (company_id, status),
  KEY idx_order_company_ordered_at (company_id, ordered_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- รายการสินค้าในออเดอร์
CREATE TABLE IF NOT EXISTS order_items (
  id           VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  company_id   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  order_id     VARCHAR(36)   NOT NULL,
  product_id   VARCHAR(36)   NULL,
  name         VARCHAR(300)  NOT NULL,
  unit_price   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  qty          INT           NOT NULL DEFAULT 1,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_company_order (company_id, order_id),
  KEY idx_order_items_company_product (company_id, product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ประวัติคะแนน (Earn / Redeem)
CREATE TABLE IF NOT EXISTS point_transactions (
  id          VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  user_id     VARCHAR(36)    NOT NULL,
  type        ENUM('earn','redeem') NOT NULL,
  points      INT            NOT NULL,
  points_remaining INT       NOT NULL DEFAULT 0,
  ref_id      VARCHAR(36)    NULL COMMENT 'order_id หรือ redemption_id',
  note        VARCHAR(300)   NULL,
  expires_at  DATETIME       NULL,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pt_company_user (company_id, user_id),
  KEY idx_pt_company_type (company_id, type),
  KEY idx_pt_company_expiry (company_id, user_id, expires_at),
  CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- การแลกโปรโมชั่น
CREATE TABLE IF NOT EXISTS redemptions (
  id            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  company_id    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  user_id       VARCHAR(36)  NOT NULL,
  promotion_id  VARCHAR(36)  NOT NULL,
  points_used   INT          NOT NULL,
  redeemed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_red_company_user (company_id, user_id),
  KEY idx_red_company_promotion (company_id, promotion_id),
  CONSTRAINT fk_rdm_user      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_rdm_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- คำขอแลกแต้มแบบรออนุมัติ
CREATE TABLE IF NOT EXISTS promotion_redemption_requests (
  id               VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  user_id          VARCHAR(36)    NOT NULL,
  promotion_id     VARCHAR(36)    NOT NULL,
  promotion_title  VARCHAR(300)   NOT NULL,
  points_required  INT            NOT NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      DATETIME       NULL,
  reviewed_by      VARCHAR(36)    NULL,
  review_note      VARCHAR(300)   NULL,
  PRIMARY KEY (id),
  KEY idx_req_company_user (company_id, user_id),
  KEY idx_req_company_promotion (company_id, promotion_id),
  KEY idx_req_company_status (company_id, status),
  KEY idx_req_company_requested_at (company_id, requested_at),
  KEY idx_req_company_user_status (company_id, user_id, status),
  CONSTRAINT fk_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_req_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_req_staff FOREIGN KEY (reviewed_by) REFERENCES staff_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ข้อความ Chat (LINE Bot)
CREATE TABLE IF NOT EXISTS chat_messages (
  id         VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  company_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  user_id    VARCHAR(36)   NOT NULL,
  sender     ENUM('user','bot') NOT NULL,
  type       ENUM('text','image','slip_result') NOT NULL DEFAULT 'text',
  text       TEXT          NULL,
  image_url  VARCHAR(500)  NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_company_user (company_id, user_id),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===== Seed Data =====

INSERT IGNORE INTO tiers (id, company_id, name, min_points, multiplier, baht_per_point, discount_percent, duration_days, color, benefits, sort_order) VALUES
  ('dene_t1',   1, 'Standard', 0,    1.00, 10.00, 0.00, 365, '#b9b99d', JSON_ARRAY('สะสมแต้มทุกการสั่งซื้อ'), 1),
  ('dene_t2',   1, 'Silver',   500,  1.20, 10.00, 0.00, 365, '#dad3cd', JSON_ARRAY('คูปองวันเกิด'), 2),
  ('dene_t3',   1, 'Gold',     2000, 1.50, 10.00, 5.00,  365, '#c09e85', JSON_ARRAY('ของขวัญปีใหม่'), 3),
  ('dene_t4',   1, 'Platinum', 5000, 2.00, 10.00, 10.00, 365, '#2c5243', JSON_ARRAY('ของขวัญพิเศษ'), 4),
  ('kefera_t1', 2, 'Standard', 0,    1.00, 10.00, 0.00, 365, '#b9b99d', JSON_ARRAY('สะสมแต้มทุกการสั่งซื้อ'), 1),
  ('kefera_t2', 2, 'Silver',   500,  1.20, 10.00, 0.00, 365, '#dad3cd', JSON_ARRAY('คูปองวันเกิด'), 2),
  ('kefera_t3', 2, 'Gold',     2000, 1.50, 10.00, 5.00,  365, '#c09e85', JSON_ARRAY('ของขวัญปีใหม่'), 3),
  ('kefera_t4', 2, 'Platinum', 5000, 2.00, 10.00, 10.00, 365, '#2c5243', JSON_ARRAY('ของขวัญพิเศษ'), 4);

INSERT IGNORE INTO company_settings (company_id, point_expiry_days) VALUES
  (1, 365),
  (2, 365);

INSERT IGNORE INTO promotions (id, company_id, title, description, points_required, status, redeem_mode) VALUES
  ('dene_p1',   1, 'ส่วนลด 100 บาท',     'ใช้ 500 แต้มเพื่อแลกรับส่วนลด 100 บาท สำหรับบิลถัดไป', 500,  'active',   'auto'),
  ('dene_p2',   1, 'ฟรีเครื่องดื่ม 1 แก้ว', 'แลก 200 แต้ม รับฟรีเครื่องดื่มมูลค่าไม่เกิน 80 บาท', 200,  'active',   'auto'),
  ('dene_p3',   1, 'อัพเกรดเป็น Gold ฟรี', 'ใช้ 3000 แต้ม อัพเกรดเป็นระดับ Gold 1 ปี', 3000, 'inactive', 'auto'),
  ('kefera_p1', 2, 'ส่วนลด 100 บาท',     'ใช้ 500 แต้มเพื่อแลกรับส่วนลด 100 บาท สำหรับบิลถัดไป', 500,  'active',   'auto'),
  ('kefera_p2', 2, 'ฟรีเครื่องดื่ม 1 แก้ว', 'แลก 200 แต้ม รับฟรีเครื่องดื่มมูลค่าไม่เกิน 80 บาท', 200,  'active',   'auto'),
  ('kefera_p3', 2, 'อัพเกรดเป็น Gold ฟรี', 'ใช้ 3000 แต้ม อัพเกรดเป็นระดับ Gold 1 ปี', 3000, 'inactive', 'auto');
