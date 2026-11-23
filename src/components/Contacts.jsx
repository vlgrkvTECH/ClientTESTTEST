import { useState } from 'react'
import { Check, Clock3, Copy, MapPin, Navigation, Phone, TrainFront } from 'lucide-react'
import { Brand, Icon, Reveal } from './ui.jsx'

const address = 'Москва, ул. Покровка, 19'
const latitude = 55.759722
const longitude = 37.646667
const mapLink = `https://yandex.ru/maps/213/moscow/?rtext=~${latitude}%2C${longitude}&rtt=pd`
const widgetLink = `https://yandex.ru/map-widget/v1/?ll=${longitude}%2C${latitude}&pt=${longitude}%2C${latitude}%2Cpm2rdl&z=16&lang=ru_RU`

export default function Contacts() {
  const [copyStatus, setCopyStatus] = useState('')

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopyStatus('Адрес скопирован')
    } catch {
      setCopyStatus('Не удалось скопировать адрес. Его можно выделить и скопировать вручную.')
    }
  }

  return (
    <Reveal as="section" id="contacts" className="contacts-section section-pad" aria-labelledby="contacts-title">
      <div className="shell">
        <div className="section-heading">
          <h2 id="contacts-title">Где нас найти</h2>
          <p>На Покровке, в девяти минутах от Чистых прудов.</p>
        </div>
        <div className="contact-grid">
          <div className="map-frame">
            <iframe src={widgetLink} title="Яндекс Карты — Москва, Покровка, 19" loading="lazy" allowFullScreen />
          </div>
          <div className="contact-card">
            <dl>
              <div><span className="note-icon"><Icon as={MapPin} /></span><div><dt>Адрес</dt><dd>{address}</dd></div>
                <button type="button" className="icon-button copy-button" aria-label="Скопировать адрес" title="Скопировать адрес" onClick={copyAddress}>
                  <Icon as={copyStatus === 'Адрес скопирован' ? Check : Copy} />
                </button>
              </div>
              <div><span className="note-icon"><Icon as={TrainFront} /></span><div><dt>Ближайшее метро</dt><dd>«Чистые пруды» · 9 минут пешком</dd></div></div>
              <div><span className="note-icon"><Icon as={Clock3} /></span><div><dt>Часы работы</dt><dd>Будни 08:00–22:00<br />Выходные 09:00–22:00</dd></div></div>
              <div><span className="note-icon"><Icon as={Phone} /></span><div><dt>Телефон · демо</dt><dd>+7 (495) 000-00-00</dd></div></div>
            </dl>
            <a className="button button-primary route-button" href={mapLink} target="_blank" rel="noreferrer"><Icon as={Navigation} /> Построить маршрут в Яндекс Картах</a>
            <p className="copy-status" role="status">{copyStatus}</p>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <Brand />
        <nav aria-label="Навигация в подвале"><a href="#menu">Меню</a><a href="#offers">Акции</a><a href="#about">О нас</a><a href="#contacts">Контакты</a></nav>
        <small>Москва, ул. Покровка, 19</small>
      </div>
    </footer>
  )
}
