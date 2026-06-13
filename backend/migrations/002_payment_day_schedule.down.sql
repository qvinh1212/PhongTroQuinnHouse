UPDATE rooms
SET payment_day = CASE id
    WHEN '102' THEN 'Mùng 18'
    WHEN '103' THEN 'Mùng 5 -> 7'
    WHEN '201' THEN 'Mùng 8'
    WHEN '202' THEN 'Mùng 7 -> 9'
    WHEN '203' THEN 'Mùng 1'
    WHEN '301' THEN 'Mùng 15'
    WHEN '302' THEN 'Mùng 10'
    WHEN '303' THEN 'Mùng 23'
    WHEN 'Gác mái' THEN 'Mùng 15'
    ELSE payment_day
END
WHERE id IN ('102', '103', '201', '202', '203', '301', '302', '303', 'Gác mái');
