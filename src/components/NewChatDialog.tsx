import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Profile } from '../types';

export function NewChatDialog({ onClose, onStart, demoMode, contacts }: { onClose: () => void; onStart: (phone: string) => Promise<void>; demoMode: boolean; contacts: Profile[] }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const visibleContacts = useMemo(() => {
    const term = filter.toLowerCase();
    return contacts.filter((person) => `${person.name} ${person.phoneNumber}`.toLowerCase().includes(term));
  }, [contacts, filter]);

  async function start(value: string) {
    setBusy(true);
    setError('');
    try { await onStart(value); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not find that account.'); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void start(phone);
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card new-chat-modal" role="dialog" aria-modal="true" aria-labelledby="new-chat-heading">
      <header className="modal-heading"><div><span className="eyebrow">A NEW HELLO</span><h2 id="new-chat-heading">Start a conversation</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
      <p className="modal-description">Find someone by their phone number, with country code included.</p>
      <form className="phone-lookup" onSubmit={submit}><label className="lookup-field"><Search size={17} /><input autoFocus type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 415 555 0108" aria-label="Phone number to find" /></label><button type="submit" className="primary-button lookup-button" disabled={!phone.trim() || busy}>{busy ? 'Looking…' : 'Find'}</button></form>
      {error && <p className="lookup-error">{error}</p>}
      <div className="contact-list-heading"><span>{demoMode ? 'SAMPLE PEOPLE' : 'PHONE NUMBER LOOKUP'}</span>{demoMode && <small>{visibleContacts.length} contacts</small>}</div>
      {demoMode ? <><label className="contact-filter"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search sample contacts" /></label><div className="sample-contact-list">{visibleContacts.map((person) => <button key={person.uid} className="sample-contact" type="button" onClick={() => void start(person.phoneNumber)} disabled={busy}><Avatar profile={person} size="md" online={person.online} /><span><strong>{person.name}</strong><small>{person.phoneNumber}</small></span><ArrowUpRight size={16} /></button>)}{visibleContacts.length === 0 && <p className="no-contacts">No matching sample contacts.</p>}</div></> : <div className="lookup-note"><span className="lookup-note-icon"><Search size={17} /></span><p>Enter the exact phone number associated with their Lanchat account. Firebase rules only allow an account to create the lookup entry for its own verified phone number.</p></div>}
      <div className="modal-footnote">{demoMode ? 'These are sample accounts for the preview.' : 'Phone lookup requires the signed-in user to be authenticated.'}</div>
    </section>
  </div>;
}
