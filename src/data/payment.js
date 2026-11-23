export const IS_DEV_MODE = import.meta.env.VITE_IS_DEV_MODE !== 'false'

const checkoutStorageKey = 'zerno-ritm-checkout'

export function paymentUUID() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export function readCheckout() {
  try {
    const checkout = JSON.parse(sessionStorage.getItem(checkoutStorageKey) ?? 'null')
    return !IS_DEV_MODE && checkout?.mode === 'sandbox' ? null : checkout
  } catch {
    return null
  }
}

export function storeCheckout(checkout) {
  try {
    if (checkout) sessionStorage.setItem(checkoutStorageKey, JSON.stringify(checkout))
    else sessionStorage.removeItem(checkoutStorageKey)
  } catch {
    // A blocked browser storage does not affect the current payment step.
  }
}

async function callPayment(path, body) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status })
  return result
}

export async function paymentHealth() {
  if (import.meta.env.IS_GITHUB_PAGES) return 'sandbox'

  try {
    const response = await fetch('/api/payment-health', { signal: AbortSignal.timeout(2000) })
    const result = response.ok && await response.json()
    return result?.available && ['test', 'live'].includes(result.mode) ? result.mode : 'sandbox'
  } catch {
    return 'sandbox'
  }
}

export function sandboxPayment(order) {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  url.hash = `sandbox-payment?${new URLSearchParams({ order: order.number, amount: order.total })}`
  return {
    id: `test-${paymentUUID()}`,
    orderNumber: order.number,
    amount: order.total,
    confirmationUrl: url.href,
    status: 'pending',
    expiresAt: Date.now() + 15 * 60 * 1000,
    mode: 'sandbox',
  }
}

export function createPayment({ order, checkoutKey, code, firstOrder, mode }) {
  return callPayment('create-qr-payment', {
    checkoutKey, orderNumber: order.number, amount: order.total, items: order.items, code, firstOrder, mode,
  })
}

export function paymentStatus({ checkoutKey, payment }) {
  return callPayment('payment-status', { checkoutKey, payment_id: payment.id })
}

export function refundPayment({ checkoutKey, payment }) {
  return callPayment('refund-payment', { checkoutKey, payment_id: payment.id, amount: payment.amount })
}
