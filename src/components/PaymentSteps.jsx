import { useEffect, useState } from 'react'
import { Check, Clock3, FlaskConical, Landmark, LoaderCircle, QrCode, ReceiptText, RotateCcw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { rubles } from '../data/menuData.js'
import { IS_DEV_MODE } from '../data/payment.js'
import { Icon } from './ui.jsx'

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Moscow',
})

function SandboxPanel({ children }) {
  return (
    <aside className="sandbox-panel" aria-label="Режим разработчика">
      <strong><Icon as={FlaskConical} /> Режим разработчика (Песочница)</strong>
      {children}
    </aside>
  )
}

export function PaymentStep({ flow }) {
  const { checkout, payment, busy, error, canDiscard, statusError, start, simulate, discard } = flow
  const [now, setNow] = useState(Date.now)
  const deadline = payment?.expiresAt
  const seconds = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0
  const expired = Boolean(deadline) && seconds === 0
  const time = [Math.floor(seconds / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':')
  const local = payment?.mode === 'sandbox'
  const awaiting = payment?.status === 'pending' && !expired

  useEffect(() => {
    if (!deadline) return
    const tick = () => setNow(Date.now())
    const initial = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [deadline])

  return (
    <section className="payment-step" aria-label="Оплата заказа">
      <div className="payment-intro">
        <span className="confirmation-icon"><Icon as={QrCode} size={24} /></span>
        <h3>{payment?.mode === 'test' ? 'Тестовая оплата ЮKassa' : 'Оплата по QR-коду'}</h3>
        <p>Заказ № {checkout.order.number}</p>
        <strong className="payment-amount">{rubles(checkout.order.total)}</strong>
      </div>

      {awaiting && (
        <div className="payment-qr-card">
          <QRCodeSVG value={payment.confirmationUrl} title="QR-код оплаты заказа" fgColor="#1C1917" bgColor="#FFFFFF" size={208} marginSize={4} />
          <p className="payment-countdown"><Icon as={Clock3} /><span>Действует ещё <strong>{time}</strong></span></p>
          <a className="button button-primary" href={payment.confirmationUrl} target="_blank" rel="noreferrer">
            <Icon as={Landmark} /> {payment.mode === 'test' ? 'Открыть тестовую оплату ЮKassa' : 'Открыть ссылку оплаты в банке'}
          </a>
          <p className="payment-wait" role="status"><Icon as={LoaderCircle} className="payment-spinner" /> Ожидаем оплату</p>
        </div>
      )}

      {!payment && busy && <p className="payment-wait" role="status"><Icon as={LoaderCircle} className="payment-spinner" /> Готовим ссылку оплаты</p>}
      {payment?.status === 'canceled' && <p className="payment-message" role="status">Платёж отменён. Можно вернуться в корзину и начать заново.</p>}
      {expired && payment?.status === 'pending' && (
        <p className="payment-message" role="status">{local ? 'Срок действия QR-кода истёк.' : 'Срок действия QR-кода истёк. Проверяем окончательный статус в ЮKassa.'}</p>
      )}
      {statusError && <p className="field-note" role="status">Связь с сервером прервалась. Повторяем проверку автоматически.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!payment && !busy && <button type="button" className="button button-outline" onClick={() => start()}><Icon as={RotateCcw} /> Повторить запрос</button>}

      {IS_DEV_MODE && (local || payment?.mode === 'test') && (
        <SandboxPanel>
          <p>{local ? 'Платёж имитируется. Деньги не списываются.' : 'В тестовом магазине ЮKassa используйте тестовую банковскую карту.'}</p>
          {local && awaiting && <button type="button" className="button button-outline" onClick={simulate}>Симулировать успешную оплату</button>}
        </SandboxPanel>
      )}
      {(local || payment?.status === 'canceled' || canDiscard) && (
        <button type="button" className="button button-outline" disabled={busy} onClick={discard}>Вернуться в корзину</button>
      )}
    </section>
  )
}

export function PaymentReceipt({ order, customerName, flow, onReturn }) {
  const { payment, busy, error, statusError, refund } = flow
  const result = payment?.refund
  const refunded = result?.status === 'succeeded'
  const canRefund = IS_DEV_MODE && payment && payment.mode !== 'live' && !['pending', 'succeeded'].includes(result?.status)
  const paidStatus = payment ? 'Оплачено' : 'Оплата при получении'
  const refundStatus = payment?.mode === 'live' ? 'Возврат подтверждён ЮKassa' : 'Средства возвращены на счёт плательщика'

  return (
    <section className="payment-step payment-receipt" aria-label="Подтверждение заказа">
      <div className="payment-intro">
        <span className="confirmation-icon"><Icon as={refunded ? RotateCcw : Check} size={24} /></span>
        <h3>Заказ № {order.number}</h3>
        <p>{customerName && `${customerName}, ваш заказ оформлен. `}{order.pickup === 'later' ? `Самовывоз к ${order.time}.` : 'Получение в кофейне.'}</p>
        <strong className="payment-status" role="status">{refunded ? refundStatus : paidStatus}</strong>
      </div>
      <div className="receipt-card">
        <h4><Icon as={ReceiptText} /> {payment ? 'Подтверждение платежа' : 'Подтверждение заказа'}</h4>
        <dl>
          <div><dt>Сумма заказа</dt><dd>{rubles(order.total)}</dd></div>
          <div><dt>Способ оплаты</dt><dd>{payment?.mode === 'test' ? 'Тестовая карта ЮKassa' : payment ? 'СБП' : 'В кофейне'}</dd></div>
          {payment && <div><dt>ID транзакции</dt><dd>{payment.id}</dd></div>}
        </dl>
        <p className="checkout-note">{payment?.mode === 'live' ? 'Подтверждение оплаты на сайте. Фискальный чек формируется отдельно.' : 'Демо-заказ сохраняется в браузере.'}</p>
      </div>
      {result && (
        <div className="receipt-card refund-log">
          <h4><Icon as={RotateCcw} /> Журнал возврата</h4>
          <p role="status">{result.status === 'pending' ? 'ЮKassa обрабатывает возврат.' : result.status === 'canceled' ? 'ЮKassa отменила возврат. Можно повторить запрос.' : 'Возврат подтверждён.'}</p>
          <dl>
            <div><dt>ID платежа</dt><dd>{payment.id}</dd></div>
            <div><dt>ID возврата</dt><dd>{result.id}</dd></div>
            <div><dt>Сумма возврата</dt><dd>{rubles(result.amount)}</dd></div>
            {result.at && <div><dt>Время запроса, МСК</dt><dd>{dateTime.format(new Date(result.at))}</dd></div>}
          </dl>
        </div>
      )}
      {IS_DEV_MODE && payment && payment.mode !== 'live' && (
        <SandboxPanel>
          <p>Тестовые операции не списывают и не возвращают реальные деньги.</p>
          {canRefund && <button type="button" className="button button-outline" disabled={busy} onClick={refund}>{busy ? 'Отправляем запрос…' : 'Провести тестовый возврат (Refund)'}</button>}
        </SandboxPanel>
      )}
      {statusError && <p className="field-note" role="status">Повторяем проверку статуса возврата.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!busy && result?.status !== 'pending' && <a className="button button-primary" href="#menu" onClick={onReturn}>Вернуться в меню</a>}
    </section>
  )
}

export function PaymentLinkPage({ sandbox }) {
  const params = new URLSearchParams(window.location.hash.split('?')[1])
  const number = params.get('order')
  const amount = Number(params.get('amount'))
  const validOrder = /^[A-F0-9]{12}$/.test(number) && Number.isSafeInteger(amount) && amount > 0
  return (
    <main className="payment-link-page shell">
      <section className="payment-step receipt-card">
        <span className="confirmation-icon"><Icon as={sandbox ? FlaskConical : ReceiptText} size={24} /></span>
        <h1>{sandbox ? 'Тестовая ссылка оплаты' : 'Возврат из ЮKassa'}</h1>
        {sandbox && validOrder && <p>Заказ № {number} · {rubles(amount)}</p>}
        <p>{sandbox ? 'Это ссылка песочницы. Проверьте сценарий оплаты в корзине, где создан заказ.' : 'Проверьте подтверждение оплаты во вкладке или на устройстве, где вы начали оформление заказа.'}</p>
        <a href={import.meta.env.BASE_URL} className="button button-primary">На главную</a>
      </section>
    </main>
  )
}
