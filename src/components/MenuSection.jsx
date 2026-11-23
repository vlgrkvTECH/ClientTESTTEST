import { useState } from 'react'
import { Coffee, Croissant, CupSoda, LayoutGrid, Plus } from 'lucide-react'
import { categories, menu, rubles } from '../data/menuData.js'
import { Icon, Photo, Reveal } from './ui.jsx'

const categoryIcons = { all: LayoutGrid, tea: CupSoda, coffee: Coffee, bakery: Croissant }
const categoryNames = { tea: 'Бабл ти', coffee: 'Кофе', bakery: 'Выпечка' }

function MenuCard({ item, variantIndex, onSelect, onAdd }) {
  const variant = item.variants[variantIndex]

  return (
    <article className="menu-card">
      <div className="menu-image">
        <Photo name={item.id} alt={item.name} className={`product-photo product-${item.id}`} />
        {item.badge && <span className="product-badge">{item.badge}</span>}
      </div>
      <div className="menu-card-content">
        <span className="product-category">{categoryNames[item.category]}</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        {item.variants.length > 1 ? (
          <div className="sizes" role="group" aria-label={`Объём: ${item.name}`}>
            {item.variants.map(({ label, size }, index) => (
              <button type="button" key={size} aria-pressed={index === variantIndex} onClick={() => onSelect(index)}>{label}</button>
            ))}
          </div>
        ) : <span className="product-weight">{variant.label}</span>}
        <div className="product-bottom">
          <span className="price" role="status"><span key={variant.size}>{rubles(variant.price)}</span></span>
          <button type="button" className="icon-button add-button" aria-label={`Добавить: ${item.name}, ${variant.label}`} onClick={() => onAdd(item, variant)}>
            <Icon as={Plus} />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function MenuSection({ onAdd }) {
  const [active, setActive] = useState('all')
  const [selected, setSelected] = useState({})
  const items = active === 'all' ? menu : menu.filter((item) => item.category === active)

  return (
    <Reveal as="section" id="menu" className="menu-section section-pad" aria-labelledby="menu-title">
      <div className="shell">
        <div className="section-heading">
          <h2 id="menu-title">Наше меню</h2>
          <p>Кофе, чай и выпечка. Выберите, чего хочется сегодня.</p>
        </div>
        <div className="menu-toolbar">
          <div className="category-tabs" role="group" aria-label="Категории меню">
            {categories.map(({ id, name }) => (
              <button type="button" key={id} aria-pressed={id === active} onClick={() => setActive(id)}>
                <Icon as={categoryIcons[id]} /> {name}
              </button>
            ))}
          </div>
          <span className="item-count" aria-live="polite">{items.length} {items.length === 24 ? 'позиции' : 'позиций'}</span>
        </div>
        <div className="product-grid" key={active}>
          {items.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              variantIndex={selected[item.id] ?? 0}
              onSelect={(index) => setSelected((previous) => ({ ...previous, [item.id]: index }))}
              onAdd={onAdd}
            />
          ))}
        </div>
      </div>
    </Reveal>
  )
}
