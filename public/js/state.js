/* =========================================================
   STATE: één bron van waarheid voor de hele app
   ========================================================= */
function createStore(initial) {
  var state = initial, subs = [];
  return {
    get: function () { return state; },
    set: function (patch) { var prev = state; state = Object.assign({}, state, patch); subs.forEach(function (f) { f(state, prev); }); },
    subscribe: function (f) { subs.push(f); }
  };
}
var store = createStore({
  step: 'type',
  typeId: 'whatsapp',
  content: {},                                   // { [typeId]: { [fieldKey]: waarde } }
  design: Object.assign({}, QR_DEFAULT_DESIGN),
  hoverDesign: null,
  draftId: newDraftId(),                        // uniek id voor de code die je nu maakt (wordt de korte link)                            // tijdelijk voorbeeld van een ontwerpkeuze (muis erover)
  pageColor: '#00a884',                         // hoofdkleur van de pagina in de telefoon (volgt het type, zie typeColors)
  accentColor: '#075e54',                       // knopkleur
  typeColors: {},                               // eigen kleuren per type: { [typeId]: [pc, ac] }
  hoverTheme: null,
  previewUnlocked: false,
  phoneView: 'preview',                         // stap 2/3: 'preview' (de pagina) of 'qr' (de QR-code)                       // telefoon: slot-scherm overgeslagen (alleen voor de preview)                             // tijdelijk voorbeeld { pc, ac } zolang de muis over een kleur gaat
  hoverTypeId: null,                            // tegel waar de muis in stap 1 boven hangt                             // tijdelijk voorbeeld zolang de muis over de kleurkiezer gaat
  created: false,
  saving: false,
  saved: null,                                  // opgeslagen record uit de backend { id, shortUrl, ... }
  editing: null,                                // bestaande code die je aanpast { id, name, hasPassword } (vanuit Mijn QR-codes)
  error: null
});
function typeColors(id, s) { var own = (s && s.typeColors || {})[id]; return own || getType(id).theme || ['#2bb5f0', '#0f172a']; }
function rememberColors(s, pc, ac) { var m = Object.assign({}, s.typeColors); m[s.typeId] = [pc, ac]; return m; }
var actions = {
  // Elk type heeft zijn eigen kleuren (shared/qr-types.js: theme). Past de gebruiker ze aan, dan onthouden we dat per type.
  selectType: function (id) { if (store.get().editing) return; var c = typeColors(id, store.get()); store.set({ typeId: id, pageColor: c[0], accentColor: c[1], created: false, saved: null, error: null }); },
  hoverType: function (id) { if (store.get().hoverTypeId !== id) store.set({ hoverTypeId: id }); },
  goTo: function (step) { store.set({ step: step, hoverTypeId: null, previewUnlocked: false, phoneView: step === 'design' ? 'qr' : 'preview' }); },
  setField: function (key, value) {
    var s = store.get(), c = Object.assign({}, s.content), cur = Object.assign({}, c[s.typeId] || {});
    cur[key] = value; c[s.typeId] = cur; store.set({ content: c, created: false, saved: null, error: null, previewUnlocked: key === 'password' ? false : s.previewUnlocked });
    if (value) { var el = document.querySelector('[data-field="' + key + '"].invalid'); if (el) el.classList.remove('invalid'); }
  },
  setColor: function (target, c) { var s = store.get(), p = { created: false, saved: null, error: null }; p[target === 'ac' ? 'accentColor' : 'pageColor'] = c; p.typeColors = rememberColors(s, target === 'ac' ? s.pageColor : c, target === 'ac' ? c : s.accentColor); store.set(p); },
  setPhoneView: function (v) { store.set({ phoneView: v }); },
  unlockPreview: function (on) { store.set({ previewUnlocked: !!on }); },
  setTheme: function (pc, ac) { store.set({ pageColor: pc, accentColor: ac, typeColors: rememberColors(store.get(), pc, ac), created: false, saved: null, error: null }); },
  previewTheme: function (o) { var cur = store.get().hoverTheme; if (JSON.stringify(cur) !== JSON.stringify(o)) store.set({ hoverTheme: o }); },
  previewDesign: function (o) { if (o) o = safeDesign(Object.assign({}, store.get().design, o)); if (JSON.stringify(store.get().hoverDesign) !== JSON.stringify(o)) store.set({ hoverDesign: o }); },
  applyDesign: function (d) { store.set({ design: safeDesign(Object.assign({}, QR_DEFAULT_DESIGN, d)), created: false, saved: null, error: null }); },
  setDesign: function (key, value) { var d = Object.assign({}, store.get().design); d[key] = value; if (key !== 'logo' && key !== 'frameText') d.themeId = ''; /* zelf iets aangepast = eigen ontwerp */ store.set({ design: safeDesign(d), created: false, saved: null, error: null }); },
  // Opslaan. Nieuw: een nieuwe code. Bewerken: dezelfde code (zelfde link, scans blijven).
  create: function () {
    var s = store.get(), design = Object.assign({ pageColor: s.pageColor, accentColor: s.accentColor }, s.design), content = s.content[s.typeId] || {};
    store.set({ saving: true, error: null });
    var job = s.editing
      ? api.updateQrCode(s.editing.id, { content: content, design: design, keepPassword: true })
      : api.createQrCode({ id: s.draftId, typeId: s.typeId, content: content, design: design });
    job.then(function (record) {
      store.set({ saving: false, created: true, saved: record, draftId: s.editing ? s.draftId : newDraftId() });   // nieuwe code: de volgende krijgt weer een eigen id
    }).catch(function () { store.set({ saving: false, error: 'design.saveError' }); });
  },
  // Bestaande code openen in de stappen (vanuit Mijn QR-codes)
  startEdit: function (r) {
    var d = Object.assign({}, r.design), c = Object.assign({}, store.get().content), tc = typeColors(r.typeId, store.get());
    var pc = d.pageColor || tc[0], ac = d.accentColor || tc[1]; delete d.pageColor; delete d.accentColor;
    c[r.typeId] = Object.assign({}, r.content);
    store.set({ editing: { id: r.id, name: r.name || '', label: typeof MyCodes !== 'undefined' ? MyCodes.displayName(r) : (r.name || ''), hasPassword: !!r.hasPassword }, typeId: r.typeId, content: c, design: safeDesign(Object.assign({}, QR_DEFAULT_DESIGN, d)),
      pageColor: pc, accentColor: ac, draftId: r.id, saved: null, created: false, error: null, step: 'content', hoverTypeId: null, hoverDesign: null, previewUnlocked: false, phoneView: 'preview' });
  },
  // Klaar met bewerken: terug naar een lege, nieuwe code
  stopEdit: function () {
    var s = store.get(), c = Object.assign({}, s.content); if (s.editing) delete c[s.typeId];
    store.set({ editing: null, content: c, design: Object.assign({}, QR_DEFAULT_DESIGN), draftId: newDraftId(), saved: null, created: false, error: null, step: 'type', phoneView: 'preview' });
  },
  // Na het maken: meteen een nieuwe beginnen
  startNew: function () {
    var s = store.get(), c = Object.assign({}, s.content); delete c[s.typeId];
    store.set({ editing: null, content: c, design: Object.assign({}, QR_DEFAULT_DESIGN), draftId: newDraftId(), saved: null, created: false, error: null, step: 'type', phoneView: 'preview' });
  }
};
