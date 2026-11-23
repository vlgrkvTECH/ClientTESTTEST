import { useState } from 'react'
import { Menu, ShoppingBag, X } from 'lucide-react'
import { Brand, Icon, LocationLink } from './ui.jsx'

const links = [
  ['menu', 'Меню'],
  ['offers', 'Акции'],
  ['about', 'О нас'],
  ['contacts', 'Контакты'],
]

export default function Navbar({ count, onCart }) {
  const [expanded, setExpanded] = useState(false)

  function openCart() {
    setExpanded(false)
    onCart()
  }

  return (
    <header className="navbar" onKeyDown={(event) => event.key === 'Escape' && setExpanded(false)}>
      <div className="shell nav-inner">
        <Brand />
        <nav id="main-nav" className={`nav-links ${expanded ? 'nav-expanded' : ''}`} aria-label="Основная навигация">
          {links.map(([id, title]) => <a key={id} href={`#${id}`} onClick={() => setExpanded(false)}>{title}</a>)}
          <a className="mobile-location" href="#contacts" onClick={() => setExpanded(false)}>Где нас найти</a>
        </nav>
        <div className="nav-actions">
          <LocationLink className="button button-outline nav-location" />
          <button type="button" className="button nav-cart" onClick={openCart} aria-label={`Корзина, товаров: ${count}`}>
            <Icon as={ShoppingBag} />
            <span className="nav-cart-label">Корзина</span>
            <span className="cart-count" aria-hidden="true">{count}</span>
          </button>
          <button type="button" className="icon-button nav-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="main-nav" aria-label={expanded ? 'Закрыть навигацию' : 'Открыть навигацию'}>
            <Icon as={expanded ? X : Menu} />
          </button>
        </div>
      </div>
    </header>
  )
}
