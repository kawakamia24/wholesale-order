/**
 * notify-order — Supabase Edge Function
 *
 * Database Webhook で orders テーブルの INSERT をトリガーに発火。
 * - LINE Messaging API で管理者2名に通知
 * - Resend で管理者メール＋発注店舗メールに通知
 *
 * 必要な Supabase Secrets (supabase secrets set で登録):
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   LINE_USER_ID               (カンマ区切り複数可)
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   ADMIN_EMAILS               (カンマ区切り複数可)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_TOKEN  = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
const LINE_IDS    = (Deno.env.get('LINE_USER_ID') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const RESEND_KEY  = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL  = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'
const ADMIN_MAILS = (Deno.env.get('ADMIN_EMAILS') ?? '').split(',').map(s => s.trim()).filter(Boolean)

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface OrderRecord {
  id: string
  store_id: string
  product_id: string
  quantity: number
  note: string | null
  status: string
  created_at: string
}

interface Store   { id: string; name: string; email: string }
interface Product { id: string; name: string; unit: string; price: number }

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const payload = await req.json()
  const order: OrderRecord = payload.record

  if (!order?.id) {
    return new Response('No record', { status: 400 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ROLE_KEY)

  // 店舗・商品情報を取得
  const [{ data: store }, { data: product }] = await Promise.all([
    sb.from('stores').select('id,name,email').eq('id', order.store_id).single<Store>(),
    sb.from('products').select('id,name,unit,price').eq('id', order.product_id).single<Product>(),
  ])

  if (!store || !product) {
    console.error('store or product not found', { store_id: order.store_id, product_id: order.product_id })
    return new Response('store/product not found', { status: 500 })
  }

  const subtotal   = product.price * order.quantity
  const orderedAt  = new Date(order.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const noteText   = order.note ? `\n備考：${order.note}` : ''

  await Promise.all([
    sendLine(store, product, order, subtotal, orderedAt, noteText),
    sendEmail(store, product, order, subtotal, orderedAt),
  ])

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── LINE 通知 ──────────────────────────────────────────────────
async function sendLine(
  store: Store, product: Product, order: OrderRecord,
  subtotal: number, orderedAt: string, noteText: string
) {
  if (!LINE_TOKEN || LINE_IDS.length === 0) {
    console.log('[LINE notify skipped]')
    return
  }

  const text = [
    `📦 【新規発注】`,
    `店舗　：${store.name}`,
    `商品　：${product.name}`,
    `数量　：${order.quantity} ${product.unit}`,
    `単価　：${product.price.toLocaleString()}円`,
    `小計　：${subtotal.toLocaleString()}円`,
    noteText,
    `日時　：${orderedAt}`,
  ].filter(Boolean).join('\n')

  await Promise.all(
    LINE_IDS.map(userId =>
      fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_TOKEN}`,
        },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
      })
    )
  )
}

// ── メール通知 ─────────────────────────────────────────────────
async function sendEmail(
  store: Store, product: Product, order: OrderRecord,
  subtotal: number, orderedAt: string
) {
  if (!RESEND_KEY) {
    console.log('[Email notify skipped]')
    return
  }

  const subject = `【発注受付】${product.name} / ${store.name}`
  const noteRow = order.note
    ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">備考</td><td>${order.note}</td></tr>`
    : ''
  const html = `
<p>以下の内容で発注を受け付けました。</p>
<table style="border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">発注日時</td><td>${orderedAt}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">店舗名</td><td>${store.name}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">商品名</td><td>${product.name}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">数量</td><td>${order.quantity} ${product.unit}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">単価</td><td>${product.price.toLocaleString()}円</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">小計</td><td>${subtotal.toLocaleString()}円</td></tr>
  ${noteRow}
</table>
<p><a href="https://kawakamia24.github.io/wholesale-order/admin/">管理ダッシュボードで確認する</a></p>
  `.trim()

  const recipients = [...ADMIN_MAILS]
  if (store.email && !recipients.includes(store.email)) {
    recipients.push(store.email)
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: recipients, subject, html }),
  })
}
