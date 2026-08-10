/**
 * FlowBook Studio — Production JS
 * - Mobile nav toggle
 * - 3D Focus Deck slider (perspective, drag, snap, dots, filter)
 * - Category filter state machine (two-phase)
 * - Counters + FAQ accordion + Scroll Reveal
 */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /* 1) Mobile Nav */
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

  /* 2) Counters */
  const statNums = $$(".stat-num");
  function animateCount(el) {
    const target = parseFloat(el.dataset.count),
      suffix = el.dataset.suffix || "",
      isFloat = String(target).includes("."),
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

  /* 3) FAQ — single-open */
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

  /* 4) 3D FOCUS DECK — core */
  const deck = $("#deck"),
    dotsWrap = $(".deck-dots"),
    prevBtn = $(".deck-prev"),
    nextBtn = $(".deck-next");
  const filterTabs = $$(".filter-tab"),
    statusEl = $("#filter-status");
  let deckCards = $$(".deck-card", deck);
  let activeIndex = 0;
  let isAnimatingFilter = false;
  let currentFilter = "all";

  function visibleCards() {
    return deckCards.filter((c) => !c.classList.contains("is-hidden"));
  }

  // Build dots
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
      b.addEventListener("click", () => scrollToIndex(i));
      // 48px hit area via padding wrapper — but visual is pill; enlarge hit via CSS? use extra invisible padding
      b.style.minHeight = "48px";
      b.style.minWidth = "48px";
      b.style.display = "grid";
      b.style.placeItems = "center";
      // inner visual
      const inner = document.createElement("span");
      inner.style.cssText =
        "width:28px;height:8px;border-radius:999px;background:currentColor;display:block;transition:all .3s";
      // color via parent? simpler reuse pill style — override
      b.appendChild(inner);
      // style active via data
      if (i === activeIndex) {
        b.style.color = "var(--obsidian)";
        inner.style.background = "var(--obsidian)";
        inner.style.width = "28px";
      } else {
        b.style.color = "var(--border)";
        inner.style.background = "var(--surface)";
        inner.style.border = "1px solid var(--border)";
        inner.style.width = "16px";
      }
      b._inner = inner;
      dotsWrap.appendChild(b);
    });
    // Update dots visual helper
    updateDots();
  }
  function updateDots() {
    const dots = $$(".deck-dot", dotsWrap);
    dots.forEach((d, i) => {
      const sel = i === activeIndex;
      d.setAttribute("aria-selected", String(sel));
      if (sel) {
        d.style.color = "var(--obsidian)";
        d._inner.style.background = "var(--obsidian)";
        d._inner.style.borderColor = "var(--obsidian)";
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
    // Remove classes
    deckCards.forEach((c) =>
      c.classList.remove("is-active", "is-prev", "is-next"),
    );
    vis.forEach((card, i) => {
      if (i === activeIndex) card.classList.add("is-active");
      else if (i < activeIndex) card.classList.add("is-prev");
      else card.classList.add("is-next");
      // Reduced motion fallback: no rotation
      if (prefersReducedMotion) {
        card.style.transform = "none";
        card.style.opacity = "1";
      }
    });
    updateDots();
    updateNavButtons();
    // Announce
    const title =
      vis[activeIndex]?.dataset.title || `Project ${activeIndex + 1}`;
    if (statusEl)
      statusEl.textContent = `${title} — ${activeIndex + 1} of ${vis.length}${currentFilter !== "all" ? " • filtered" : ""}`;
  }
  function scrollToIndex(index) {
    const vis = visibleCards();
    if (!vis[index]) return;
    vis[index].scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
    // setActive will be handled by scroll observer, but set immediately for responsiveness
    setActiveByIndex(index);
  }
  // Detect closest to center on scroll
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
      const deckRect = deck.getBoundingClientRect();
      const center = deckRect.left + deckRect.width / 2;
      let bestIdx = 0,
        bestDist = Infinity;
      vis.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(center - c);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      if (bestIdx !== activeIndex) {
        setActiveByIndex(bestIdx);
      }
      ticking = false;
    });
  }
  // Pointer drag — enhance native scroll with grab
  let isDown = false,
    startX = 0,
    scrollLeft = 0;
  if (deck) {
    deck.addEventListener("scroll", onDeckScroll, { passive: true });
    deck.addEventListener("pointerdown", (e) => {
      isDown = true;
      deck.setPointerCapture(e.pointerId);
      startX = e.clientX;
      scrollLeft = deck.scrollLeft;
      deck.style.cursor = "grabbing";
      deck.style.userSelect = "none";
    });
    deck.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.clientX;
      const walk = x - startX;
      deck.scrollLeft = scrollLeft - walk;
    });
    const endDrag = () => {
      isDown = false;
      deck.style.cursor = "";
      deck.style.userSelect = "";
    };
    deck.addEventListener("pointerup", endDrag);
    deck.addEventListener("pointercancel", endDrag);
    deck.addEventListener("pointerleave", endDrag);
    // Keyboard
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

  // Filter state machine — two-phase
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
      const matches = filter === "all" || cat === filter;
      if (matches) toShow.push(card);
      else toHide.push(card);
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
      // scroll to start
      deck.scrollTo({ left: 0, behavior: "auto" });
      if (statusEl)
        statusEl.textContent = `Showing ${toShow.length} projects${filter !== "all" ? ` in ${filter}` : ""}.`;
      isAnimatingFilter = false;
      return;
    }
    // Phase 1: fade out
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
      // rebuild dots & reset active
      activeIndex = 0;
      buildDots();
      setActiveByIndex(0);
      deck.scrollTo({ left: 0, behavior: "smooth" });
      // announce
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
  // Init deck
  function initDeck() {
    deckCards = $$(".deck-card", deck);
    buildDots();
    setActiveByIndex(0);
    // Ensure first card centered after layout
    requestAnimationFrame(() => {
      // wait for CSS
      setTimeout(() => {
        const vis = visibleCards();
        if (vis[0])
          vis[0].scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: "auto",
          });
        onDeckScroll();
      }, 80);
    });
  }
  if (deck) initDeck();
  // Rebuild on resize (debounced)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth >= 880 && navToggle && mobileNav) {
        navToggle.setAttribute("aria-expanded", "false");
        mobileNav.hidden = true;
      }
      onDeckScroll();
    }, 120);
  });

  /* 5) Scroll Reveal & Hero load */
  if (!prefersReducedMotion) {
    const heroSeq = [
      { sel: ".badge-row", variant: "hero-load hero-load-up", delay: 0 },
      { sel: ".hero-title", variant: "hero-load hero-load-up", delay: 90 },
      { sel: ".hero-sub", variant: "hero-load hero-load-up", delay: 180 },
      { sel: ".hero-ctas", variant: "hero-load hero-load-up", delay: 260 },
      {
        sel: ".hero-social-proof",
        variant: "hero-load hero-load-up",
        delay: 340,
      },
      { sel: ".hero-stats", variant: "hero-load hero-load-up", delay: 420 },
      {
        sel: ".hero-visual .phone-stack",
        variant: "hero-load hero-load-scale",
        delay: 380,
      },
      {
        sel: ".hero-visual-caption",
        variant: "hero-load hero-load-up",
        delay: 520,
      },
    ];
    heroSeq.forEach(({ sel, variant, delay }) => {
      const el = $(sel);
      if (el) {
        el.classList.add(...variant.split(" "));
        el.style.animationDelay = delay + "ms";
      }
    });
    const revealGroups = [
      { sel: ".problem-solution .section-head", cls: "reveal reveal-up" },
      { sel: ".showcase .section-head", cls: "reveal reveal-up" },
      { sel: ".process .section-head", cls: "reveal reveal-up" },
      { sel: ".faq .faq-intro", cls: "reveal reveal-left" },
      { sel: ".final-cta .final-copy", cls: "reveal reveal-left" },
      { sel: ".compare-card.before", cls: "reveal reveal-left" },
      { sel: ".compare-card.after", cls: "reveal reveal-right", stagger: 80 },
      { sel: ".process-step", cls: "reveal reveal-up", stagger: 90 },
      { sel: ".process-guarantee", cls: "reveal reveal-up" },
      { sel: ".filter-bar", cls: "reveal reveal-up" },
      { sel: ".trust-card", cls: "reveal reveal-left", stagger: 70 },
      { sel: ".accordion-item", cls: "reveal reveal-up", stagger: 60 },
      { sel: ".final-proof .proof-card", cls: "reveal reveal-right" },
      {
        sel: ".site-footer .footer-inner > *",
        cls: "reveal reveal-up",
        stagger: 80,
      },
    ];
    revealGroups.forEach((g) => {
      $$(g.sel).forEach((el, i) => {
        if (el.classList.contains("hero-load")) return;
        el.classList.add(...g.cls.split(" "));
        if (g.stagger) el.style.transitionDelay = i * g.stagger + "ms";
      });
    });
    const revealEls = $$(".reveal");
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
    revealEls.forEach((el) => ioReveal.observe(el));
    const finalBtn = $(".final-actions .btn-primary");
    if (finalBtn) {
      const ioBtn = new IntersectionObserver(
        (ents) => {
          ents.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              ioBtn.unobserve(e.target);
            }
          });
        },
        { threshold: 0.5 },
      );
      ioBtn.observe(finalBtn);
    }
  } else {
    $$(".reveal,.hero-load").forEach((el) => el.classList.add("is-visible"));
    // ensure deck inactive styles are non-3D
    deckCards.forEach((c) => {
      c.style.transform = "none";
      c.style.opacity = "1";
    });
  }

  console.log(
    "[FlowBook Studio] Ready — deck: %d cards, filters: %d, accordion: %d",
    deckCards.length,
    filterTabs.length,
    accordionItems.length,
  );
})();
