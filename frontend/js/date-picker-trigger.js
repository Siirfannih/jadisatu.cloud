/**
 * Buka date picker saat user klik area tanggal (tanpa harus klik ikon kalender).
 * Pasang class "date-picker-trigger" pada wrapper yang membungkus input[type=date].
 */
(function () {
  function openPicker(wrap) {
    var inp = wrap && wrap.querySelector('input[type=date]');
    if (!inp) return;
    try {
      if (typeof inp.showPicker === 'function') inp.showPicker();
      else inp.click();
    } catch (e) {
      inp.click();
    }
  }
  document.addEventListener('click', function (e) {
    var wrap = e.target.closest('.date-picker-trigger');
    if (!wrap) return;
    openPicker(wrap);
  });
})();
