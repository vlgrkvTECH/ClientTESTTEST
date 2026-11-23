import { useEffect, useRef, useState } from 'react'
import { Coffee, ImageOff, MapPin } from 'lucide-react'

export function Icon({ as: Component, size = 20, ...props }) {
  return <Component size={size} strokeWidth={1.75} aria-hidden="true" {...props} />
}

export function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Зерно и Ритм — в начало">
      <span className="brand-mark"><Icon as={Coffee} size={22} /></span>
      <span>Зерно<span className="brand-and"> и </span>Ритм</span>
    </a>
  )
}

export function LocationLink({ className = 'button button-outline' }) {
  return <a className={className} href="#contacts" aria-label="Где нас найти" title="Где нас найти"><Icon as={MapPin} /><span>Где нас найти</span></a>
}

export function Photo({ name, alt, className = '', eager = false }) {
  const [status, setStatus] = useState('loading')
  return (
    <div className={`photo ${className}`}>
      {status === 'error' ? (
        <span className="photo-fallback" role="img" aria-label={alt}><Icon as={ImageOff} size={24} /></span>
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}photos/${name}.webp`}
          alt={alt}
          className={status === 'ready' ? 'photo-ready' : ''}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  )
}

export function Reveal({ as: Component = 'div', className = '', children, ...props }) {
  const ref = useRef(null)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!('IntersectionObserver' in window) || node.getBoundingClientRect().top < window.innerHeight) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setWaiting(false)
      observer.disconnect()
    }, { rootMargin: '0px 0px -28px' })

    setWaiting(true)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return <Component ref={ref} className={`reveal ${waiting ? 'reveal-waiting' : ''} ${className}`} {...props}>{children}</Component>
}
