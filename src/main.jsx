import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PaymentLinkPage } from './components/PaymentSteps.jsx'
import { IS_DEV_MODE, readCheckout } from './data/payment.js'

const hash = window.location.hash
const sandboxLink = IS_DEV_MODE && hash.startsWith('#sandbox-payment?')
const paymentReturn = hash === '#payment-return' && !readCheckout()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sandboxLink || paymentReturn ? <PaymentLinkPage sandbox={sandboxLink} /> : <App />}
  </StrictMode>,
)
