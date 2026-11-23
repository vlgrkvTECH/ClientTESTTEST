import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import MenuSection from './components/MenuSection.jsx'
import { About, Offers } from './components/StorySections.jsx'
import Contacts, { Footer } from './components/Contacts.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import { Icon } from './components/ui.jsx'
import { cartLines, hasOrdered, lastOrderNumber, restoreCart, saveOrder, storeCart } from './data/cart.js'

export default function App() {
  const [cart, setCart] = useState(restoreCart)
  const [cartOpen, setCartOpen] = useState(() => window.location.hash === '#payment-return')
  const [code, setCode] = useState('')
  const [ordered, setOrdered] = useState(hasOrdered)
  const [notice, setNotice] = useState(null)
  const appliedOrder = useRef(null)
  const lines = cartLines(cart)
  const count = lines.reduce((sum, { quantity }) => sum + quantity, 0)

  useEffect(() => storeCart(cart), [cart])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  function changeQuantity(key, delta) {
    setCart((current) => {
      const next = { ...current }
      const quantity = (next[key] ?? 0) + delta
      if (quantity > 0) next[key] = quantity
      else delete next[key]
      return next
    })
  }

  function addItem(item, variant) {
    changeQuantity(`${item.id}-${variant.size}`, 1)
    setNotice({ message: `${item.name} · ${variant.label}` })
  }

  function applyOffer(promo) {
    setCode(promo)
    setCartOpen(true)
  }

  const submitOrder = useCallback(({ number, pickup, time, total, items, method, paymentId, paymentMode }) => {
    if (appliedOrder.current === number || lastOrderNumber() === number) return
    appliedOrder.current = number
    saveOrder({ number, pickup, time, total, items, method, paymentId, paymentMode, createdAt: new Date().toISOString() })
    setOrdered(true)
    setCart((current) => Object.fromEntries(
      Object.entries(current).map(([key, quantity]) => [key, quantity - (items[key] ?? 0)]).filter(([, quantity]) => quantity > 0),
    ))
    setCode('')
  }, [])

  return (
    <>
      <a className="skip-link" href="#menu">Перейти к меню</a>
      <Navbar count={count} onCart={() => setCartOpen(true)} />
      <main id="top">
        <Hero />
        <MenuSection onAdd={addItem} />
        <Offers onOffer={applyOffer} />
        <About />
        <Contacts />
      </main>
      <Footer />
      <div className={`toast ${notice ? 'toast-visible' : ''}`} role="status">
        {notice && <><span className="note-icon"><Icon as={Check} /></span><span><strong>В корзине</strong><small>{notice.message}</small></span></>}
      </div>
      <CartDrawer
        open={cartOpen}
        lines={lines}
        code={code}
        firstOrder={!ordered}
        onCode={setCode}
        onChange={changeQuantity}
        onClose={() => setCartOpen(false)}
        onSubmit={submitOrder}
      />
    </>
  )
}
