import { Clock3, Coffee, Leaf, MapPin } from 'lucide-react'
import { Icon, LocationLink, Photo } from './ui.jsx'

export default function Hero() {
  return (
    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="eyebrow"><span /> Кофейня и бабл-ти бар</span>
        <h1 id="hero-title">Кофе в ритме<br /> <em>твоего дня</em></h1>
        <p>Спешелти-кофе собственной обжарки, авторский бабл ти и выпечка прямо из печи. В самом сердце Покровки.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#menu">Перейти в меню</a>
          <LocationLink />
        </div>
        <div className="hero-meta">
          <span><Icon as={MapPin} /> Покровка, 19</span>
          <span><Icon as={Clock3} /> Открыты каждый день</span>
        </div>
      </div>
      <div className="hero-visual">
        <Photo name="hero" alt="Две бутылочки молочного бабл ти с тапиокой на деревянном столе" className="hero-photo" eager />
        <div className="floating-note note-coffee">
          <span className="note-icon"><Icon as={Coffee} /></span>
          <span><strong>100% арабика</strong><small>Собственная обжарка</small></span>
        </div>
        <div className="floating-note note-tea">
          <span className="note-icon"><Icon as={Leaf} /></span>
          <span><strong>Свежая тапиока</strong><small>Варим каждые 3 часа</small></span>
        </div>
      </div>
    </section>
  )
}
