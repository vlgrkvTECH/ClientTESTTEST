import { Clock3, Coffee, Gift, Leaf, Ticket, Wifi } from 'lucide-react'
import { offers } from '../data/menuData.js'
import { Icon, Photo, Reveal } from './ui.jsx'

const offerIcons = { MORNING450: Coffee, BUBBLE5: Gift, HAPPY20: Clock3 }

export function Offers({ onOffer }) {
  return (
    <Reveal as="section" id="offers" className="offers-section section-pad" aria-labelledby="offers-title">
      <div className="shell">
        <div className="section-heading">
          <h2 id="offers-title">Акции</h2>
          <p>Выберите предложение и примените его в корзине.</p>
        </div>
        <div className="offer-grid">
          {offers.map((offer) => (
            <article className="offer-card" key={offer.code}>
              <div className="offer-top">
                <span className="note-icon"><Icon as={offerIcons[offer.code]} size={24} /></span>
                <span className="offer-detail">{offer.detail}</span>
              </div>
              <h3>{offer.name}</h3>
              <p>{offer.description}</p>
              <button type="button" className="button offer-button" onClick={() => onOffer(offer.code)}><Icon as={Ticket} /> Применить промокод</button>
            </article>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

const highlights = [
  { icon: Coffee, title: '100% арабика', description: 'Обжариваем сами' },
  { icon: Leaf, title: 'Каждые 3 часа', description: 'Варим тапиоку заново' },
  { icon: Wifi, title: 'Wi-Fi и розетки', description: 'Удобно работать' },
]

export function About() {
  return (
    <Reveal as="section" id="about" className="section-pad" aria-labelledby="about-title">
      <div className="shell about-grid">
        <Photo name="interior" alt="Уютная кофейня с деревянными столами и зеленью" className="about-photo" />
        <div className="about-copy">
          <div className="section-heading">
            <h2 id="about-title">О нас</h2>
            <p>Мы открыли «Зерно и Ритм» на Покровке, чтобы здесь можно было начать день с хорошего кофе, встретиться с друзьями или спокойно поработать у окна.</p>
          </div>
          <p>Спешелти-зерно обжариваем сами, листовой чай привозим из Тайваня, а тапиоку без консервантов варим небольшими порциями каждые три часа. По утрам печём выпечку. У столиков есть розетки, а быстрый Wi-Fi доступен во всём зале.</p>
          <div className="highlights">
            {highlights.map(({ icon, title, description }) => (
              <div key={title}><Icon as={icon} size={24} /><strong>{title}</strong><span>{description}</span></div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  )
}
