import { menu } from './menuData.js'

const cartKey = 'zerno-ritm-cart'
const lastOrderKey = 'zerno-ritm-last-order'

const catalog = new Map(menu.flatMap((item) => item.variants.map((variant) => [
  `${item.id}-${variant.size}`, { item, variant },
])))

export function restoreCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) ?? '{}')
    return Object.fromEntries(Object.entries(saved).filter(([key, quantity]) => catalog.has(key) && Number.isSafeInteger(quantity) && quantity > 0))
  } catch {
    return {}
  }
}

export function storeCart(cart) {
  try {
    localStorage.setItem(cartKey, JSON.stringify(cart))
  } catch {
    // The cart remains available in memory when browser storage is disabled.
  }
}

export function cartLines(cart) {
  return Object.entries(cart).map(([key, quantity]) => ({ key, quantity, ...catalog.get(key) }))
}

const moscowClock = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function cafeTime(date = new Date()) {
  const parts = Object.fromEntries(moscowClock.formatToParts(date).map(({ type, value }) => [type, value]))
  return { minutes: Number(parts.hour) * 60 + Number(parts.minute), opens: ['сб', 'вс'].includes(parts.weekday) ? 540 : 480, closes: 1320 }
}

export function hasOrdered() {
  try {
    return Boolean(localStorage.getItem(lastOrderKey))
  } catch {
    return false
  }
}

export function lastOrderNumber() {
  try {
    return JSON.parse(localStorage.getItem(lastOrderKey) ?? 'null')?.number
  } catch {
    return undefined
  }
}

export function saveOrder(order) {
  try {
    localStorage.setItem(lastOrderKey, JSON.stringify(order))
  } catch {
    // Confirmation stays visible when browser storage is disabled.
  }
}

export function priceCart(lines, code, time, firstOrder) {
  const subtotal = lines.reduce((sum, { variant, quantity }) => sum + variant.price * quantity, 0)
  const teas = lines.filter(({ item }) => item.category === 'tea')
  const tea500 = teas.filter(({ variant }) => variant.size === 500).sort((a, b) => a.variant.price - b.variant.price)
  let discount = 0
  let message = ''

  switch (code) {
    case 'MORNING450': {
      const croissants = lines.find(({ item }) => item.id === 'croissant')?.quantity ?? 0
      const coffees = lines.filter(({ item, variant }) => item.category === 'coffee' && variant.size === 300).sort((a, b) => b.variant.price - a.variant.price)
      if (time.minutes < time.opens || time.minutes >= 720) {
        message = 'Утренний комбо действует с открытия до 12:00 по Москве.'
      } else if (!croissants || !coffees.length) {
        message = 'Добавьте кофе 300 мл и миндальный круассан.'
      } else {
        let remaining = croissants
        for (const { variant, quantity } of coffees) {
          const pairs = Math.min(remaining, quantity)
          discount += pairs * (variant.price + 280 - 450)
          remaining -= pairs
        }
      }
      break
    }
    case 'BUBBLE5': {
      let free = Math.floor(tea500.reduce((sum, line) => sum + line.quantity, 0) / 5)
      if (!free) message = 'Для акции нужно минимум пять бабл ти по 500 мл.'
      for (const { variant, quantity } of tea500) {
        const gifts = Math.min(free, quantity)
        discount += gifts * variant.price
        free -= gifts
      }
      break
    }
    case 'HAPPY20':
      if (time.minutes < 900 || time.minutes >= 1020) message = 'Счастливые часы действуют с 15:00 до 17:00 по Москве.'
      else if (!teas.length) message = 'Добавьте в корзину бабл ти.'
      else discount = Math.round(teas.reduce((sum, { variant, quantity }) => sum + variant.price * quantity, 0) * 0.2)
      break
    case 'COFFEE20':
      if (!firstOrder) message = 'Этот промокод действует только на первый заказ.'
      else if (subtotal) discount = Math.round(subtotal * 0.2)
      else message = 'Добавьте что-нибудь в корзину.'
      break
    case '':
      break
    default:
      message = 'Такого промокода нет. Проверьте написание.'
  }

  return { subtotal, discount, total: subtotal - discount, message }
}
