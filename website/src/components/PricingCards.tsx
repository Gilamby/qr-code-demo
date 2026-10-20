'use client'
import { useState } from 'react'
import Icon from './icons'
import { money } from '@/lib/locales'

type Plan = { key: string; name: string; lead: string; priceMonth: number; priceYear: number; priceYearAfter: number; popular?: boolean; items?: { text: string }[] }
type Txt = { monthly: string; yearly: string; yearlyBadge: string; perMonth: string; perFirstYear: string; monthNote: string; yearNote: string; cta: string; popular: string }

/* Pakketten met schakelaar maandelijks / jaarlijks. De knop opent aanmelden in de app met het gekozen pakket. */
export default function PricingCards({ plans, t, lang, appUrl, compact }: { plans: Plan[]; t: Txt; lang: string; appUrl: string; compact?: boolean }) {
  const [year, setYear] = useState(false)
  return (
    <div className={'pricing' + (compact ? ' compact' : '')}>
      <div className="period" role="group" aria-label={t.monthly + ' / ' + t.yearly}>
        <button type="button" aria-pressed={!year} className={!year ? 'on' : ''} onClick={() => setYear(false)}>{t.monthly}</button>
        <button type="button" aria-pressed={year} className={year ? 'on' : ''} onClick={() => setYear(true)}>{t.yearly} <em>{t.yearlyBadge}</em></button>
      </div>
      <div className="plans">
        {plans.map((p) => {
          const note = year ? t.yearNote.replace('{month}', money(p.priceYear / 12, lang)).replace('{after}', money(p.priceYearAfter, lang)) : t.monthNote
          const href = `${appUrl}/?signup&plan=${p.key}&period=${year ? 'year' : 'month'}&lang=${lang}`
          return (
            <article key={p.key} className={'plan' + (p.popular ? ' popular' : '')} data-spot>
              <header>
                <h3>{p.name}</h3>
                {p.popular && <span className="badge">{t.popular}</span>}
              </header>
              <p className="plan-lead">{p.lead}</p>
              <p className="plan-price"><b>{money(year ? p.priceYear : p.priceMonth, lang)}</b> <span>{year ? t.perFirstYear : t.perMonth}</span></p>
              <p className="plan-note">{note}</p>
              <a className={'btn ' + (p.popular ? 'btn-primary' : 'btn-ghost') + ' btn-block'} href={href}>{t.cta}</a>
              {!compact && (
                <ul className="plan-items">
                  {(p.items || []).map((it, i) => <li key={i}><Icon name="check" size={18} stroke={2.2} />{it.text}</li>)}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
