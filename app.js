(function () {
  'use strict';
  var book = document.getElementById('book');
  var statusEl = document.getElementById('status');
  var DEFAULT_HTML = book.innerHTML; // النسخة الأصلية المدمجة في الملف
  var editing = true;
  var activeSlot = null;

  /* ---------- تخزين محلي (IndexedDB) ---------- */
  var DB = 'dofaa75', STORE = 'kv';
  function openDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function dbGet(k) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction(STORE).objectStore(STORE).get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function dbSet(k, v) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(v, k);
        t.oncomplete = res; t.onerror = function () { rej(t.error); };
      });
    });
  }
  function dbDel(k) {
    return openDB().then(function (db) {
      return new Promise(function (res) {
        var t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).delete(k); t.oncomplete = res;
      });
    });
  }

  /* ---------- أدوات ---------- */
  function say(msg) {
    statusEl.textContent = msg;
    clearTimeout(say.t);
    say.t = setTimeout(function () { statusEl.textContent = ''; }, 2500);
  }
  function fit() {
    var s = Math.min(1, (window.innerWidth - 20) / 794);
    document.documentElement.style.setProperty('--s', s);
  }
  window.addEventListener('resize', fit); fit();

  function cleanHTML() {
    var c = book.cloneNode(true);
    c.querySelectorAll('.pagebar').forEach(function (n) { n.remove(); });
    c.querySelectorAll('[contenteditable]').forEach(function (n) { n.removeAttribute('contenteditable'); });
    return c.innerHTML;
  }

  var saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      dbSet('book', cleanHTML()).then(function () { say('تم الحفظ'); }).catch(function () { say('تعذّر الحفظ في المتصفح'); });
    }, 600);
  }

  /* ---------- تهيئة الصفحات ---------- */
  function setup() {
    book.querySelectorAll('.slot').forEach(function (s) {
      if (!s.dataset.label && !s.classList.contains('filled')) s.dataset.label = s.textContent.trim();
    });
    book.querySelectorAll('.pw').forEach(function (pw) {
      if (pw.querySelector('.pagebar')) return;
      var bar = document.createElement('div');
      bar.className = 'pagebar';
      bar.innerHTML = '<button data-a="up">لأعلى</button><button data-a="down">لأسفل</button><button data-a="dup">نسخ الصفحة</button><button data-a="del" class="dl">حذف الصفحة</button>';
      pw.insertBefore(bar, pw.firstChild);
    });
    applyEditing();
  }
  function applyEditing() {
    document.body.classList.toggle('editing', editing);
    book.querySelectorAll('.t').forEach(function (t) {
      if (editing) t.setAttribute('contenteditable', 'true'); else t.removeAttribute('contenteditable');
    });
    var b = document.getElementById('bEdit');
    b.textContent = 'وضع التعديل: ' + (editing ? 'شغّال' : 'مقفول');
    b.classList.toggle('on', editing);
  }

  /* ---------- رفع الصور ---------- */
  function fillSlot(slot, dataUrl) {
    slot.classList.add('filled');
    slot.innerHTML = '<img alt="" src="' + dataUrl + '"><button class="rm" title="إزالة الصورة">×</button>';
  }
  function emptySlot(slot) {
    slot.classList.remove('filled');
    slot.textContent = slot.dataset.label || 'صورة';
  }
  function resize(file, max) {
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
          res(c.toDataURL('image/jpeg', 0.85));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  document.getElementById('fImg').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f || !activeSlot) return;
    resize(f, 1400).then(function (url) { fillSlot(activeSlot, url); scheduleSave(); })
      .catch(function () { say('الصورة دي مش مدعومة'); });
  });

  /* ---------- أحداث الصفحة ---------- */
  book.addEventListener('click', function (e) {
    var rm = e.target.closest('.rm');
    if (rm && editing) { emptySlot(rm.closest('.slot')); scheduleSave(); e.stopPropagation(); return; }
    var bb = e.target.closest('.pagebar button');
    if (bb) { pageAction(bb.closest('.pw'), bb.dataset.a); return; }
    var slot = e.target.closest('.slot');
    if (slot && editing) { activeSlot = slot; document.getElementById('fImg').click(); }
  });
  book.addEventListener('input', scheduleSave);
  book.addEventListener('paste', function (e) {
    var t = e.target.closest && e.target.closest('.t');
    if (!t) return;
    e.preventDefault();
    var txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, txt);
  });
  book.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.t') && !e.shiftKey) {
      /* Enter يعمل سطر جديد داخل نفس العنصر */
      e.preventDefault(); document.execCommand('insertLineBreak');
    }
  });

  function pageAction(pw, a) {
    if (a === 'up' && pw.previousElementSibling) pw.parentNode.insertBefore(pw, pw.previousElementSibling);
    else if (a === 'down' && pw.nextElementSibling) pw.parentNode.insertBefore(pw.nextElementSibling, pw);
    else if (a === 'dup') {
      var c = pw.cloneNode(true);
      c.querySelector('.pagebar').remove();
      pw.parentNode.insertBefore(c, pw.nextSibling);
      setup();
    } else if (a === 'del') {
      if (book.querySelectorAll('.pw').length < 2) return;
      if (confirm('تحذف الصفحة دي؟')) pw.remove();
    }
    scheduleSave();
  }

  /* ---------- الأزرار ---------- */
  document.getElementById('bEdit').onclick = function () { editing = !editing; applyEditing(); };
  document.getElementById('bPrint').onclick = function () { window.print(); };
  document.getElementById('bSave').onclick = function () {
    var blob = new Blob([JSON.stringify({ v: 1, html: cleanHTML() })], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kitab-dofaa75.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    say('اتحفظ الملف، ابعته لمنسق الكتاب');
  };
  document.getElementById('bOpen').onclick = function () { document.getElementById('fProj').click(); };
  document.getElementById('fProj').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || typeof d.html !== 'string') throw 0;
        loadHTML(d.html); scheduleSave(); say('اتفتح الملف');
      } catch (_) { say('الملف مش صالح'); }
    };
    fr.readAsText(f);
  });
  document.getElementById('bReset').onclick = function () {
    if (!confirm('ترجع للنسخة الأصلية؟ التعديلات اللي في المتصفح هتتمسح (احفظ ملف المشروع الأول لو عايزها).')) return;
    dbDel('book').then(function () { return loadShared(); }).then(function () { say('رجعنا للنسخة الأصلية'); });
  };

  /* ---------- تحميل ---------- */
  function loadHTML(html) { book.innerHTML = html; setup(); }
  // لو في ملف book-data.json جنب الموقع (نسخة الدفعة المعتمدة) يتحمّل، وإلا النسخة المدمجة
  function loadShared() {
    return fetch('book-data.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { loadHTML(d.html); })
      .catch(function () { loadHTML(DEFAULT_HTML); });
  }
  dbGet('book').then(function (saved) {
    if (saved) loadHTML(saved); else return loadShared();
  }).catch(function () { setup(); });
  setup();
})();
