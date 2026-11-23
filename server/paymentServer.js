import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { cafeTime, cartLines, priceCart } from '../src/data/cart.js'

const port = 8787
const apiUrl = 'https://api.yookassa.ru/v3'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function createYooClient({ shopId, secretKey }, fetchRequest = fetch) {
  const authorization = `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`
  return async (path, body, idempotenceKey) => {
    let response
    try {
      response = await fetchRequest(`${apiUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: authorization,
          ...(body && { 'Content-Type': 'application/json', 'Idempotence-Key': idempotenceKey }),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new ApiError(502, 'ЮKassa временно недоступна. Повторите запрос.')
    }
    if (!response.ok) {
      const status = response.status
      console.error(`ЮKassa: HTTP ${status}`)
      if (status >= 500 || status === 429) {
        throw new ApiError(502, 'ЮKassa временно недоступна. Повторите запрос.')
      }
      throw new ApiError(422, 'ЮKassa отклонила запрос. Проверьте настройки магазина и способ оплаты.')
    }
    return response.json()
  }
}

function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new ApiError(415, 'Ожидается запрос в формате JSON.')
  }
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 8192) {
      throw new ApiError(413, 'Запрос слишком большой.')
    }
  }
  try {
    const value = JSON.parse(body)
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch {
    // Report malformed and non-object JSON in the same way.
  }
  throw new ApiError(400, 'Неверный формат запроса.')
}

function snapshot(row, mode) {
  return {
    id: row.payment_id,
    orderNumber: row.number,
    amount: row.amount,
    confirmationUrl: row.confirmation_url,
    status: row.status,
    expiresAt: Number(row.expires_at),
    mode,
    refund: row.refund_id && { id: row.refund_id, status: row.refund_status, at: row.refund_date, amount: row.amount },
  }
}

function confirmPayment(payment, row, mode) {
  if (
    payment.test !== (mode === 'test') ||
    payment.amount?.value !== row.amount.toFixed(2) ||
    payment.amount?.currency !== 'RUB' ||
    payment.metadata?.order_number !== row.number ||
    !['pending', 'succeeded', 'canceled'].includes(payment.status) ||
    (payment.status === 'succeeded' && payment.paid !== true)
  ) {
    throw new ApiError(502, 'Данные платежа ЮKassa не совпадают с заказом.')
  }
}

function validTotal({ items, code, firstOrder, amount }) {
  if (!items || typeof items !== 'object' || Array.isArray(items) || typeof code !== 'string' || code.length > 32) return false
  const lines = cartLines(items)
  if (!lines.length || lines.some(({ variant, quantity }) => !variant || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)) return false
  return priceCart(lines, code, cafeTime(), firstOrder === true).total === amount
}

function tokenMatches(actual, expected) {
  if (!actual || !expected) return false
  const digest = (value) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(actual), digest(`Bearer ${expected}`))
}

async function performOnce(pending, key, request) {
  if (pending.has(key)) return pending.get(key)
  const operation = request()
  pending.set(key, operation)
  try {
    return await operation
  } finally {
    pending.delete(key)
  }
}

export function createPaymentServer({ provider, databasePath = ':memory:', mode = 'test', returnUrl, refundToken }) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkouts (
      key TEXT PRIMARY KEY, number TEXT NOT NULL, amount INTEGER NOT NULL, created_at TEXT NOT NULL,
      payment_id TEXT UNIQUE, status TEXT, confirmation_url TEXT, expires_at INTEGER,
      refund_key TEXT, refund_id TEXT, refund_status TEXT, refund_date TEXT
    )
  `)

  const find = db.prepare('SELECT * FROM checkouts WHERE key = ?')
  const insert = db.prepare('INSERT INTO checkouts (key, number, amount, created_at) VALUES (?, ?, ?, ?)')
  const setPayment = db.prepare('UPDATE checkouts SET payment_id = ?, status = ?, confirmation_url = ?, expires_at = ? WHERE key = ? AND payment_id IS NULL')
  const setStatus = db.prepare("UPDATE checkouts SET status = ? WHERE key = ? AND status = 'pending'")
  const reserveRefund = db.prepare("UPDATE checkouts SET refund_key = ?, refund_id = NULL, refund_status = NULL, refund_date = NULL WHERE key = ? AND (refund_key IS NULL OR refund_status = 'canceled')")
  const setRefund = db.prepare("UPDATE checkouts SET refund_id = ?, refund_status = ?, refund_date = ? WHERE key = ? AND refund_key = ? AND (refund_status IS NULL OR refund_status = 'pending')")
  const pendingPayments = new Map()
  const pendingRefunds = new Map()

  async function createPayment(body) {
    const { checkoutKey, orderNumber, amount } = body
    if (body.mode !== mode) throw new ApiError(409, 'Режим ЮKassa изменился. Вернитесь в корзину и проверьте заказ.')
    const maximum = mode === 'live' ? 700000 : 350000
    if (typeof checkoutKey !== 'string' || !uuid.test(checkoutKey) || typeof orderNumber !== 'string' || !/^[A-F0-9]{12}$/.test(orderNumber) || !Number.isSafeInteger(amount) || amount < 1 || amount > maximum) {
      throw new ApiError(400, 'Проверьте номер заказа и сумму оплаты.')
    }

    let row = find.get(checkoutKey)
    if (row) {
      if (row.number !== orderNumber || row.amount !== amount) throw new ApiError(409, 'Параметры этого заказа уже зафиксированы.')
      if (row.payment_id) return snapshot(row, mode)
    } else {
      if (!validTotal(body)) throw new ApiError(409, 'Итоговая сумма изменилась. Вернитесь в корзину и проверьте заказ.')
      insert.run(checkoutKey, orderNumber, amount, new Date().toISOString())
      row = find.get(checkoutKey)
    }

    return performOnce(pendingPayments, checkoutKey, () => registerPayment(row))
  }

  async function registerPayment(row) {
    const { key, number, amount } = row
    const payment = await provider('/payments', {
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      payment_method_data: { type: mode === 'live' ? 'sbp' : 'bank_card' },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: `Зерно и Ритм · заказ № ${number}`,
      metadata: { order_number: number },
    }, key)
    confirmPayment(payment, row, mode)
    const confirmationUrl = payment.confirmation?.confirmation_url
    if (typeof payment.id !== 'string' || (payment.status === 'pending' && !confirmationUrl)) {
      throw new ApiError(502, 'ЮKassa не вернула ссылку оплаты.')
    }

    if (confirmationUrl && new URL(confirmationUrl).protocol !== 'https:') throw new ApiError(502, 'Ссылка оплаты ЮKassa недействительна.')
    const created = Date.parse(payment.created_at || row.created_at)
    const expiresAt = Date.parse(payment.expires_at) || created + 60 * 60 * 1000
    setPayment.run(payment.id, payment.status, confirmationUrl ?? null, expiresAt, key)
    return snapshot(find.get(key), mode)
  }

  async function updateRefund(row) {
    if (!row.refund_id || row.refund_status !== 'pending') return
    const refund = await provider(`/refunds/${encodeURIComponent(row.refund_id)}`)
    recordRefund(refund, row)
  }

  function recordRefund(refund, row) {
    if (
      typeof refund.id !== 'string' || refund.payment_id !== row.payment_id ||
      refund.amount?.value !== row.amount.toFixed(2) || refund.amount?.currency !== 'RUB' ||
      !['pending', 'succeeded', 'canceled'].includes(refund.status)
    ) throw new ApiError(502, 'Данные возврата ЮKassa не совпадают с платежом.')
    setRefund.run(refund.id, refund.status, refund.created_at ?? null, row.key, row.refund_key)
  }

  async function status(body) {
    const row = lookup(body)
    if (row.status === 'pending') {
      const payment = await provider(`/payments/${encodeURIComponent(row.payment_id)}`)
      confirmPayment(payment, row, mode)
      if (payment.id !== row.payment_id) throw new ApiError(502, 'Получен другой платёж.')
      setStatus.run(payment.status, row.key)
    }
    await updateRefund(row)
    return snapshot(find.get(row.key), mode)
  }

  function lookup({ checkoutKey, payment_id: paymentId }) {
    const row = typeof checkoutKey === 'string' && uuid.test(checkoutKey) && find.get(checkoutKey)
    if (!row?.payment_id || row.payment_id !== paymentId) throw new ApiError(404, 'Платёж не найден.')
    return row
  }

  async function refundPayment(body, request) {
    if (mode === 'live' && !tokenMatches(request.headers.authorization, refundToken)) {
      throw new ApiError(403, 'Для рабочего возврата нужен доступ оператора.')
    }
    let row = lookup(body)
    if (body.amount !== row.amount) throw new ApiError(400, 'Сумма полного возврата должна совпадать с суммой оплаты.')
    await status(body)
    row = find.get(row.key)
    if (row.status !== 'succeeded') throw new ApiError(409, 'Возврат доступен после успешной оплаты.')
    if (row.refund_id && row.refund_status !== 'canceled') return snapshot(row, mode)

    reserveRefund.run(randomUUID(), row.key)
    row = find.get(row.key)
    return performOnce(pendingRefunds, row.refund_key, () => registerRefund(row))
  }

  async function registerRefund(row) {
    const refund = await provider('/refunds', {
      payment_id: row.payment_id,
      amount: { value: row.amount.toFixed(2), currency: 'RUB' },
    }, row.refund_key)
    recordRefund(refund, row)
    return snapshot(find.get(row.key), mode)
  }

  const routes = new Map([
    ['/api/create-qr-payment', createPayment],
    ['/api/payment-status', status],
    ['/api/refund-payment', refundPayment],
  ])
  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/api/payment-health') {
      json(response, 200, { available: Boolean(provider), ...(provider && { mode }) })
      return
    }
    const route = routes.get(request.url)
    if (!route || request.method !== 'POST') {
      json(response, 404, { error: 'Неизвестный запрос.' })
      return
    }
    try {
      if (!provider) throw new ApiError(503, 'Ключи ЮKassa ещё не настроены.')
      const result = await route(await readBody(request), request)
      json(response, 200, result)
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('Ошибка сервера платежей:', error.message)
      json(response, error.status || 500, { error: error.status ? error.message : 'Ошибка сервера платежей. Повторите запрос.' })
    }
  })
  server.on('close', () => db.close())
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.loadEnvFile('.env')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const {
    YOOKASSA_SHOP_ID: shopId,
    YOOKASSA_SECRET_KEY: secretKey,
    YOOKASSA_MODE: mode = 'test',
    YOOKASSA_RETURN_URL: returnUrl = 'http://127.0.0.1:5173/#payment-return',
    YOOKASSA_REFUND_TOKEN: refundToken,
  } = process.env
  if (!['test', 'live'].includes(mode) || Boolean(shopId) !== Boolean(secretKey) || (secretKey && !secretKey.startsWith(`${mode}_`))) {
    throw new Error('Укажите пару ключей ЮKassa для выбранного режима YOOKASSA_MODE.')
  }
  if (!['http:', 'https:'].includes(new URL(returnUrl).protocol) || (secretKey && mode === 'live' && !returnUrl.startsWith('https://'))) {
    throw new Error('YOOKASSA_RETURN_URL должен быть адресом сайта. Для рабочего магазина используйте HTTPS.')
  }
  if (refundToken && refundToken.length < 32) throw new Error('YOOKASSA_REFUND_TOKEN должен содержать не менее 32 символов.')
  const provider = shopId && createYooClient({ shopId, secretKey })
  const databaseName = createHash('sha256').update(`${mode}:${shopId ?? ''}`).digest('hex').slice(0, 16)
  const server = createPaymentServer({ provider, mode, returnUrl, refundToken, databasePath: resolve(`server/.payments/${databaseName}.sqlite`) })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Сервер оплаты: http://127.0.0.1:${port} · ${provider ? mode : 'ключи ЮKassa не заданы'}`)
  })
}
