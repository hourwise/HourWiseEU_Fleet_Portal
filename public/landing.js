/* ==========================================================================
   HourWise EU — static landing page enhancements (optional).
   The landing page works fully with JavaScript disabled: the mobile menu is
   a CSS checkbox toggle and the FAQ uses native <details>/<summary>. This
   script only adds polish: header background on scroll and auto-closing the
   mobile menu after choosing a link.
   ========================================================================== */
(function () {
  'use strict';

  // Header: add a subtle background once the page is scrolled.
  var header = document.getElementById('site-header');
  var toggle = document.getElementById('nav-toggle');

  function onScroll() {
    if (!header) return;
    if (window.scrollY > 20) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu: close after tapping a nav link.
  if (toggle && header) {
    var links = header.querySelectorAll('.nav-links a, .nav-actions a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        if (toggle.checked) toggle.checked = false;
      });
    }
  }
})();
