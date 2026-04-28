# notify-order Edge Function

## デプロイ手順

### 1. Supabase CLI でデプロイ
```bash
supabase functions deploy notify-order --project-ref pwuhhdzomaojjvwmjizw
```

### 2. Secrets を登録
```bash
supabase secrets set \
  LINE_CHANNEL_ACCESS_TOKEN="1pQhzBWX6FfHBEbaBacuqzFytfL+JL7sJ8P+cJDY7oeKluU7p9A9YqYAj1mEy3r7uM486mSU7TaPtCFCay4LF0I9g+HDxI82Mgx21ygA2KcBzwBUAsXR5lKaBwQ24qRqtg//+nYFNiT68prs4aqX6wdB04t89/1O/w1cDnyilFU=" \
  LINE_USER_ID="U08342f7dc4039c7fa5c4ccaf63fef3d7,U0d8576dd396f5b5634cfb3ebafd79d06" \
  RESEND_API_KEY="re_VkmsUnSa_5HzKurfPLRtzcZXvydRmLTxo" \
  RESEND_FROM_EMAIL="noreply@viehattava.com" \
  ADMIN_EMAILS="vie.tokuji@gmail.com" \
  --project-ref pwuhhdzomaojjvwmjizw
```

### 3. Database Webhook を設定（Supabase ダッシュボード）

1. Supabase ダッシュボード → Database → Webhooks
2. 「Create a new hook」をクリック
3. 以下を設定：
   - **Name**: `on_order_insert`
   - **Table**: `wholesale_orders`
   - **Events**: `INSERT` のみチェック
   - **Type**: Supabase Edge Functions
   - **Edge Function**: `notify-order`
4. 保存
