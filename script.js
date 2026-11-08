(function () {
  'use strict';

  var root = document.documentElement;
  var deck = document.getElementById('deck');
  var nav = document.getElementById('sectionNav');
  var indicator = document.getElementById('pageIndicator');
  if (!deck || !nav || !indicator) return;

  root.classList.add('js');
  try {
    if (window.CSS && CSS.supports &&
        (CSS.supports('mask-image', 'url(x.png)') || CSS.supports('-webkit-mask-image', 'url(x.png)'))) {
      root.classList.add('mask');
    }
  } catch (e) {}

  var slides = Array.prototype.slice.call(deck.querySelectorAll('.slide'));
  var labels = [
    '제안', '시장 맥락', '브랜드 진단', '전환 경로',
    '매체비 계획', '손익분기', '8주 실행', '다음 단계'
  ];
  var current = -1;
  var countFrame = 0;
  var settleTimer = 0;
  var programmaticTarget = null;
  var targetExpiresAt = 0;
  var wheelTotal = 0;
  var lastWheel = 0;
  var wheelLockUntil = 0;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  slides.forEach(function (slide, index) {
    slide.id = 'slide-' + (index + 1);
    slide.setAttribute('aria-label', (index + 1) + ' / ' + slides.length + ' ' + (labels[index] || '화면'));
    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'section-link';
    link.setAttribute('aria-label', (index + 1) + '번 화면: ' + (labels[index] || '화면'));
    link.setAttribute('aria-controls', slide.id);
    link.title = (index + 1) + '. ' + (labels[index] || '화면');
    link.innerHTML = '<span class="section-number">' + String(index + 1).padStart(2, '0') +
      '</span><span class="section-name">' + (labels[index] || '화면') + '</span>';
    link.addEventListener('click', function () { go(index); });
    nav.appendChild(link);

    Array.prototype.forEach.call(slide.querySelectorAll('.rise'), function (element, itemIndex) {
      element.style.transitionDelay = (0.08 + itemIndex * 0.07) + 's';
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-c]'), function (element) {
    var raw = element.textContent.trim();
    element.dataset.to = raw.replace(/,/g, '');
    element.dataset.dec = (raw.split('.')[1] || '').length;
    element.dataset.comma = raw.indexOf(',') > -1 ? '1' : '0';
    element.style.display = 'inline-block';
    element.style.fontVariantNumeric = 'tabular-nums';
  });

  function formatNumber(value, element) {
    var result = value.toFixed(+element.dataset.dec);
    if (element.dataset.comma === '1') {
      var parts = result.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      result = parts.join('.');
    }
    return result;
  }

  function count(slide) {
    if (countFrame) cancelAnimationFrame(countFrame);
    var elements = Array.prototype.slice.call(slide.querySelectorAll('[data-c]'));
    if (!elements.length) return;
    if (reducedMotion) {
      elements.forEach(function (element) { element.textContent = formatNumber(+element.dataset.to, element); });
      return;
    }
    elements.forEach(function (element) { element.textContent = formatNumber(0, element); });
    var start = null;
    function step(time) {
      if (start === null) start = time;
      var progress = Math.min(1, Math.max(0, (time - start - 300) / 1200));
      var eased = 1 - Math.pow(1 - progress, 3);
      elements.forEach(function (element) {
        var target = +element.dataset.to;
        element.textContent = formatNumber(progress >= 1 ? target : target * eased, element);
      });
      if (progress < 1) countFrame = requestAnimationFrame(step);
    }
    countFrame = requestAnimationFrame(step);
  }

  function activate(index) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    if (index === current) return;
    current = index;
    slides.forEach(function (slide, itemIndex) { slide.classList.toggle('on', itemIndex === index); });
    Array.prototype.forEach.call(nav.children, function (link, itemIndex) {
      var active = itemIndex === index;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    root.classList.toggle('on-dark', slides[index].classList.contains('dark'));
    indicator.textContent = (index + 1) + ' / ' + slides.length;
    count(slides[index]);
  }

  function go(index) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    programmaticTarget = index;
    targetExpiresAt = Date.now() + 1400;
    wheelLockUntil = Math.max(wheelLockUntil, Date.now() + 650);
    activate(index);
    deck.scrollTo({ top: index * deck.clientHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
    scheduleSettle();
  }

  function settleScroll() {
    clearTimeout(settleTimer);
    settleTimer = 0;
    if (programmaticTarget !== null &&
        Math.abs(deck.scrollTop - programmaticTarget * deck.clientHeight) > 2 &&
        Date.now() < targetExpiresAt) {
      scheduleSettle();
      return;
    }
    programmaticTarget = null;
    activate(Math.round(deck.scrollTop / deck.clientHeight));
  }

  function scheduleSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settleScroll, 220);
  }

  deck.addEventListener('scroll', scheduleSettle, { passive: true });
  deck.addEventListener('scrollend', settleScroll);

  window.addEventListener('wheel', function (event) {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? deck.clientHeight : 1);
    if (!delta) return;
    if (programmaticTarget !== null && Date.now() < wheelLockUntil) {
      event.preventDefault();
      return;
    }

    // A slide may need its own scroll on short screens so its full content remains readable.
    var slide = slides[current];
    if (slide && slide.scrollHeight > slide.clientHeight + 2 &&
        ((delta > 0 && slide.scrollTop < slide.scrollHeight - slide.clientHeight - 2) ||
         (delta < 0 && slide.scrollTop > 2))) {
      wheelTotal = 0;
      if (!slide.contains(event.target)) {
        event.preventDefault();
        slide.scrollTop += delta;
      }
      return;
    }

    event.preventDefault();
    var now = Date.now();
    if (now < wheelLockUntil) return;
    if (now - lastWheel > 250 || Math.sign(wheelTotal) !== Math.sign(delta)) wheelTotal = 0;
    lastWheel = now;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) < 35) return;
    var direction = Math.sign(wheelTotal);
    wheelTotal = 0;
    wheelLockUntil = now + 650;
    go(current + direction);
  }, { passive: false });

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select')) return;
    if (['ArrowDown', 'PageDown', 'ArrowRight', ' '].indexOf(event.key) > -1) {
      event.preventDefault(); go(current + 1);
    } else if (['ArrowUp', 'PageUp', 'ArrowLeft'].indexOf(event.key) > -1) {
      event.preventDefault(); go(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault(); go(0);
    } else if (event.key === 'End') {
      event.preventDefault(); go(slides.length - 1);
    } else if ((event.key === 'f' || event.key === 'F') && root.requestFullscreen) {
      if (!document.fullscreenElement) root.requestFullscreen();
      else document.exitFullscreen();
    }
  });

  window.addEventListener('resize', function () {
    if (current >= 0) deck.scrollTop = current * deck.clientHeight;
  });

  activate(0);
})();
