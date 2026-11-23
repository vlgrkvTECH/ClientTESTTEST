import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { test } from 'node:test'
import { createPaymentServer, createYooClient } from './paymentServer.js'

async function fixture(t, mode) {
  const events = []
  const refundToken = 'test-operator-credential-for-fixtures'
  let payment
  let refund
  const client = createYooClient({ shopId: '12345', secretKey: 'fixture-key' }, async (url, options) => {
    assert.ok(url.startsWith('https://api.yookassa.ru/v3/'))
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from('12345:fixture-key').toString('base64')}`)
    const path = new URL(url).pathname.slice(3)
    const body = options.body && JSON.parse(options.body)
    events.push({ path, body, idempotenceKey: options.headers['Idempotence-Key'] })
    if (path === '/payments') {
      payment = {
        id: randomUUID(), status: 'pending', paid: false, test: mode === 'test',
        amount: body.amount, metadata: body.metadata, created_at: new Date().toISOString(),
        confirmation: { confirmation_url: 'https://yoomoney.ru/fixture-payment' },
      }
      return Response.json(payment)
    }
    if (path === `/payments/${payment.id}`) return Response.json(payment)
    if (path === '/refunds') {
      refund = { id: randomUUID(), payment_id: body.payment_id, status: 'pending', amount: body.amount, created_at: new Date().toISOString() }
      return Response.json(refund)
    }
    if (path === `/refunds/${refund?.id}`) return Response.json(refund)
    throw new Error(`Неожиданный запрос ${path}`)
  })
  const server = createPaymentServer({ provider: client, mode, returnUrl: 'https://example.org/#payment-return', refundToken })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  async function post(path, body, token) {
    const response = await fetch(`${origin}/api/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  return {
    post, events, refundToken,
    pay() { payment.status = 'succeeded'; payment.paid = true },
    completeRefund() { refund.status = 'succeeded' },
  }
}

const order = (mode) => ({
  checkoutKey: randomUUID(), orderNumber: 'ABCDEF012345', amount: 470,
  items: { 'classic-750': 1 }, code: '', firstOrder: true, mode,
})

test('test shop: exact total, provider confirmation, and idempotent full refund', async (t) => {
  const fake = await fixture(t, 'test')
  const checkout = order('test')
  assert.equal((await fake.post('create-qr-payment', { ...checkout, amount: 1 })).status, 409)
  const created = await fake.post('create-qr-payment', checkout)
  assert.equal(created.status, 200)
  assert.equal(created.body.status, 'pending')
  assert.equal(created.body.amount, 470)
  assert.ok(created.body.expiresAt > Date.now())
  assert.equal((await fake.post('create-qr-payment', checkout)).body.id, created.body.id)
  assert.deepEqual(fake.events[0].body.amount, { value: '470.00', currency: 'RUB' })
  assert.equal(fake.events[0].body.payment_method_data.type, 'bank_card')
  assert.equal(fake.events[0].idempotenceKey, checkout.checkoutKey)
  assert.equal(fake.events.length, 1)

  const reference = { checkoutKey: checkout.checkoutKey, payment_id: created.body.id, amount: 470 }
  assert.equal((await fake.post('refund-payment', reference)).status, 409)
  assert.equal((await fake.post('payment-status', { ...reference, checkoutKey: randomUUID() })).status, 404)
  fake.pay()
  assert.equal((await fake.post('payment-status', reference)).body.status, 'succeeded')
  assert.equal((await fake.post('refund-payment', { ...reference, amount: 469 })).status, 400)
  const refunds = await Promise.all([fake.post('refund-payment', reference), fake.post('refund-payment', reference)])
  assert.equal(refunds[0].body.refund.status, 'pending')
  assert.equal(refunds[0].body.refund.id, refunds[1].body.refund.id)
  assert.equal(fake.events.filter(({ path }) => path === '/refunds').length, 1)
  fake.completeRefund()
  const current = await fake.post('payment-status', reference)
  assert.equal(current.body.refund.status, 'succeeded')
  assert.equal(current.body.refund.amount, 470)
  assert.equal((await fake.post('refund-payment', reference)).body.refund.id, current.body.refund.id)
})

test('live shop: SBP redirect and refund limited to an operator', async (t) => {
  const fake = await fixture(t, 'live')
  const checkout = order('live')
  assert.equal((await fake.post('create-qr-payment', { ...checkout, mode: 'test' })).status, 409)
  const created = await fake.post('create-qr-payment', checkout)
  assert.equal(created.status, 200)
  assert.equal(created.body.confirmationUrl, 'https://yoomoney.ru/fixture-payment')
  assert.deepEqual(fake.events[0].body.payment_method_data, { type: 'sbp' })
  assert.deepEqual(fake.events[0].body.confirmation, { type: 'redirect', return_url: 'https://example.org/#payment-return' })
  assert.equal(fake.events[0].body.metadata.order_number, checkout.orderNumber)
  assert.equal(fake.events[0].body.capture, true)
  const reference = { checkoutKey: checkout.checkoutKey, payment_id: created.body.id, amount: 470 }
  fake.pay()
  assert.equal((await fake.post('refund-payment', reference)).status, 403)
  assert.equal((await fake.post('refund-payment', reference, 'incorrect')).status, 403)
  assert.equal((await fake.post('refund-payment', reference, fake.refundToken)).body.refund.status, 'pending')
})
