/* =========================================================
   WACHTWOORD-REGELS (zelfde als op de server, auth.service.ts)
   Minstens 8 tekens, 1 hoofdletter, 1 cijfer en 1 speciaal teken (zoals ! ? @ # -).
   PasswordRules.list(html-id) geeft een lijstje dat live afvinkt; PasswordRules.watch(root) koppelt het aan
   elk veld met data-pw-rules. PasswordRules.problem(pw) geeft dezelfde foutcode als de server.
   ========================================================= */
var PasswordRules = (function () {
  var RULES = [
    ['len', function (s) { return s.length >= 8; }],
    ['upper', function (s) { return /\p{Lu}/u.test(s); }],
    ['digit', function (s) { return /\p{N}/u.test(s); }],
    ['special', function (s) { return /[^\p{L}\p{N}\s]/u.test(s); }]
  ];
  var CODE = { len: 'short', upper: 'upper', digit: 'digit', special: 'special' };
  var CHECK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function list(id, value) {
    var s = String(value || '');
    return '<ul class="pw-rules" id="' + id + '" aria-label="' + esc(t('pw.rules')) + '">' + RULES.map(function (r) {
      var ok = r[1](s);
      return '<li data-rule="' + r[0] + '" data-ok="' + ok + '">' + CHECK + '<span>' + t('pw.rule.' + r[0]) + '</span><span class="sr-only">' + (ok ? ' ✓' : '') + '</span></li>';
    }).join('') + '</ul>';
  }
  function update(input) {
    var ul = document.getElementById(input.getAttribute('data-pw-rules')); if (!ul) return;
    RULES.forEach(function (r) {
      var li = ul.querySelector('[data-rule="' + r[0] + '"]'), ok = r[1](input.value);
      if (li && li.getAttribute('data-ok') !== String(ok)) { li.setAttribute('data-ok', String(ok)); li.lastChild.textContent = ok ? ' ✓' : ''; }
    });
  }
  // Eén keer: alle velden met data-pw-rules bijwerken terwijl je typt
  document.addEventListener('input', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-pw-rules')) update(e.target); });
  return {
    list: list,
    /** '' = goed, anders 'short' | 'upper' | 'digit' | 'special' (zelfde codes als de server, met "password_" ervoor) */
    problem: function (pw) { var s = String(pw || ''); for (var i = 0; i < RULES.length; i++) if (!RULES[i][1](s)) return CODE[RULES[i][0]]; return ''; },
    errorKey: function (code) { return { password_short: 'auth.errShort', password_long: 'auth.errLong', password_common: 'auth.errCommon', password_upper: 'auth.errUpper', password_digit: 'auth.errDigit', password_special: 'auth.errSpecial', password_pwned: 'auth.errPwned' }[code]; }
  };
})();
