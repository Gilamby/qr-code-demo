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
  pageColor: '#2bb5f0',                         // hoofdkleur van de pagina in de telefoon
  accentColor: '#0f172a',                       // knopkleur
  hoverTheme: null,
  previewUnlocked: false,
  phoneView: 'preview',                         // stap 2/3: 'preview' (de pagina) of 'qr' (de QR-code)                       // telefoon: slot-scherm overgeslagen (alleen voor de preview)                             // tijdelijk voorbeeld { pc, ac } zolang de muis over een kleur gaat
  hoverTypeId: null,                            // tegel waar de muis in stap 1 boven hangt                             // tijdelijk voorbeeld zolang de muis over de kleurkiezer gaat
  created: false,
  saving: false,
  saved: null,                                  // opgeslagen record uit de backend { id, shortUrl, ... }
  error: null
});
var actions = {
  selectType: function (id) { store.set({ typeId: id, created: false, saved: null, error: null }); },
  hoverType: function (id) { if (store.get().hoverTypeId !== id) store.set({ hoverTypeId: id }); },
  goTo: function (step) { store.set({ step: step, hoverTypeId: null, previewUnlocked: false, phoneView: step === 'design' ? 'qr' : 'preview' }); },
  setField: function (key, value) {
    var s = store.get(), c = Object.assign({}, s.content), cur = Object.assign({}, c[s.typeId] || {});
    cur[key] = value; c[s.typeId] = cur; store.set({ content: c, created: false, saved: null, error: null, previewUnlocked: key === 'password' ? false : s.previewUnlocked });
    if (value) { var el = document.querySelector('[data-field="' + key + '"].invalid'); if (el) el.classList.remove('invalid'); }
  },
  setColor: function (target, c) { var p = { created: false, saved: null, error: null }; p[target === 'ac' ? 'accentColor' : 'pageColor'] = c; store.set(p); },
  setPhoneView: function (v) { store.set({ phoneView: v }); },
  unlockPreview: function (on) { store.set({ previewUnlocked: !!on }); },
  setTheme: function (pc, ac) { store.set({ pageColor: pc, accentColor: ac, created: false, saved: null, error: null }); },
  previewTheme: function (o) { var cur = store.get().hoverTheme; if (JSON.stringify(cur) !== JSON.stringify(o)) store.set({ hoverTheme: o }); },
  previewDesign: function (o) { if (JSON.stringify(store.get().hoverDesign) !== JSON.stringify(o)) store.set({ hoverDesign: o }); },
  applyDesign: function (d) { store.set({ design: Object.assign({}, QR_DEFAULT_DESIGN, d), created: false, saved: null, error: null }); },
  setDesign: function (key, value) { var d = Object.assign({}, store.get().design); d[key] = value; if (key !== 'logo' && key !== 'frameText') d.themeId = ''; /* zelf iets aangepast = eigen ontwerp */ store.set({ design: d, created: false, saved: null, error: null }); },
  create: function () {
    var s = store.get();
    store.set({ saving: true, error: null });
    api.available().then(function (online) {
      if (!online) { store.set({ saving: false, created: true, saved: null }); return; }   // demo zonder server: niets opslaan
      return api.createQrCode({ id: s.draftId, typeId: s.typeId, content: s.content[s.typeId] || {}, design: Object.assign({ pageColor: s.pageColor, accentColor: s.accentColor }, s.design) })
        .then(function (record) { store.set({ saving: false, created: true, saved: record, draftId: newDraftId() }); });   // volgende code krijgt weer een nieuw id
    }).catch(function () { store.set({ saving: false, error: 'design.saveError' }); });
  }
};
