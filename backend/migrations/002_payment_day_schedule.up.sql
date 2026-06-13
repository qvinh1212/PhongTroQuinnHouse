UPDATE rooms
SET payment_day = CASE id
    WHEN '102' THEN 'Ngày 18'
    WHEN '103' THEN 'Ngày 5 -> 7'
    WHEN '201' THEN 'Ngày 8'
    WHEN '202' THEN 'Ngày 7 -> 9'
    WHEN '203' THEN 'Ngày 1'
    WHEN '301' THEN 'Ngày 15'
    WHEN '302' THEN 'Ngày 10'
    WHEN '303' THEN 'Ngày 23'
    WHEN 'Gác mái' THEN 'Ngày 15'
    ELSE payment_day
END
WHERE id IN ('102', '103', '201', '202', '203', '301', '302', '303', 'Gác mái');
