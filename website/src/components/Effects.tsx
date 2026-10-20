'use client'
import { useEffect } from 'react'

/* Kleine effecten voor de hele site:
   [data-reveal]  komt rustig in beeld bij het scrollen
   [data-spot]    zachte lichtvlek die de muis volgt (kaarten)
   [data-count]   telt op tot het getal als het in beeld komt */
export default function Effects() {
  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) {
        const el = e.target as HTMLElement
        el.classList.add('in'); io.unobserve(el)
        if (el.dataset.count) count(el)
      }
    }, { rootMargin: '0px 0px -12% 0px' })
    const watch = () => document.querySelectorAll<HTMLElement>('[data-reveal]:not(.in),[data-count]:not(.in)').forEach((el) => io.observe(el))
    function count(el: HTMLElement) {
      const to = Number(el.dataset.count), fmt = new Intl.NumberFormat(document.documentElement.lang)
      if (still) { el.textContent = fmt.format(to); return }
      const t0 = performance.now(), dur = 1400
      const step = (t: number) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt.format(Math.round(to * e)); if (k < 1) requestAnimationFrame(step) }
      requestAnimationFrame(step)
    }
    const spot = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-spot]'); if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px')
    }
    watch()
    const mo = new MutationObserver(watch); mo.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('pointermove', spot, { passive: true })
    return () => { io.disconnect(); mo.disconnect(); document.removeEventListener('pointermove', spot) }
  }, [])
  return null
}
