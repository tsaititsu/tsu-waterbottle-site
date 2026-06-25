-- 開運商品郵局寄送資料欄位
-- 注意：
-- 目前 public.orders 不存在。
-- 現階段付款 / 訂單紀錄表為 public.payments。
-- 若未來另外建立 public.orders，再視情況搬移。

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS shipping_method text;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS shipping_info jsonb;

COMMENT ON COLUMN public.payments.shipping_method IS '配送方式，例如 post_office。';

COMMENT ON COLUMN public.payments.shipping_info IS '配送資料，例如收件人姓名、電話、郵遞區號、縣市、區域、詳細地址、備註。';
