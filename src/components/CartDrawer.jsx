import { useEffect, useRef, useState } from 'react'
import { Clock3, Coffee, Minus, Plus, QrCode, ShoppingBag, Ticket, Trash2, Wallet, X } from 'lucide-react'
import { rubles } from '../data/menuData.js'
import { cafeTime, priceCart } from '../data/cart.js'
import { PaymentReceipt, PaymentStep } from './PaymentSteps.jsx'
import useCheckoutPayment, { newOrder } from './useCheckoutPayment.js'
import { Icon, Photo } from './ui.jsx'

const initialFields = { name: '', phone: '', pickup: 'here', time: '', paymentMethod: 'qr' }

export default function CartDrawer({ open, lines, code, firstOrder, onCode, onChange, onClose, onSubmit }) {
  const dialog = useRef(null)
  const panel = useRef(null)
  const closeButton = useRef(null)
  const [draftCode, setDraftCode] = useState(null)
  const [fields, setFields] = useState(initialFields)
  const [time, setTime] = useState(cafeTime)
  const [error, setError] = useState('')
  const [pickupOrder, setPickupOrder] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const paymentFlow = useCheckoutPayment(onSubmit, open)
  const receipt = pickupOrder ?? (paymentFlow.payment?.status === 'succeeded' ? paymentFlow.checkout.order : null)
  const screen = receipt ? 'receipt' : paymentFlow.checkout ? 'payment' : 'cart'
  const pricing = priceCart(lines, code, time, firstOrder)
  const checkoutError = error || (fields.paymentMethod === 'qr' ? paymentFlow.error : '')

  function close() {
    onClose()
    setDraftCode(null)
    setError('')
  }

  function returnToMenu() {
    setPickupOrder(null)
    setFields(initialFields)
    setCustomerName('')
    paymentFlow.discard()
    close()
  }

  useEffect(() => {
    const element = dialog.current
    if (!open || element.open) return

    const previousFocus = document.activeElement
    element.showModal()
    closeButton.current.focus()
    document.documentElement.classList.add('drawer-open')
    return () => {
      document.documentElement.classList.remove('drawer-open')
      element.close()
      previousFocus?.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const refresh = () => setTime(cafeTime())
    const initial = window.setTimeout(refresh, 0)
    const timer = window.setInterval(refresh, 15000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [open])

  useEffect(() => {
    if (open && panel.current) panel.current.scrollTop = 0
  }, [screen, open])

  function updateField(event) {
    const { name, value } = event.target
    setFields((current) => ({ ...current, [name]: value }))
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    const currentTime = cafeTime()
    setTime(currentTime)
    const phoneDigits = fields.phone.replace(/\D/g, '')
    if (fields.name.trim().length < 2 || phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError('Проверьте имя и номер телефона.')
      return
    }
    if (fields.pickup === 'later') {
      const [hours, minutes] = fields.time.split(':').map(Number)
      const pickupMinutes = hours * 60 + minutes
      if (!(pickupMinutes > currentTime.minutes && pickupMinutes >= currentTime.opens && pickupMinutes < currentTime.closes)) {
        setError('Выберите будущее время на сегодня в часы работы кофейни по Москве.')
        return
      }
    }
    const finalPricing = priceCart(lines, code, currentTime, firstOrder)
    if (finalPricing.discount !== pricing.discount) {
      setError('Условия акции изменились. Проверьте итог и подтвердите заказ ещё раз.')
      return
    }
    const items = Object.fromEntries(lines.map(({ key, quantity }) => [key, quantity]))
    const order = newOrder(fields, finalPricing.total, items, fields.paymentMethod)
    setCustomerName(fields.name.trim())
    if (fields.paymentMethod === 'qr') {
      paymentFlow.start(order, code, firstOrder)
    } else {
      onSubmit(order)
      setPickupOrder(order)
      setFields(initialFields)
    }
    setDraftCode(null)
    setError('')
  }

  function applyCode(event) {
    event.preventDefault()
    setTime(cafeTime())
    onCode((draftCode ?? code).trim().toUpperCase())
    setDraftCode(null)
  }

  return (
    <dialog
      ref={dialog}
      className="cart-dialog"
      aria-labelledby="cart-title"
      onCancel={(event) => { event.preventDefault(); close() }}
      onClick={(event) => { if (event.target === dialog.current) close() }}
    >
      <div ref={panel} className="cart-panel">
        <header className="cart-header">
          <h2 id="cart-title">{receipt ? 'Заказ оформлен' : paymentFlow.checkout ? 'Оплата заказа' : 'Корзина'}</h2>
          <button type="button" className="icon-button close-cart" ref={closeButton} onClick={close} aria-label="Закрыть корзину"><Icon as={X} /></button>
        </header>
        {receipt ? (
          <PaymentReceipt order={receipt} customerName={customerName} flow={paymentFlow} onReturn={returnToMenu} />
        ) : paymentFlow.checkout ? (
          <PaymentStep flow={paymentFlow} />
        ) : (
          <div className="cart-content">
            {lines.length ? (
              <ul className="cart-lines">
                {lines.map(({ key, item, variant, quantity }) => (
                  <li key={key}>
                    <Photo name={item.id} alt="" className="cart-photo" />
                    <div className="cart-line-detail"><strong>{item.name}</strong><span>{variant.label} · {rubles(variant.price)}</span>
                      <div className="quantity">
                        <button type="button" aria-label={`Уменьшить количество: ${item.name}, ${variant.label}`} onClick={() => onChange(key, -1)}><Icon as={Minus} /></button>
                        <span aria-label={`Количество: ${quantity}`}>{quantity}</span>
                        <button type="button" aria-label={`Увеличить количество: ${item.name}, ${variant.label}`} onClick={() => onChange(key, 1)}><Icon as={Plus} /></button>
                      </div>
                    </div>
                    <div className="cart-line-end"><strong>{rubles(variant.price * quantity)}</strong>
                      <button type="button" className="icon-button" aria-label={`Удалить: ${item.name}, ${variant.label}`} onClick={() => onChange(key, -quantity)}><Icon as={Trash2} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="cart-empty">
                <span className="confirmation-icon"><Icon as={ShoppingBag} size={24} /></span>
                <h3>Корзина пока пуста</h3>
                <p>Выберите напиток или десерт, и он появится здесь.</p>
                <a className="button button-primary" href="#menu" onClick={close}>Перейти в меню</a>
              </div>
            )}
            <form className="promo-form" onSubmit={applyCode}>
              <label htmlFor="promo-code"><Icon as={Ticket} /> Промокод</label>
              <div>
                <input id="promo-code" value={draftCode ?? code} placeholder="Например, COFFEE20" onChange={(event) => setDraftCode(event.target.value)} />
                <button type="submit" className="button button-outline">Применить</button>
              </div>
              <p className="field-note" role="status">{pricing.message || (code && pricing.discount ? 'Промокод применён.' : '')}</p>
            </form>
            {lines.length > 0 && (
              <form className="checkout-form" onSubmit={submit}>
                <fieldset>
                  <legend>Как заберёте заказ?</legend>
                  <div className="pickup-options">
                    <label><input type="radio" name="pickup" value="here" checked={fields.pickup === 'here'} onChange={updateField} /><Icon as={Coffee} /> В кофейне</label>
                    <label><input type="radio" name="pickup" value="later" checked={fields.pickup === 'later'} onChange={updateField} /><Icon as={Clock3} /> С собой ко времени</label>
                  </div>
                </fieldset>
                {fields.pickup === 'later' && <label>Время самовывоза сегодня, МСК<input type="time" name="time" min={time.opens === 480 ? '08:00' : '09:00'} max="21:59" value={fields.time} onChange={updateField} required /></label>}
                <div className="checkout-fields">
                  <label>Имя<input name="name" autoComplete="given-name" value={fields.name} onChange={updateField} placeholder="Ваше имя" maxLength={80} required /></label>
                  <label>Телефон<input type="tel" name="phone" autoComplete="tel" value={fields.phone} onChange={updateField} placeholder="+7 (___) ___-__-__" maxLength={25} required /></label>
                </div>
                <fieldset>
                  <legend>Способ оплаты</legend>
                  <div className="pickup-options payment-options">
                    <label><input type="radio" name="paymentMethod" value="qr" checked={fields.paymentMethod === 'qr'} onChange={updateField} /><Icon as={QrCode} /> Оплата по QR-коду (СБП)</label>
                    <label><input type="radio" name="paymentMethod" value="pickup" checked={fields.paymentMethod === 'pickup'} onChange={updateField} /><Icon as={Wallet} /> При получении в кофейне</label>
                  </div>
                </fieldset>
                <dl className="cart-totals">
                  <div><dt>Товары</dt><dd>{rubles(pricing.subtotal)}</dd></div>
                  {pricing.discount > 0 && <div className="discount"><dt>Скидка</dt><dd>−{rubles(pricing.discount)}</dd></div>}
                  <div className="cart-total"><dt>Итого</dt><dd>{rubles(pricing.total)}</dd></div>
                </dl>
                {checkoutError && <p className="field-error" role="alert">{checkoutError}</p>}
                <button type="submit" className="button button-primary submit-order" disabled={paymentFlow.busy}>
                  {paymentFlow.busy ? 'Готовим оплату…' : fields.paymentMethod === 'qr' ? 'Перейти к оплате' : 'Оформить заказ'}
                </button>
                <p className="checkout-note">Заказ оформляется на этом сайте. Передача заказа в кофейню пока не подключена.</p>
              </form>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}
