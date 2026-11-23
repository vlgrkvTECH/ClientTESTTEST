import { useEffect, useRef, useState } from 'react'
import {
  createPayment, IS_DEV_MODE, paymentHealth, paymentStatus, paymentUUID, readCheckout, refundPayment, sandboxPayment, storeCheckout,
} from '../data/payment.js'

export function newOrder({ pickup, time }, total, items, method) {
  return {
    number: paymentUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
    pickup, time, total, items, method,
  }
}

export default function useCheckoutPayment(onPaid, open) {
  const [checkout, setCheckout] = useState(readCheckout)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [canDiscard, setCanDiscard] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const action = useRef(false)
  const payment = checkout?.payment
  const checkoutKey = checkout?.checkoutKey
  const ongoing = payment?.mode !== 'sandbox' && (payment?.status === 'pending' || payment?.refund?.status === 'pending')
  const checkingLiveRefund = open && payment?.mode === 'live' && payment.status === 'succeeded' && payment.refund?.status !== 'succeeded'
  const pollInterval = ongoing ? 3000 : checkingLiveRefund ? 12000 : 0
  const latest = useRef(checkout)

  function commit(next) {
    latest.current = next
    storeCheckout(next)
    setCheckout(next)
  }

  useEffect(() => {
    if (payment?.status === 'succeeded') onPaid({
      ...checkout.order,
      paymentId: payment.id,
      paymentMode: payment.mode,
    })
  }, [checkout, onPaid, payment])

  useEffect(() => {
    if (!pollInterval) return
    let stopped = false
    let timeout
    async function poll() {
      try {
        const confirmed = await paymentStatus(latest.current)
        if (stopped || latest.current?.checkoutKey !== checkoutKey) return
        setStatusError(false)
        commit({ ...latest.current, payment: confirmed })
      } catch {
        if (!stopped) setStatusError(true)
      } finally {
        if (!stopped) timeout = window.setTimeout(poll, pollInterval)
      }
    }
    timeout = window.setTimeout(poll, 600)
    return () => {
      stopped = true
      window.clearTimeout(timeout)
    }
  }, [pollInterval, checkoutKey])

  async function start(order, code, firstOrder) {
    if (action.current) return
    action.current = true
    setBusy(true)
    setError('')
    setCanDiscard(false)
    let draft = latest.current
    try {
      if (!draft) {
        const mode = await paymentHealth()
        if (mode === 'sandbox' && !IS_DEV_MODE) {
          setError('Онлайн-оплата сейчас недоступна. Можно оплатить заказ в кофейне.')
          return
        }
        draft = { order, code, firstOrder, mode, checkoutKey: paymentUUID() }
        commit(draft)
      }
      const next = draft.mode === 'sandbox' ? sandboxPayment(draft.order) : await createPayment(draft)
      commit({ ...draft, payment: next })
    } catch (failure) {
      setCanDiscard([400, 409, 415, 422, 503].includes(failure.status))
      setError(failure.status ? failure.message : 'Ответ сервера ещё не получен. Повторите запрос для этого заказа.')
    } finally {
      action.current = false
      setBusy(false)
    }
  }

  function simulate() {
    const current = latest.current
    if (!IS_DEV_MODE || current?.payment?.mode !== 'sandbox' || current.payment.status !== 'pending' || Date.now() >= current.payment.expiresAt) return
    commit({ ...current, payment: { ...current.payment, status: 'succeeded' } })
  }

  async function refund() {
    const current = latest.current
    if (!IS_DEV_MODE || action.current || current?.payment?.status !== 'succeeded' || current.payment.mode === 'live') return
    if (['pending', 'succeeded'].includes(current.payment.refund?.status)) return
    action.current = true
    setBusy(true)
    setError('')
    try {
      const next = current.payment.mode === 'sandbox' ? {
        ...current.payment,
        refund: { id: `refund-${paymentUUID()}`, status: 'succeeded', amount: current.payment.amount, at: new Date().toISOString() },
      } : await refundPayment(current)
      commit({ ...current, payment: next })
    } catch (failure) {
      setError(failure.status ? failure.message : 'Не удалось получить ответ о возврате. Повторите запрос.')
    } finally {
      action.current = false
      setBusy(false)
    }
  }

  function discard() {
    setError('')
    setStatusError(false)
    setCanDiscard(false)
    commit(null)
  }

  return { checkout, payment, busy, error, canDiscard, statusError, start, simulate, refund, discard }
}
