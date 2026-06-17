# Supabase 設定步驟

這份是 WATERBOTTLE 正式網站未來資料庫的設定順序。

## 1. 建立 Supabase 專案

1. 前往 Supabase。
2. 建立新專案。
3. 專案名稱可用 `tsu-waterbottle-site`。
4. Region 建議選離台灣近的區域，例如 Tokyo / Singapore。
5. Database password 請自己保存好，不要公開貼出。

## 2. 建立資料表

進入 Supabase 專案後：

1. 點左側 `SQL Editor`。
2. 新增 Query。
3. 貼上 `supabase/schema.sql` 的全部內容。
4. 按 Run。
5. 再新增一個 Query。
6. 貼上 `supabase/seed.sql` 的全部內容。
7. 按 Run。

## 3. 要放進網站的環境變數

在 Supabase 專案裡找：

`Project Settings` -> `API`

會看到：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

用途：

- `NEXT_PUBLIC_SUPABASE_URL`：網站前端可用。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：網站前端可用。
- `SUPABASE_SERVICE_ROLE_KEY`：只能放伺服器端，不能公開。

## 4. 後台管理員

正式登入系統接好後，需要把你的會員設成管理員：

```sql
update public.profiles
set is_admin = true
where email = '你的管理員 email';
```

## 5. 網域設定

正式網站會接到：

`tsu-waterbottle.com`

通常流程是：

1. 先把網站部署到 Vercel。
2. 在 Vercel 專案加入網域 `tsu-waterbottle.com`。
3. 到 Cloudflare 的 DNS 新增 Vercel 指定的 DNS 記錄。
4. 等 Vercel 顯示網域驗證成功。

Supabase 是資料庫，不是網站主機，所以網域本身通常接到 Vercel；Supabase 只負責會員、預約、付款紀錄、命盤紀錄、占卜紀錄。
