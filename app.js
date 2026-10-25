(function () {
  'use strict';
  var cfg = window.BOOK_CONFIG || {};
  var book = document.getElementById('book');
  var statusEl = document.getElementById('status');
  var editing = true;
  var activeSlot = null;
  var sb = null;
  var remote = {};   // آخر قيمة معروفة لكل عنصر
  var timers = {};
  var els = {};

  /* ---------- أدوات ---------- */
  function say(msg, keep) {
    statusEl.textContent = msg;
    clearTimeout(say.t);
    if (!keep) say.t = setTimeout(function () { statusEl.textContent = ''; }, 2500);
  }
  function fit() {
    document.documentElement.style.setProperty('--s', Math.min(1, (window.innerWidth - 20) / 794));
  }
  window.addEventListener('resize', fit); fit();

  /* ---------- تهيئة العناصر ---------- */
  book.querySelectorAll('[data-k]').forEach(function (el) {
    els[el.dataset.k] = el;
    if (el.classList.contains('slot')) el.dataset.label = el.textContent.trim();
  });

  function applyEditing() {
    document.body.classList.toggle('editing', editing);
    book.querySelectorAll('.t').forEach(function (t) {
      if (editing) t.setAttribute('contenteditable', 'true'); else t.removeAttribute('contenteditable');
    });
    var b = document.getElementById('bEdit');
    b.textContent = editing ? 'وضع التعديل: شغّال' : 'وضع المشاهدة';
    b.classList.toggle('on', editing);
  }

  function fillSlot(slot, url) {
    slot.classList.add('filled');
    slot.innerHTML = '<img alt="" src="' + url + '"><button class="rm" title="إزالة الصورة">×</button>';
  }
  function emptySlot(slot) {
    slot.classList.remove('filled');
    slot.textContent = slot.dataset.label || 'صورة';
  }

  function applyItem(row) {
    var el = els[row.k];
    if (!el) return;
    remote[row.k] = row.value;
    if (el.classList.contains('slot')) {
      if (row.value) fillSlot(el, row.value); else emptySlot(el);
    } else {
      if (document.activeElement === el) return; // ما نقاطعش اللي بيكتب
      if (el.innerText !== row.value) el.innerText = row.value;
    }
  }

  /* ---------- الاتصال بقاعدة البيانات ---------- */
  function upsert(k, kind, value) {
    if (!sb) { say('الموقع لسه مش مربوط بقاعدة البيانات'); return Promise.resolve(); }
    remote[k] = value;
    return sb.from('items').upsert({ k: k, kind: kind, value: value, updated_at: new Date().toISOString() })
      .then(function (r) { if (r.error) say('فشل الحفظ، جرب تاني'); else say('اتحفظ ✓'); });
  }

  function init() {
    applyEditing();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
      say('الموقع لسه مش مربوط بقاعدة البيانات (راجع config.js)', true);
      return;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    say('بحمّل آخر نسخة...', true);
    sb.from('items').select('*').limit(5000).then(function (r) {
      if (r.error) { say('تعذّر الاتصال بقاعدة البيانات', true); return; }
      r.data.forEach(applyItem);
      say('آخر نسخة جاهزة ✓');
    });
    sb.channel('book-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, function (p) {
        if (p.new && p.new.k) applyItem(p.new);
      })
      .subscribe();
  }

  /* ---------- النصوص ---------- */
  function saveText(el) {
    var k = el.dataset.k;
    var v = el.innerText.replace(/\s+$/, '');
    if (v === remote[k]) return;
    if (remote[k] === undefined && v === el.dataset.orig) return;
    upsert(k, 'text', v);
  }
  book.querySelectorAll('.t[data-k]').forEach(function (el) { el.dataset.orig = el.innerText.replace(/\s+$/, ''); });

  book.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('.t[data-k]');
    if (!el) return;
    clearTimeout(timers[el.dataset.k]);
    timers[el.dataset.k] = setTimeout(function () { saveText(el); }, 900);
  });
  book.addEventListener('focusout', function (e) {
    var el = e.target.closest && e.target.closest('.t[data-k]');
    if (!el) return;
    clearTimeout(timers[el.dataset.k]);
    saveText(el);
  });
  book.addEventListener('paste', function (e) {
    if (!(e.target.closest && e.target.closest('.t'))) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });
  book.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.t') && !e.shiftKey) {
      e.preventDefault(); document.execCommand('insertLineBreak');
    }
  });

  /* ---------- الصور ---------- */
  function toBlob(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = rej;
      fr.onload = function () {
        var img = new Image();
        img.onerror = rej;
        img.onload = function () {
          var k = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', 0.82);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  book.addEventListener('click', function (e) {
    var rm = e.target.closest('.rm');
    if (rm && editing) {
      var s = rm.closest('.slot');
      emptySlot(s);
      upsert(s.dataset.k, 'img', '');
      e.stopPropagation(); return;
    }
    var slot = e.target.closest('.slot');
    if (slot && editing) { activeSlot = slot; document.getElementById('fImg').click(); }
  });

  document.getElementById('fImg').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    var slot = activeSlot;
    if (!f || !slot) return;
    if (!sb) { say('الموقع لسه مش مربوط بقاعدة البيانات'); return; }
    say('برفع الصورة...', true);
    toBlob(f, 1400).then(function (blob) {
      var path = slot.dataset.k + '-' + Date.now() + '.jpg';
      return sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' }).then(function (r) {
        if (r.error) throw r.error;
        var url = sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
        fillSlot(slot, url);
        return upsert(slot.dataset.k, 'img', url);
      });
    }).catch(function () { say('فشل رفع الصورة، جرب صورة تانية'); });
  });

  /* ---------- الأزرار ---------- */
  document.getElementById('bEdit').onclick = function () { editing = !editing; applyEditing(); };
  document.getElementById('bPrint').onclick = function () { window.print(); };

  init();
})();
