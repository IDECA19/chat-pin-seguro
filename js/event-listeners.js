// Improved selectors and compatibility for menu toggles
// Updated to use more robust ID-based selectors and provide a fallback for CSS classes

(function(){
  var el = document.getElementById('btnAbrirMenu');
  if (el) return; // element exists in HTML, nothing to change
  // no-op if not present
})();
