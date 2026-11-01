// Entgeltrechner (Brutto → Netto) mit SV-Werten 2026. Lohnsteuer wird eingegeben (wie in AkA-Aufgaben vorgegeben).
import { W } from '../../content.js';
import { svAN, svAG, r2 } from '../../lib/calc.js';
import { parseNumber, fmt } from '../../lib/template.js';
import { header, badge2026, icon, esc } from '../../ui.js';
import { mehrLinks } from '../mehr.js';

const e = (x) => fmt(x, '€');

function view(el) {
  el.innerHTML = `
    ${header('Entgeltrechner', '#/mehr')}
    <p class="small muted">Sozialversicherung mit den Werten 2026 ${badge2026()}. Lohnsteuer bitte aus der Aufgabe bzw. Lohnsteuertabelle eintragen.</p>
    <form class="card calc-form" id="f" autocomplete="off">
      <label class="field">Bruttoentgelt (€/Monat)<input type="text" inputmode="decimal" name="brutto" value="3400"></label>
      <label class="field">geldwerter Vorteil / VL-Zuschuss AG (€)<input type="text" inputmode="decimal" name="zusatzBrutto" value="0"></label>
      <label class="field">Lohnsteuer (€)<input type="text" inputmode="decimal" name="lst" value="0"></label>
      <label class="field">Solidaritätszuschlag (€)<input type="text" inputmode="decimal" name="soli" value="0"></label>
      <label class="field">Kirchensteuer
        <select name="kist"><option value="0">keine</option><option value="9" selected>9 % (z. B. Rheinland-Pfalz)</option><option value="8">8 % (Bayern, Baden-Württemberg)</option></select></label>
      <label class="field">KV-Zusatzbeitrag der Kasse (%)<input type="text" inputmode="decimal" name="zusatz" value="${String(W.kvZusatzDurchschnitt).replace('.', ',')}"></label>
      <label class="field">Kinder (unter 25 Jahre)<select name="kinder">${[0, 1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="kinderlos23"> kinderlos und mindestens 23 Jahre alt</label>
      <label class="check"><input type="checkbox" name="sachsen"> Beschäftigungsort Sachsen</label>
      <label class="field">Abzüge nach Netto (VL-Sparbetrag, Vorschuss …) (€)<input type="text" inputmode="decimal" name="abzug" value="0"></label>
    </form>
    <div id="out" aria-live="polite"></div>`;

  const f = el.querySelector('#f');
  function calc() {
    const v = Object.fromEntries(new FormData(f));
    const num = (k) => { const n = parseNumber(v[k]); return Number.isFinite(n) ? n : 0; };
    const brutto = num('brutto') + num('zusatzBrutto');
    const kinder = Number(v.kinder);
    const kinderlos = !!v.kinderlos23 && kinder === 0;
    const opts = { zusatz: num('zusatz'), kinder, kinderlos, sachsen: !!v.sachsen };
    const an = svAN(W, brutto, opts);
    const ag = svAG(W, brutto, opts);
    const lst = num('lst'); const soli = num('soli');
    const kist = r2(lst * Number(v.kist) / 100);
    const netto = r2(brutto - lst - soli - kist - an.summe);
    const ausz = r2(netto - num('abzug'));
    const hinweis = brutto <= W.minijobGrenze ? `Achtung: bis ${e(W.minijobGrenze)} liegt ein Minijob vor – Pauschalbeiträge, diese Rechnung passt nicht.`
      : brutto <= W.uebergangsbereichBis ? `Hinweis: Im Übergangsbereich (bis ${e(W.uebergangsbereichBis)}) sind die AN-Beiträge in der Praxis reduziert. Gerechnet wird hier ohne Midijob-Formel.` : '';
    el.querySelector('#out').innerHTML = `
      <section class="card">
        <h2 class="h-small">Abrechnung</h2>
        ${hinweis ? `<p class="badge warn" style="white-space:normal">${esc(hinweis)}</p>` : ''}
        <table class="tbl"><tbody>
          <tr><td>Steuer-/SV-Brutto</td><td>${e(brutto)}</td></tr>
          <tr><td>− Lohnsteuer</td><td>${e(lst)}</td></tr>
          <tr><td>− Solidaritätszuschlag</td><td>${e(soli)}</td></tr>
          <tr><td>− Kirchensteuer (${v.kist} %)</td><td>${e(kist)}</td></tr>
          <tr><td>− KV (${fmt((W.kvAllgemein + opts.zusatz) / 2, '%')})</td><td>${e(an.kv)}</td></tr>
          <tr><td>− PV (${fmt(an.pvSatz, '%')})</td><td>${e(an.pv)}</td></tr>
          <tr><td>− RV (${fmt(W.rv / 2, '%')})</td><td>${e(an.rv)}</td></tr>
          <tr><td>− AV (${fmt(W.av / 2, '%')})</td><td>${e(an.av)}</td></tr>
          <tr><th>= Nettoentgelt</th><th class="num">${e(netto)}</th></tr>
          <tr><td>− sonstige Abzüge</td><td>${e(num('abzug'))}</td></tr>
          <tr><th>= Auszahlung</th><th class="num">${e(ausz)}</th></tr>
        </tbody></table>
        ${brutto > W.bbgKvMonat ? `<p class="small muted">KV/PV nur bis zur BBG ${e(W.bbgKvMonat)} berechnet${brutto > W.bbgRvMonat ? `, RV/AV bis ${e(W.bbgRvMonat)}` : ''}.</p>` : ''}
      </section>
      <section class="card">
        <h2 class="h-small">Arbeitgeber</h2>
        <table class="tbl"><tbody>
          <tr><td>KV</td><td>${e(ag.kv)}</td></tr><tr><td>PV</td><td>${e(ag.pv)}</td></tr>
          <tr><td>RV</td><td>${e(ag.rv)}</td></tr><tr><td>AV</td><td>${e(ag.av)}</td></tr>
          <tr><td>Insolvenzgeldumlage</td><td>${e(ag.u3)}</td></tr>
          <tr><th>AG-Anteile gesamt</th><th class="num">${e(ag.summe)}</th></tr>
          <tr><th>Personalkosten (ohne U1/U2, BG)</th><th class="num">${e(r2(brutto + ag.summe))}</th></tr>
        </tbody></table>
      </section>`;
  }
  f.addEventListener('input', calc);
  f.addEventListener('change', calc);
  f.addEventListener('submit', (ev) => ev.preventDefault());
  calc();
}

export function register(addRoute) {
  addRoute({ path: 'rechner', view, nav: 'mehr' });
  mehrLinks.push({ href: '#/rechner', label: 'Entgeltrechner', text: 'Brutto → Netto mit SV-Sätzen 2026', icon: icon.chart, order: 30 });
}
