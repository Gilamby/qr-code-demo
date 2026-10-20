'use client'
import { useState } from 'react'

/* Contactformulier → Payload (collectie "messages"). Het verborgen veld "website" vangt robots. */
export default function ContactForm({ t, lang }: { t: any; lang: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const topics = String(t.topics || '').split('|').filter(Boolean)
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setState('busy')
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), email: f.get('email'), topic: f.get('topic'), message: f.get('message'), website: f.get('website'), locale: lang }) })
      setState(r.ok ? 'ok' : 'err'); if (r.ok) (e.target as HTMLFormElement).reset()
    } catch { setState('err') }
  }
  if (state === 'ok') return <p className="form-ok" role="status">{t.sent}</p>
  return (
    <form className="contact-form" onSubmit={send}>
      <label className="field"><span>{t.name}</span><input name="name" autoComplete="name" maxLength={120} /></label>
      <label className="field"><span>{t.email} *</span><input name="email" type="email" required autoComplete="email" /></label>
      {topics.length > 0 && <label className="field"><span>{t.topic}</span><select name="topic">{topics.map((x) => <option key={x}>{x}</option>)}</select></label>}
      <label className="field"><span>{t.message} *</span><textarea name="message" required maxLength={5000} /></label>
      <label className="hp" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {state === 'err' && <p className="form-err" role="alert">{t.error}</p>}
      <button className="btn btn-primary btn-lg" disabled={state === 'busy'}>{t.send}</button>
      <p className="small muted" style={{ margin: 0 }}>{t.privacy}</p>
    </form>
  )
}
