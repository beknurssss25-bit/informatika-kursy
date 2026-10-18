/* Procedural laptop screen: draws animated code + the "next sections" (about / pricing / booking)
   onto a 2D canvas that is used as a texture in Three.js. No images, no external assets. */
export function createScreen(W, H) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const K = W / 1600;                         // logical coordinate system: 1600 x 1000
  const SANS = '"Onest", system-ui, "Segoe UI", Roboto, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
  const BG = '#0A0F1F';
  const C = { p: '#7C5CFF', c: '#22D3EE', pink: '#FF6AC1', amber: '#FFB547', ok: '#3DDC97', ink: '#EAF0FF', mute: '#8E9AC8' };

  /* ---------------- helpers ---------------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lg(x0, y0, x1, y1, a, b) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function txt(s, x, y, font, color, align, spacing) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing || '0px';
    ctx.fillText(s, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  const ease = t => t * t * (3 - 2 * t);

  /* ---------------- code slide: editor (typed by scroll) -> run -> output ---------------- */
  const CODE = [
    '# Моя первая программа',
    'print("Привет, мир!")',
    '',
    'for i in range(1, 3):',
    '    print("Шаг", i)',
    '',
    'print("2 + 3 =", 2 + 3)',
  ];
  const KW = /^(def|for|in|return|if|else|import|from|while)$/;
  function tokenize(line) {
    const out = []; let m; const re = /(#.*$)|("[^"]*")|(\b\d+\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;
    while ((m = re.exec(line))) {
      if (m[1]) out.push([m[1], '#5F6D9E']);
      else if (m[2]) out.push([m[2], '#FFD27A']);
      else if (m[3]) out.push([m[3], '#FF8FB1']);
      else if (m[4]) {
        const w = m[4], rest = line.slice(re.lastIndex);
        out.push([w, KW.test(w) ? '#B69CFF' : /^(print|input|range|sum)$/.test(w) ? '#5EE1F7' : (/^\s*\(/.test(rest) ? '#7DE3B5' : '#E6EBFF')]);
      } else if (m[5]) out.push([m[5], null]);
      else out.push([m[6], '#9FB0F0']);
    }
    return out;
  }
  const TOK = CODE.map(tokenize);
  const TOTAL = CODE.reduce((a, l) => a + l.length + 1, 0) - 1;     // characters incl. line breaks
  const OUT = ['Привет, мир!', 'Шаг 1', 'Шаг 2', '2 + 3 = 5', '✓ Готово'];
  /* type: 0..1 = share of the program typed; run: 0..1 = run progress (button press, then output lines) */
  function drawCode(t, type, run, g) {
    const typed = type * TOTAL, running = run > 0.001, FS = g.fs, LH = g.lh;
    // editor panel
    rr(g.ex, 120, g.ew, g.eh, 22); ctx.fillStyle = '#0D1430'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); rr(g.ex, 120, g.ew, g.eh, 22); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(g.ex, 120, g.gut, g.eh);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(g.ex, 120, g.ew, 72);
    txt('main.py', g.ex + 36, 168, '600 30px ' + MONO, '#8E9AC8');
    // run button: glows when the program is typed, "pressed" while running
    const ready = Math.max(0, Math.min(1, (type - 0.97) / 0.03)), press = running ? 1 : 0;
    const bw = 250, bx = g.ex + g.ew - bw - 28, by = 136;
    ctx.save();
    if (ready > 0) { ctx.shadowColor = C.ok; ctx.shadowBlur = (press ? 8 : 24 + 10 * Math.sin(t * 5)) * ready; }
    rr(bx, by, bw, 46, 23); ctx.fillStyle = press ? '#2BB57A' : ready > 0 ? lg(bx, 0, bx + bw, 0, '#3DDC97', '#22D3EE') : 'rgba(255,255,255,.08)'; ctx.fill(); ctx.restore();
    txt('▶  Запустить', bx + bw / 2, by + 33, '800 27px ' + SANS, ready > 0 ? '#06251A' : '#6B769F', 'center');
    ctx.font = '600 ' + FS + 'px ' + MONO; const cw = ctx.measureText('M').width;
    let left = Math.floor(typed + 0.0001), y = g.y0, curX = g.cx0, curY = g.y0;
    for (let i = 0; i < CODE.length; i++) {
      txt(String(i + 1), g.ex + g.gut - 24, y, '500 ' + Math.round(FS * 0.78) + 'px ' + MONO, '#3F4B7A', 'right');
      if (left >= 0) {
        let x = g.cx0, rem = left;
        for (const [s, col] of TOK[i]) {
          if (rem <= 0) break;
          const part = s.slice(0, rem); rem -= s.length;
          if (col) txt(part, x, y, '600 ' + FS + 'px ' + MONO, col);
          x += part.length * cw;
        }
        curX = x; curY = y; left -= CODE[i].length + 1;
      }
      y += LH;
    }
    if (!running && (typed < TOTAL || Math.floor(t * 2.2) % 2 === 0)) { ctx.fillStyle = C.c; ctx.fillRect(curX + 2, curY - FS * 0.85, Math.max(4, FS * 0.12), FS * 1.05); }
    ctx.restore();
    // terminal / output panel
    rr(g.tx, g.ty, g.tw, g.th, 22); ctx.fillStyle = '#080C1B'; ctx.fill(); ctx.strokeStyle = running ? 'rgba(61,220,151,.45)' : 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.stroke();
    txt(running ? '$ python main.py' : 'ВЫВОД', g.tx + 36, g.ty + 62, '700 ' + g.hf + 'px ' + MONO, running ? '#6F7DB0' : '#5F6D9E', 'left', running ? '0px' : '3px');
    if (!running) {
      txt('Нажмите «Запустить»', g.tx + 36, g.ty + g.th / 2 + 10, '600 ' + g.pf + 'px ' + MONO, '#46538A');
      txt('чтобы увидеть результат', g.tx + 36, g.ty + g.th / 2 + 10 + g.pf * 1.5, '600 ' + g.pf + 'px ' + MONO, '#46538A');
    } else {
      const p = Math.max(0, (run - 0.12) / 0.88) * OUT.length;      // line i appears at p>i, typed quickly
      for (let i = 0; i < OUT.length; i++) {
        const k = Math.max(0, Math.min(1, p - i)); if (k <= 0) continue;
        const str = OUT[i].slice(0, Math.ceil(OUT[i].length * k));
        txt(str, g.tx + 36, g.ty + g.oy + i * g.ol, '600 ' + g.of + 'px ' + MONO, i === OUT.length - 1 ? C.ok : '#EAF0FF');
      }
    }
  }
  const GW = { ex: 40, ew: 960, eh: 840, gut: 90, fs: 42, lh: 84, y0: 285, cx0: 150, tx: 1030, ty: 120, tw: 530, th: 840, hf: 26, pf: 25, of: 36, ol: 70, oy: 160 };
  const GC = { ex: 40, ew: 1520, eh: 500, gut: 90, fs: 46, lh: 56, y0: 262, cx0: 150, tx: 40, ty: 640, tw: 1520, th: 335, hf: 30, pf: 36, of: 44, ol: 54, oy: 125 };
  function slideCode(t, st) { drawCode(t, st.type, st.run, GW); }
  function slideCodeC(t, st) { drawCode(t, st.type, st.run, GC); }

  /* ---------------- about slide ---------------- */
  function slideAbout(t) {
    txt('О КУРСАХ', 80, 215, '700 30px ' + MONO, C.c, 'left', '5px');
    txt('Учим думать', 80, 345, '800 120px ' + SANS, C.ink);
    ctx.font = '800 120px ' + SANS; const w2 = ctx.measureText('как программист').width;
    txt('как программист', 80, 475, '800 120px ' + SANS, lg(80, 0, 80 + w2, 0, '#9B87FF', '#3FD8F5'));
    txt('Школьники 5–11 классов · 60 минут · очно', 84, 560, '500 40px ' + SANS, C.mute);
    const chips = [['Python', C.p], ['Алгоритмы', C.c], ['HTML и CSS', C.pink], ['Подготовка к ЕНТ', C.amber]];
    let x = 80;
    chips.forEach(([s, col], i) => {
      ctx.font = '700 38px ' + SANS; const w = ctx.measureText(s).width + 70, yy = 630 + Math.sin(t * 1.6 + i) * 4;
      rr(x, yy, w, 84, 42); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 36, yy + 42, 9, 0, 7); ctx.fillStyle = col; ctx.fill();
      txt(s, x + 58, yy + 55, '700 38px ' + SANS, C.ink); x += w + 22;
      if (x > 1100 && i < 3) { x = 80; }
    });
    [['8', 'модулей'], ['40', 'занятий'], ['3', 'тарифа']].forEach(([n, l], i) => {
      const yy = 800 + i * 0; const xx = 80 + i * 330;
      txt(n, xx, yy + 90, '800 96px ' + SANS, lg(xx, 0, xx + 120, 0, C.p, C.c));
      ctx.font = '800 96px ' + SANS; const nw = ctx.measureText(n).width;
      txt(l, xx + nw + 18, yy + 90, '500 36px ' + SANS, C.mute);
    });
    // decorative code-orb on the right
    const cx = 1300, cy = 480; ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 300); g.addColorStop(0, 'rgba(124,92,255,.55)'); g.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 320, cy - 320, 640, 640);
    ctx.translate(cx, cy); ctx.rotate(Math.sin(t * .5) * .08);
    txt('</>', 0, 40, '800 150px ' + MONO, lg(-120, 0, 120, 0, '#B69CFF', '#5EE1F7'), 'center'); ctx.restore();
  }

  /* ---------------- pricing slide ---------------- */
  function slidePrice(t) {
    txt('ТАРИФЫ', 80, 215, '700 30px ' + MONO, C.c, 'left', '5px');
    txt('Выберите срок обучения', 80, 325, '800 92px ' + SANS, C.ink);
    const P = [['1 месяц', '25 000', '8 занятий'], ['2 месяца', '50 000', '16 занятий'], ['5 месяцев', '100 000', '40 занятий · выгода 20%']];
    P.forEach(([n, pr, d], i) => {
      const x = 80 + i * 490, y = 400 + (i === 2 ? -14 : 0) + Math.sin(t * 1.4 + i * 1.3) * 5, w = 450, h = 520 + (i === 2 ? 28 : 0);
      rr(x, y, w, h, 34);
      ctx.fillStyle = i === 2 ? lg(x, y, x + w, y + h, 'rgba(124,92,255,.40)', 'rgba(34,211,238,.20)') : 'rgba(255,255,255,.05)'; ctx.fill();
      ctx.lineWidth = i === 2 ? 5 : 2; ctx.strokeStyle = i === 2 ? C.amber : 'rgba(255,255,255,.16)'; ctx.stroke();
      if (i === 2) { rr(x + w / 2 - 150, y - 26, 300, 52, 26); ctx.fillStyle = lg(x, 0, x + w, 0, '#FFB547', '#FF7A59'); ctx.fill(); txt('САМЫЙ ВЫГОДНЫЙ', x + w / 2, y + 10, '800 24px ' + SANS, '#2B1500', 'center', '2px'); }
      txt(n, x + 40, y + 100, '800 54px ' + SANS, C.ink);
      txt(pr, x + 40, y + 260, '800 110px ' + SANS, i === 2 ? '#FFD58A' : lg(x, 0, x + 300, 0, '#B69CFF', '#5EE1F7'));
      ctx.font = '800 110px ' + SANS; const pw = ctx.measureText(pr).width;
      txt('₸', x + 46 + pw, y + 260, '700 56px ' + SANS, C.mute);
      txt(d, x + 40, y + 340, '600 34px ' + SANS, '#8FDBF0');
      const items = ['Диагностика уровня', 'Проверка домашних заданий', 'Электронные материалы'];
      items.forEach((s, k) => { txt('✓', x + 40, y + 410 + k * 48, '800 30px ' + SANS, C.ok); txt(s, x + 86, y + 410 + k * 48, '500 28px ' + SANS, '#CFD7FF'); });
    });
  }

  /* ---------------- booking slide ---------------- */
  const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function slideBook(t) {
    const now = new Date();
    txt('ОНЛАЙН-ЗАПИСЬ', 80, 215, '700 30px ' + MONO, C.c, 'left', '5px');
    txt('Выберите день и время', 80, 325, '800 92px ' + SANS, C.ink);
    // calendar card
    rr(80, 385, 880, 575, 30); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
    txt(MN[now.getMonth()] + ' ' + now.getFullYear(), 120, 462, '800 44px ' + SANS, C.ink);
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((d, i) => txt(d, 150 + i * 113, 520, '700 24px ' + MONO, C.mute, 'center'));
    const dow = (now.getDay() + 6) % 7, selIdx = dow + 3 + (Math.floor(t / 2.6) % 3) * 1;
    for (let i = 0; i < 28; i++) {
      const col = i % 7, row = Math.floor(i / 7), d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i);
      const x = 150 + col * 113, y = 580 + row * 84, off = col === 6, sel = i === selIdx, past = i < dow;
      if (sel) { ctx.save(); ctx.shadowColor = C.p; ctx.shadowBlur = 24; rr(x - 42, y - 36, 84, 70, 18); ctx.fillStyle = lg(x, y - 30, x, y + 30, C.p, '#8B5CF6'); ctx.fill(); ctx.restore(); }
      else { rr(x - 42, y - 36, 84, 70, 18); ctx.fillStyle = off || past ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.06)'; ctx.fill(); }
      txt(String(d.getDate()), x, y + 12, '700 32px ' + SANS, sel ? '#fff' : off || past ? '#4A557F' : C.ink, 'center');
    }
    // slots
    txt('Время', 1010, 462, '800 44px ' + SANS, C.ink);
    const hours = [10, 11, 12, 13, 14, 15, 16, 17], busy = { 12: 1, 15: 1 }, selH = 14;
    hours.forEach((h, i) => {
      const x = 1010 + (i % 2) * 280, y = 495 + Math.floor(i / 2) * 88, b = busy[h], s = h === selH;
      rr(x, y, 250, 70, 18);
      ctx.fillStyle = s ? lg(x, y, x + 250, y, C.p, '#8B5CF6') : b ? 'rgba(255,255,255,.03)' : 'rgba(61,220,151,.12)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = s ? 'transparent' : b ? 'rgba(255,255,255,.08)' : 'rgba(61,220,151,.45)'; ctx.stroke();
      txt(h + ':00', x + 125, y + 47, '700 32px ' + SANS, s ? '#fff' : b ? '#56628F' : '#7CF0BE', 'center');
      if (b) { ctx.fillStyle = '#56628F'; ctx.fillRect(x + 80, y + 33, 90, 3); }
    });
    rr(1010, 860, 530, 100, 26); ctx.fillStyle = lg(1010, 0, 1540, 0, C.p, C.c);
    ctx.save(); ctx.shadowColor = 'rgba(124,92,255,.7)'; ctx.shadowBlur = 30 + 10 * Math.sin(t * 3); ctx.fill(); ctx.restore();
    txt('Записаться', 1275, 925, '800 42px ' + SANS, '#fff', 'center');
  }


  /* ---------------- compact (portrait/mobile) variants: bigger type, less detail ---------------- */
  function slideAboutC(t) {
    txt('О КУРСАХ', 80, 215, '700 44px ' + MONO, C.c, 'left', '6px');
    txt('Учим думать', 80, 380, '800 160px ' + SANS, C.ink);
    ctx.font = '800 160px ' + SANS; const w2 = ctx.measureText('как программист').width;
    txt('как программист', 80, 540, '800 160px ' + SANS, lg(80, 0, 80 + w2, 0, '#9B87FF', '#3FD8F5'));
    txt('Школьники 5–11 классов · очно', 84, 630, '500 56px ' + SANS, C.mute);
    [['Python', C.p], ['Алгоритмы', C.c], ['HTML и CSS', C.pink], ['Подготовка к ЕНТ', C.amber]].forEach(([s, col], i) => {
      const x = 80 + (i % 2) * 750, y = 690 + Math.floor(i / 2) * 140 + Math.sin(t * 1.6 + i) * 4;
      rr(x, y, 720, 112, 56); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 50, y + 56, 13, 0, 7); ctx.fillStyle = col; ctx.fill();
      txt(s, x + 84, y + 74, '700 54px ' + SANS, C.ink);
    });
  }
  function slidePriceC(t) {
    txt('ТАРИФЫ', 80, 205, '700 44px ' + MONO, C.c, 'left', '6px');
    txt('Выберите срок', 80, 330, '800 120px ' + SANS, C.ink);
    [['1 месяц', '25 000', '8 занятий'], ['2 месяца', '50 000', '16 занятий'], ['5 месяцев', '100 000', '40 занятий · выгода 20%']].forEach(([n, pr, d], i) => {
      const x = 60, y = 375 + i * 205 + Math.sin(t * 1.4 + i * 1.3) * 4, w = 1480, h = 182;
      rr(x, y, w, h, 40);
      ctx.fillStyle = i === 2 ? lg(x, y, x + w, y + h, 'rgba(124,92,255,.42)', 'rgba(34,211,238,.22)') : 'rgba(255,255,255,.06)'; ctx.fill();
      ctx.lineWidth = i === 2 ? 6 : 2; ctx.strokeStyle = i === 2 ? C.amber : 'rgba(255,255,255,.18)'; ctx.stroke();
      txt(n, x + 50, y + 82, '800 68px ' + SANS, C.ink);
      txt(d, x + 50, y + 142, '600 42px ' + SANS, '#8FDBF0');
      ctx.font = '800 112px ' + SANS; const pw = ctx.measureText(pr).width;
      txt(pr, x + w - 120 - pw, y + 128, '800 112px ' + SANS, i === 2 ? '#FFD58A' : lg(x + w - 700, 0, x + w - 120, 0, '#B69CFF', '#5EE1F7'));
      txt('₸', x + w - 100, y + 126, '700 62px ' + SANS, C.mute);
    });
  }
  function slideBookC(t) {
    const now = new Date();
    txt('ОНЛАЙН-ЗАПИСЬ', 80, 205, '700 44px ' + MONO, C.c, 'left', '6px');
    txt('Запись онлайн', 80, 320, '800 120px ' + SANS, C.ink);
    txt(MN[now.getMonth()] + ' ' + now.getFullYear(), 80, 405, '800 56px ' + SANS, C.mute);
    const dow = (now.getDay() + 6) % 7, selIdx = dow + 3 + (Math.floor(t / 2.6) % 3);
    for (let i = 0; i < 14; i++) {
      const col = i % 7, row = Math.floor(i / 7), d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i);
      const x = 185 + col * 205, y = 490 + row * 135, off = col === 6, sel = i === selIdx, past = i < dow;
      if (sel) { ctx.save(); ctx.shadowColor = C.p; ctx.shadowBlur = 26; rr(x - 84, y - 52, 168, 112, 26); ctx.fillStyle = lg(x, y - 50, x, y + 50, C.p, '#8B5CF6'); ctx.fill(); ctx.restore(); }
      else { rr(x - 84, y - 52, 168, 112, 26); ctx.fillStyle = off || past ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.07)'; ctx.fill(); }
      txt(String(d.getDate()), x, y + 22, '700 66px ' + SANS, sel ? '#fff' : off || past ? '#4A557F' : C.ink, 'center');
    }
    [[10, 0], [11, 1], [14, 2], [16, 0]].forEach(([h, st], i) => {
      const x = 80 + i * 375, y = 770, s = st === 2;
      rr(x, y, 345, 100, 28); ctx.fillStyle = s ? lg(x, y, x + 345, y, C.p, '#8B5CF6') : st === 1 ? 'rgba(255,255,255,.03)' : 'rgba(61,220,151,.13)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = s ? 'transparent' : st === 1 ? 'rgba(255,255,255,.08)' : 'rgba(61,220,151,.45)'; ctx.stroke();
      txt(h + ':00', x + 172, y + 68, '700 58px ' + SANS, s ? '#fff' : st === 1 ? '#56628F' : '#7CF0BE', 'center');
    });
    rr(80, 893, 1440, 92, 30); ctx.fillStyle = lg(80, 0, 1520, 0, C.p, C.c);
    ctx.save(); ctx.shadowColor = 'rgba(124,92,255,.7)'; ctx.shadowBlur = 28 + 10 * Math.sin(t * 3); ctx.fill(); ctx.restore();
    txt('Записаться', 800, 957, '800 56px ' + SANS, '#fff', 'center');
  }

  /* ---------------- window chrome ---------------- */
  const TABS = ['Код', 'О курсах', 'Тарифы', 'Запись'];
  function chrome(active, big) {
    ctx.fillStyle = '#0D1330'; ctx.fillRect(0, 0, 1600, 92);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, 90, 1600, 2);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.beginPath(); ctx.arc(48 + i * 36, 46, 11, 0, 7); ctx.fillStyle = c; ctx.fill(); });
    let x = 190;
    TABS.forEach((s, i) => {
      const fs = big ? 38 : 30; ctx.font = '700 ' + fs + 'px ' + (i === 0 ? MONO : SANS); const w = ctx.measureText(s).width + 60, a = Math.max(0, 1 - Math.abs(i - active));
      rr(x, 16, w, 68, 18);
      ctx.fillStyle = `rgba(124,92,255,${0.08 + 0.35 * a})`; ctx.fill();
      if (a > 0.05) { const prev = ctx.globalAlpha; ctx.fillStyle = lg(x, 0, x + w, 0, C.p, C.c); ctx.globalAlpha = prev * a; ctx.fillRect(x + 18, 80, w - 36, 4); ctx.globalAlpha = prev; }
      txt(s, x + w / 2, big ? 62 : 59, '700 ' + fs + 'px ' + (i === 0 ? MONO : SANS), a > .5 ? '#fff' : C.mute, 'center');
      x += w + 14;
    });
  }

  /* ---------------- main draw ---------------- */
  const slidesWide = [slideCode, slideAbout, slidePrice, slideBook], slidesC = [slideCodeC, slideAboutC, slidePriceC, slideBookC];
  const api = { canvas: cv, draw, ease, compact: false };
  function draw(t, sl, fade, type, run) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(K, 0, 0, K, 0, 0);
    const keep = 1 - Math.min(1, fade * 1.25);
    if (keep > 0.003) {
      ctx.globalAlpha = keep;
      // ambient colour glows
      let g = ctx.createRadialGradient(240, 140, 10, 240, 140, 800); g.addColorStop(0, 'rgba(124,92,255,.28)'); g.addColorStop(1, 'rgba(124,92,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 1000);
      g = ctx.createRadialGradient(1400, 960, 10, 1400, 960, 800); g.addColorStop(0, 'rgba(34,211,238,.20)'); g.addColorStop(1, 'rgba(34,211,238,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 1000);
      chrome(sl, api.compact); const slides = api.compact ? slidesC : slidesWide;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 92, 1600, 908); ctx.clip();
      for (let i = 0; i < slides.length; i++) {
        const d = i - sl, a = Math.max(0, 1 - Math.abs(d) * 1.5);
        if (a < 0.01) continue;
        ctx.save(); ctx.globalAlpha = keep * a; ctx.translate(d * 380, 0); slides[i](t, { type, run }); ctx.restore();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  return api;
}
