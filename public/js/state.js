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
  design: { color: DESIGN_OPTIONS.colors[0], background: DESIGN_OPTIONS.backgrounds[0] },
  pageColor: '#2bb5f0',                         // kleur van de pagina in de telefoon
  hoverColor: null,
  hoverTypeId: null,                            // tegel waar de muis in stap 1 boven hangt                             // tijdelijk voorbeeld zolang de muis over de kleurkiezer gaat
  created: false,
  saving: false,
  saved: null,                                  // opgeslagen record uit de backend { id, shortUrl, ... }
  error: null
});
var actions = {
  selectType: function (id) { store.set({ typeId: id, created: false, saved: null, error: null }); },
  hoverType: function (id) { if (store.get().hoverTypeId !== id) store.set({ hoverTypeId: id }); },
  goTo: function (step) { store.set({ step: step, hoverTypeId: null }); },
  setField: function (key, value) {
    var s = store.get(), c = Object.assign({}, s.content), cur = Object.assign({}, c[s.typeId] || {});
    cur[key] = value; c[s.typeId] = cur; store.set({ content: c, created: false, saved: null, error: null });
  },
  setPageColor: function (c) { store.set({ pageColor: c, created: false, saved: null, error: null }); },
  previewPageColor: function (c) { if (store.get().hoverColor !== c) store.set({ hoverColor: c }); },
  setDesign: function (key, value) { var d = Object.assign({}, store.get().design); d[key] = value; store.set({ design: d, created: false, saved: null, error: null }); },
  create: function () {
    var s = store.get();
    store.set({ saving: true, error: null });
    api.available().then(function (online) {
      if (!online) { store.set({ saving: false, created: true, saved: null }); return; }   // demo zonder server: niets opslaan
      return api.createQrCode({ typeId: s.typeId, content: s.content[s.typeId] || {}, design: Object.assign({ pageColor: s.pageColor }, s.design) })
        .then(function (record) { store.set({ saving: false, created: true, saved: record }); });
    }).catch(function () { store.set({ saving: false, error: 'design.saveError' }); });
  }
};
