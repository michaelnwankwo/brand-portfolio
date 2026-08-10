/**
 * FlowBook Studio — Production JS (v3: swipe fixed)
 * - History scrollRestoration manual, no reload jump
 * - Direction-locked pointer drag: horizontal swipes deck, vertical scrolls page
 * - CSS touch-action: pan-y on deck
 * - 3D Deck: GPU rotateY/scale/opacity, snap on >40px or velocity
 * - Filter, dots, nav, counters, FAQ, reveal — complete
 */
(() => {
  "use strict";

  /* ── 0) RESET SCROLL — before any layout ── */
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch {}
  if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /* ── 1) Mobile Nav ── */
  const navToggle = $(".nav-toggle"),
    mobileNav = $("#mobile-nav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const exp = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!exp));
      navToggle.setAttribute("aria-label", exp ? "Open menu" : "Close menu");
      mobileNav.hidden = exp;
    });
    $$("a", mobileNav).forEach((a) =>
      a.addEventListener("click", () => {
        navToggle.setAttribute("aria-expanded", "false");
        mobileNav.hidden = true;
      }),
    );
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        navToggle.getAttribute("aria-expanded") === "true"
      ) {
        navToggle.setAttribute("aria-expanded", "false");
        mobileNav.hidden = true;
        navToggle.focus();
      }
    });
  }

  /* ── 2) Counters ── */
  const statNums = $$(".stat-num");
  function animateCount(el) {
    const target = parseFloat(el.dataset.count),
      suffix = el.dataset.suffix || "";
    const isFloat = String(target).includes("."),
      duration = prefersReducedMotion ? 0 : 1400;
    if (duration === 0) {
      el.textContent = target + suffix;
      return;
    }
    const start = performance.now(),
      easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const frame = (now) => {
      const p = Math.min((now - start) / duration, 1),
        e = easeOut(p),
        v = target * e;
      el.textContent = (isFloat ? v.toFixed(1) : Math.round(v)) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target + suffix;
    };
    requestAnimationFrame(frame);
  }
  if (statNums.length) {
    if ("IntersectionObserver" in window && !prefersReducedMotion) {
      const io = new IntersectionObserver(
        (ents) => {
          ents.forEach((en) => {
            if (en.isIntersecting) {
              animateCount(en.target);
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.5 },
      );
      statNums.forEach((n) => io.observe(n));
    } else statNums.forEach(animateCount);
  }

  /* ── 3) FAQ ── */
  const accordionItems = $$(".accordion-item"),
    triggers = $$(".accordion-trigger");
  function closeItem(item) {
    const t = $(".accordion-trigger", item),
      p = $(".accordion-panel", item);
    item.classList.remove("is-open");
    t.setAttribute("aria-expanded", "false");
    p.hidden = true;
  }
  function openItem(item) {
    const t = $(".accordion-trigger", item),
      p = $(".accordion-panel", item);
    item.classList.add("is-open");
    t.setAttribute("aria-expanded", "true");
    p.hidden = false;
  }
  triggers.forEach((tr) =>
    tr.addEventListener("click", () => {
      const item = tr.closest(".accordion-item"),
        wasOpen = item.classList.contains("is-open");
      accordionItems.forEach(closeItem);
      if (!wasOpen) openItem(item);
    }),
  );
  const accordion = $(".accordion");
  if (accordion)
    accordion.addEventListener("keydown", (e) => {
      const idx = triggers.indexOf(document.activeElement);
      if (idx === -1) return;
      let n = null;
      if (e.key === "ArrowDown") n = (idx + 1) % triggers.length;
      if (e.key === "ArrowUp")
        n = (idx - 1 + triggers.length) % triggers.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = triggers.length - 1;
      if (n !== null) {
        e.preventDefault();
        triggers[n].focus();
      }
    });

  /* ── 4) 3D FOCUS DECK ── */
  const deck = $("#deck"),
    dotsWrap = $(".deck-dots"),
    prevBtn = $(".deck-prev"),
    nextBtn = $(".deck-next");
  const filterTabs = $$(".filter-tab"),
    statusEl = $("#filter-status");
  let deckCards = deck ? $$(".deck-card", deck) : [];
  let activeIndex = 0,
    isAnimatingFilter = false,
    currentFilter = "all";

  function visibleCards() {
    return deckCards.filter((c) => !c.classList.contains("is-hidden"));
  }

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    const vis = visibleCards();
    vis.forEach((_, i) => {
      const b = document.createElement("button");
      b.className = "deck-dot";
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `Go to project ${i + 1} of ${vis.length}`);
      b.setAttribute("aria-selected", String(i === activeIndex));
      b.style.minHeight = "48px";
      b.style.minWidth = "48px";
      b.style.display = "grid";
      b.style.placeItems = "center";
      b.style.background = "transparent";
      b.style.border = "0";
      b.style.padding = "0";
      const inner = document.createElement("span");
      inner.style.cssText =
        "width:28px;height:8px;border-radius:999px;display:block;transition:all .3s";
      b.appendChild(inner);
      b._inner = inner;
      if (i === activeIndex) {
        b.style.color = "var(--obsidian)";
        inner.style.background = "var(--obsidian)";
        inner.style.width = "28px";
        inner.style.border = "0";
      } else {
        b.style.color = "var(--border)";
        inner.style.background = "var(--surface)";
        inner.style.border = "1px solid var(--border)";
        inner.style.width = "16px";
      }
      b.addEventListener("click", () => scrollToIndex(i));
      dotsWrap.appendChild(b);
    });
    updateDots();
  }
  function updateDots() {
    $$(".deck-dot", dotsWrap).forEach((d, i) => {
      const sel = i === activeIndex;
      d.setAttribute("aria-selected", String(sel));
      if (sel) {
        d.style.color = "var(--obsidian)";
        d._inner.style.background = "var(--obsidian)";
        d._inner.style.border = "0";
        d._inner.style.width = "28px";
      } else {
        d.style.color = "var(--border)";
        d._inner.style.background = "var(--surface)";
        d._inner.style.border = "1px solid var(--border)";
        d._inner.style.width = "16px";
      }
    });
  }
  function updateNavButtons() {
    const vis = visibleCards();
    if (!prevBtn || !nextBtn) return;
    prevBtn.disabled = activeIndex === 0;
    nextBtn.disabled = activeIndex === vis.length - 1;
  }
  function setActiveByIndex(index) {
    const vis = visibleCards();
    if (!vis.length) return;
    index = Math.max(0, Math.min(index, vis.length - 1));
    activeIndex = index;
    deckCards.forEach((c) =>
      c.classList.remove("is-active", "is-prev", "is-next"),
    );
    vis.forEach((card, i) => {
      if (i === activeIndex) card.classList.add("is-active");
      else if (i < activeIndex) card.classList.add("is-prev");
      else card.classList.add("is-next");
      if (prefersReducedMotion) {
        card.style.transform = "none";
        card.style.opacity = "1";
      } else {
        card.style.transform = "";
        card.style.opacity = "";
      }
    });
    updateDots();
    updateNavButtons();
    const title =
      vis[activeIndex]?.dataset.title || `Project ${activeIndex + 1}`;
    if (statusEl)
      statusEl.textContent = `${title} — ${activeIndex + 1} of ${vis.length}${currentFilter !== "all" ? " • filtered" : ""}`;
  }
  // Deck-only scroll — never touches window.scrollY
  function scrollToIndex(index) {
    const vis = visibleCards();
    if (!vis[index]) return;
    const left =
      vis[index].offsetLeft - (deck.clientWidth - vis[index].offsetWidth) / 2;
    deck.scrollTo({ left, behavior: prefersReducedMotion ? "auto" : "smooth" });
    setActiveByIndex(index);
  }

  // Center detection (rAF throttled, passive)
  let ticking = false;
  function onDeckScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const vis = visibleCards();
      if (!vis.length || deck.scrollWidth <= deck.clientWidth + 8) {
        ticking = false;
        return;
      }
      // ignore while user is dragging (we handle snap on release)
      if (isDown && lockAxis === "x") {
        ticking = false;
        return;
      }
      const deckRect = deck.getBoundingClientRect();
      const center = deckRect.left + deckRect.width / 2;
      let bestIdx = 0,
        bestDist = Infinity;
      vis.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      if (bestIdx !== activeIndex) setActiveByIndex(bestIdx);
      ticking = false;
    });
  }

  // ── High-performance drag: pan-y passthrough, pan-x swipes deck ──
  let isDown = false,
    isDragging = false,
    lockAxis = null,
    startX = 0,
    startY = 0,
    startScrollLeft = 0,
    startTime = 0;
  if (deck) {
    deck.addEventListener("scroll", onDeckScroll, { passive: true });

    deck.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        isDown = true;
        isDragging = false;
        lockAxis = null;
        startX = e.clientX;
        startY = e.clientY;
        startTime = e.timeStamp;
        startScrollLeft = deck.scrollLeft;
        deck.style.cursor = "grabbing";
        // don't capture yet — wait for axis lock
      },
      { passive: true },
    );

    deck.addEventListener(
      "pointermove",
      (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX,
          dy = e.clientY - startY;

        if (!lockAxis) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // dead zone
          lockAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (lockAxis === "y") {
            // yield to page scroll
            isDown = false;
            isDragging = false;
            deck.style.cursor = "";
            return;
          }
          // horizontal → take control
          isDragging = true;
          try {
            deck.setPointerCapture(e.pointerId);
          } catch {}
          deck.style.userSelect = "none";
          deck.style.scrollSnapType = "none"; // free drag without snap fighting
          deck.style.scrollBehavior = "auto";
        }

        if (lockAxis === "x" && isDragging) {
          e.preventDefault(); // only horizontal blocks default
          deck.scrollLeft = startScrollLeft - dx;
          // live 3D feedback — update nearest during drag for rotateY effect
          // lightweight: reuse onDeckScroll logic without rAF throttle for immediacy
          const vis = visibleCards();
          const deckRect = deck.getBoundingClientRect();
          const center = deckRect.left + deckRect.width / 2;
          let bestIdx = activeIndex,
            bestDist = Infinity;
          vis.forEach((card, i) => {
            const r = card.getBoundingClientRect();
            const d = Math.abs(r.left + r.width / 2 - center);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          });
          if (bestIdx !== activeIndex) setActiveByIndex(bestIdx);
        }
      },
      { passive: false },
    );

    const endDrag = (e) => {
      if (!isDown && !isDragging && !lockAxis) return;
      const wasDragging = isDragging,
        wasLock = lockAxis;
      const dx = isDown || wasDragging ? e.clientX - startX : 0;
      const dt = Math.max(1, e.timeStamp - startTime);
      const velocity = Math.abs(dx) / dt; // px/ms

      // restore snap before snapping
      deck.style.scrollSnapType = "";
      deck.style.scrollBehavior = "";
      deck.style.cursor = "";
      deck.style.userSelect = "";
      try {
        deck.releasePointerCapture(e.pointerId);
      } catch {}

      isDown = false;
      isDragging = false;
      lockAxis = null;

      if (wasLock === "x" && wasDragging) {
        // threshold: 40px or flick velocity >0.45
        if (Math.abs(dx) > 40 || velocity > 0.45) {
          if (dx < 0) scrollToIndex(activeIndex + 1);
          else scrollToIndex(activeIndex - 1);
        } else {
          // snap to nearest
          scrollToIndex(activeIndex);
        }
      }
    };
    deck.addEventListener("pointerup", endDrag);
    deck.addEventListener("pointercancel", endDrag);
    deck.addEventListener("pointerleave", (e) => {
      // if dragging and leaves, treat as end
      if (isDragging) endDrag(e);
    });

    // Also support touch fallback for older iOS (pointer covers it, but keep for safety)
    // No extra listeners needed — pointer events unify

    deck.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      }
    });
  }
  if (prevBtn)
    prevBtn.addEventListener("click", () => scrollToIndex(activeIndex - 1));
  if (nextBtn)
    nextBtn.addEventListener("click", () => scrollToIndex(activeIndex + 1));

  // Filter — two-phase, CLS-safe
  function updateTabStates(active) {
    filterTabs.forEach((t) => {
      const isActive = t.dataset.filter === active;
      t.classList.toggle("is-active", isActive);
      t.setAttribute("aria-selected", String(isActive));
      t.setAttribute("aria-pressed", String(isActive));
    });
  }
  function applyFilter(filter) {
    if (filter === currentFilter || isAnimatingFilter) return;
    isAnimatingFilter = true;
    currentFilter = filter;
    updateTabStates(filter);
    const toHide = [],
      toShow = [];
    deckCards.forEach((card) => {
      const cat = card.dataset.category;
      (filter === "all" || cat === filter ? toShow : toHide).push(card);
    });
    if (prefersReducedMotion) {
      deckCards.forEach((c) => {
        const cat = c.dataset.category;
        c.classList.toggle("is-hidden", !(filter === "all" || cat === filter));
        c.classList.remove("is-hiding", "is-entering");
      });
      activeIndex = 0;
      buildDots();
      setActiveByIndex(0);
      deck.scrollTo({ left: 0, behavior: "auto" });
      if (statusEl)
        statusEl.textContent = `Showing ${toShow.length} projects${filter !== "all" ? ` in ${filter}` : ""}.`;
      isAnimatingFilter = false;
      return;
    }
    toHide.forEach((c) => {
      c.classList.remove("is-entering");
      c.classList.add("is-hiding");
    });
    toShow.forEach((c) => {
      if (c.classList.contains("is-hidden")) {
        c.classList.remove("is-hidden");
        c.style.opacity = "0";
      }
    });
    const phase1 = toHide.length ? 280 : 0;
    setTimeout(() => {
      toHide.forEach((c) => {
        c.classList.add("is-hidden");
        c.classList.remove("is-hiding");
      });
      toShow.forEach((c) => {
        c.style.opacity = "";
        c.classList.remove("is-hidden", "is-hiding");
        void c.offsetWidth;
        c.classList.add("is-entering");
      });
      activeIndex = 0;
      buildDots();
      setActiveByIndex(0);
      deck.scrollTo({ left: 0, behavior: "smooth" });
      if (statusEl)
        statusEl.textContent = `Showing ${toShow.length} projects${filter !== "all" ? ` in ${filter}` : ""} — swipe the deck.`;
      setTimeout(() => {
        toShow.forEach((c) => c.classList.remove("is-entering"));
        isAnimatingFilter = false;
      }, 600);
    }, phase1);
  }
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => applyFilter(tab.dataset.filter));
    tab.addEventListener("keydown", (e) => {
      const idx = filterTabs.indexOf(tab);
      let nxt = null;
      if (e.key === "ArrowRight")
        nxt = filterTabs[(idx + 1) % filterTabs.length];
      if (e.key === "ArrowLeft")
        nxt = filterTabs[(idx - 1 + filterTabs.length) % filterTabs.length];
      if (nxt) {
        e.preventDefault();
        nxt.focus();
        nxt.click();
      }
    });
  });

  function initDeck() {
    if (!deck) return;
    deckCards = $$(".deck-card", deck);
    buildDots();
    setActiveByIndex(0);
    deck.scrollLeft = 0;
    requestAnimationFrame(onDeckScroll);
  }
  function boot() {
    if (!location.hash)
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    initDeck();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("load", () => {
    if (!location.hash)
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  let resizeTimer;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth >= 880 && navToggle && mobileNav) {
          navToggle.setAttribute("aria-expanded", "false");
          mobileNav.hidden = true;
        }
        onDeckScroll();
      }, 120);
    },
    { passive: true },
  );

  /* ── 5) Reveal ── */
  if (!prefersReducedMotion) {
    const heroSeq = [
      { sel: ".badge-row", v: "hero-load hero-load-up", d: 0 },
      { sel: ".hero-title", v: "hero-load hero-load-up", d: 90 },
      { sel: ".hero-sub", v: "hero-load hero-load-up", d: 180 },
      { sel: ".hero-ctas", v: "hero-load hero-load-up", d: 260 },
      { sel: ".hero-social-proof", v: "hero-load hero-load-up", d: 340 },
      { sel: ".hero-stats", v: "hero-load hero-load-up", d: 420 },
      {
        sel: ".hero-visual .phone-stack",
        v: "hero-load hero-load-scale",
        d: 380,
      },
      { sel: ".hero-visual-caption", v: "hero-load hero-load-up", d: 520 },
    ];
    heroSeq.forEach(({ sel, v, d }) => {
      const el = $(sel);
      if (el) {
        el.classList.add(...v.split(" "));
        el.style.animationDelay = d + "ms";
      }
    });
    const groups = [
      { sel: ".problem-solution .section-head", cls: "reveal reveal-up" },
      { sel: ".showcase .section-head", cls: "reveal reveal-up" },
      { sel: ".process .section-head", cls: "reveal reveal-up" },
      { sel: ".faq .faq-intro", cls: "reveal reveal-left" },
      { sel: ".final-cta .final-copy", cls: "reveal reveal-left" },
      { sel: ".compare-card.before", cls: "reveal reveal-left" },
      { sel: ".compare-card.after", cls: "reveal reveal-right", s: 80 },
      { sel: ".process-step", cls: "reveal reveal-up", s: 90 },
      { sel: ".process-guarantee", cls: "reveal reveal-up" },
      { sel: ".filter-bar", cls: "reveal reveal-up" },
      { sel: ".trust-card", cls: "reveal reveal-left", s: 70 },
      { sel: ".accordion-item", cls: "reveal reveal-up", s: 60 },
      { sel: ".final-proof .proof-card", cls: "reveal reveal-right" },
    ];
    groups.forEach((g) =>
      $$(g.sel).forEach((el, i) => {
        if (el.classList.contains("hero-load")) return;
        el.classList.add(...g.cls.split(" "));
        if (g.s) el.style.transitionDelay = i * g.s + "ms";
      }),
    );
    const ioReveal = new IntersectionObserver(
      (ents) => {
        ents.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            ioReveal.unobserve(en.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" },
    );
    $$(".reveal").forEach((el) => ioReveal.observe(el));
  } else {
    $$(".reveal,.hero-load").forEach((el) => el.classList.add("is-visible"));
  }

  console.log(
    "[FlowBook Studio] v3 swipe fixed — deck: %d cards",
    deckCards.length,
  );
})();
