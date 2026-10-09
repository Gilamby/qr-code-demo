/* Express 4 vangt fouten in async routes niet zelf op (dat doet Express 5 wel).
   Dit stuurt elke afgewezen Promise van een route of middleware door naar de foutafhandeling (next(err)),
   zodat één fout nooit de hele server laat crashen. Zelfde aanpak als het pakket express-async-errors. */
const Layer = require('express/lib/router/layer');

const original = Layer.prototype.handle_request;
Layer.prototype.handle_request = function (req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return original.call(this, req, res, next);       // foutafhandelaar (err, req, res, next)
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) { next(e); }
};
