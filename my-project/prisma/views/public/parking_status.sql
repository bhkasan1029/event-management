SELECT
  s.id,
  s.label,
  s.lot,
  s.is_vip,
  CASE
    WHEN (v.id IS NOT NULL) THEN 'occupied' :: text
    WHEN (r.id IS NOT NULL) THEN 'reserved_vip' :: text
    ELSE 'free' :: text
  END AS STATUS,
  v.plate,
  r.guest_name AS reserved_for
FROM
  (
    (
      parking_spots s
      LEFT JOIN vehicles v ON (
        (
          (v.spot_id = s.id)
          AND (v.exited_at IS NULL)
        )
      )
    )
    LEFT JOIN vip_reservations r ON (
      (
        (r.spot_id = s.id)
        AND (r.status = 'reserved' :: text)
        AND ((r.expected_arrival) :: date = CURRENT_DATE)
      )
    )
  );