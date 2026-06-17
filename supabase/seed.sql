-- WATERBOTTLE initial data
-- Run this after schema.sql.

insert into public.consultation_plans (
  id,
  name,
  description,
  duration_minutes,
  price_twd,
  is_active,
  sort_order
)
values (
  'waterbottle-consultation-60',
  '水瓶先生論命',
  '一對一完整諮詢，可討論本命盤、感情、事業、財運與流年方向。',
  60,
  3600,
  true,
  1
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_twd = excluded.price_twd,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.booking_settings (
  id,
  timezone,
  available_slots,
  min_booking_hours,
  self_cancel_cutoff_hours,
  full_refund_cutoff_hours,
  official_line_url
)
values (
  true,
  'Asia/Taipei',
  array['13:00', '15:00', '17:00'],
  24,
  24,
  72,
  'https://lin.ee/6Tpje1P'
)
on conflict (id) do update
set
  timezone = excluded.timezone,
  available_slots = excluded.available_slots,
  min_booking_hours = excluded.min_booking_hours,
  self_cancel_cutoff_hours = excluded.self_cancel_cutoff_hours,
  full_refund_cutoff_hours = excluded.full_refund_cutoff_hours,
  official_line_url = excluded.official_line_url,
  updated_at = now();

insert into public.booking_notices (
  id,
  title,
  content,
  is_required,
  is_active
)
values (
  'waterbottle-consultation-notice',
  '水瓶先生論命須知',
  '◆關於改期或取消

1.改期：如需更改預約時間，請最晚於預約時間前一天告知，以便為您妥善安排。

2.取消：預約時間三天前取消，將全額退費，若是預約時間三天內則不予退費，但可更改時間，請提前告知。

3.遲到：為保障其他客戶權益，請務必準時赴約，遲到時間將照常計算，不另行補償。


◆關於紫微諮詢服務性質

1.有關任何資訊或諮詢服務，提到包括對解讀、心靈、療癒、健康、飲食、關係、家庭、財富、收入、運勢、未來發展等方面的建議，都旨在探討潛在可能性，不保證結果，亦不具任何醫療或治療效果。

2.諮詢結果僅供參考和協助，無法取代專業的醫療建議和診斷。若您有任何健康或心理需求，請務必諮詢國家核可的專業醫師。

3.請務必提供正確的出生時間及出生地，若因提供錯誤資訊導致解讀失準，恕不負責。',
  true,
  true
)
on conflict (id) do update
set
  title = excluded.title,
  content = excluded.content,
  is_required = excluded.is_required,
  is_active = excluded.is_active,
  updated_at = now();
