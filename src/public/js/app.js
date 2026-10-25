document.addEventListener('click', function (e) {
  var btn = e.target.closest('.flash-dismiss');
  if (!btn) return;
  var flash = btn.closest('.flash');
  if (flash) flash.remove();
});

// CSP (script-src 'self') blocks inline onsubmit="..." handlers, so
// confirmation prompts on forms go through this instead of an inline attribute.
document.addEventListener('submit', function (e) {
  var form = e.target;
  if (form.matches('[data-confirm]') && !window.confirm(form.getAttribute('data-confirm'))) {
    e.preventDefault();
  }
});
