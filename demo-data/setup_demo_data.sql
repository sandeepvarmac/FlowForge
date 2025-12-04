-- ============================================================
-- FlowForge Demo Data Setup Script
-- Creates products table in PostgreSQL for demo purposes
-- ============================================================

-- Create products table
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
    product_id VARCHAR(20) PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    unit_price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    supplier VARCHAR(100),
    brand VARCHAR(50),
    stock_quantity INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample products (Retail store inventory)
INSERT INTO products (product_id, product_name, category, subcategory, unit_price, cost_price, supplier, brand, stock_quantity, reorder_level, is_active) VALUES
-- Electronics
('ELEC-001', 'Wireless Bluetooth Headphones', 'Electronics', 'Audio', 79.99, 45.00, 'TechSupply Co', 'SoundMax', 150, 20, true),
('ELEC-002', 'USB-C Charging Cable 6ft', 'Electronics', 'Accessories', 12.99, 4.50, 'CablePro Inc', 'FastCharge', 500, 100, true),
('ELEC-003', 'Portable Power Bank 10000mAh', 'Electronics', 'Power', 34.99, 18.00, 'TechSupply Co', 'PowerMax', 200, 30, true),
('ELEC-004', 'Wireless Mouse', 'Electronics', 'Peripherals', 24.99, 12.00, 'TechSupply Co', 'ClickPro', 180, 25, true),
('ELEC-005', 'Mechanical Keyboard', 'Electronics', 'Peripherals', 89.99, 52.00, 'KeyboardMasters', 'TypeMaster', 75, 15, true),

-- Home & Kitchen
('HOME-001', 'Stainless Steel Water Bottle', 'Home & Kitchen', 'Drinkware', 19.99, 8.00, 'HomeGoods Direct', 'HydroMax', 300, 50, true),
('HOME-002', 'Non-Stick Frying Pan 12inch', 'Home & Kitchen', 'Cookware', 29.99, 14.00, 'KitchenPro Supply', 'ChefSelect', 120, 20, true),
('HOME-003', 'Glass Food Storage Set', 'Home & Kitchen', 'Storage', 24.99, 11.00, 'HomeGoods Direct', 'FreshKeep', 200, 30, true),
('HOME-004', 'Electric Kettle 1.7L', 'Home & Kitchen', 'Appliances', 39.99, 22.00, 'KitchenPro Supply', 'QuickBoil', 85, 15, true),
('HOME-005', 'Bamboo Cutting Board Set', 'Home & Kitchen', 'Tools', 18.99, 7.50, 'HomeGoods Direct', 'NatureCut', 150, 25, true),

-- Clothing
('CLTH-001', 'Cotton T-Shirt Basic', 'Clothing', 'Tops', 14.99, 5.00, 'TextilePlus', 'ComfortWear', 400, 80, true),
('CLTH-002', 'Denim Jeans Classic Fit', 'Clothing', 'Bottoms', 49.99, 22.00, 'FashionSource', 'DenimCo', 200, 40, true),
('CLTH-003', 'Running Shoes', 'Clothing', 'Footwear', 79.99, 38.00, 'SportsGear Inc', 'SpeedRun', 120, 20, true),
('CLTH-004', 'Winter Jacket', 'Clothing', 'Outerwear', 99.99, 48.00, 'FashionSource', 'WarmMax', 60, 15, true),
('CLTH-005', 'Athletic Socks 6-Pack', 'Clothing', 'Accessories', 12.99, 4.00, 'TextilePlus', 'ComfortWear', 350, 60, true),

-- Health & Beauty
('HLTH-001', 'Organic Shampoo 16oz', 'Health & Beauty', 'Hair Care', 12.99, 5.00, 'NaturalCare Co', 'PureGlow', 250, 40, true),
('HLTH-002', 'Vitamin D3 Supplements', 'Health & Beauty', 'Vitamins', 18.99, 8.00, 'HealthFirst', 'VitaPlus', 180, 30, true),
('HLTH-003', 'Facial Moisturizer SPF30', 'Health & Beauty', 'Skincare', 24.99, 10.00, 'NaturalCare Co', 'SkinShield', 140, 25, true),
('HLTH-004', 'Electric Toothbrush', 'Health & Beauty', 'Oral Care', 49.99, 25.00, 'DentalPro', 'CleanSmile', 90, 15, true),
('HLTH-005', 'Hand Sanitizer 8oz', 'Health & Beauty', 'Personal Care', 5.99, 1.50, 'HealthFirst', 'CleanGuard', 600, 100, true),

-- Office Supplies
('OFFC-001', 'Ballpoint Pens 12-Pack', 'Office Supplies', 'Writing', 8.99, 2.50, 'OfficeMart', 'WriteWell', 400, 80, true),
('OFFC-002', 'Spiral Notebook 5-Subject', 'Office Supplies', 'Paper', 6.99, 2.00, 'OfficeMart', 'NotePro', 350, 70, true),
('OFFC-003', 'Desk Organizer Set', 'Office Supplies', 'Organization', 19.99, 8.00, 'OfficeMart', 'DeskTidy', 120, 20, true),
('OFFC-004', 'Stapler Heavy Duty', 'Office Supplies', 'Tools', 14.99, 6.00, 'OfficeMart', 'StaplePro', 150, 25, true),
('OFFC-005', 'Printer Paper 500 Sheets', 'Office Supplies', 'Paper', 9.99, 4.00, 'PaperSource', 'BrightWhite', 280, 50, true);

-- Verify data
SELECT 'Products table created with ' || COUNT(*) || ' rows' AS status FROM products;

-- Show sample data
SELECT product_id, product_name, category, unit_price, stock_quantity
FROM products
ORDER BY category, product_name
LIMIT 10;
