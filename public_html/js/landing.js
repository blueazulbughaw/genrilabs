/* ============================================================
   GENRI LABS — LANDING ANIMATIONS (GSAP + ScrollTrigger)

   Every animation is keyed off a data attribute in the HTML, so you
   can add/remove animated elements without touching this file:

     data-anim="rise"       → load-time entrance (hero text)
     data-anim="split"      → heading whose words rise out of a mask on load
     data-anim="float"      → panels that float up when scrolled into view
     data-anim="trace"      → circuit path that draws itself on load
     data-anim="scene3d"    → hero 3D scene: tilted pose that flattens on scroll
     data-anim="tilt-scene" → inner scene layer that follows the pointer
     data-anim="flip"       → cards that flip up in 3D when scrolled into view
     data-tilt              → element tilts toward the pointer in 3D on hover
     data-anim="step"       → run-log lines that tick in, on a loop
     data-anim="progress"   → line that fills as its section scrolls by
     data-anim="words"      → paragraph whose words light up with scroll
     data-depth="0..4"      → hero layers parallaxed at depth-based speeds

   The Work cards are loaded from data/projects.json (published by the
   admin); see the PROJECTS block at the bottom of this file.

   Content is fully visible without JS or with reduced motion;
   everything here is progressive enhancement.
   ============================================================ */

(function () {
  "use strict";

  // Mobile/tablet hamburger menu. Kept outside the reduced-motion
  // gated IIFE below so it always works regardless of GSAP/motion prefs.
  const toggle = document.querySelector(".nav__toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  const closeMenu = () => {
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  document.addEventListener("click", (e) => {
    if (!links.classList.contains("is-open")) return;
    if (!links.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
      closeMenu();
    }
  });

  // If the viewport grows past the tablet breakpoint, drop any open state.
  window.matchMedia("(min-width: 960px)").addEventListener("change", closeMenu);
})();

(function () {
  "use strict";

  // Respect the user's OS-level motion preference. If reduced
  // motion is on, we skip GSAP entirely — content is fully
  // visible by default, animations are progressive enhancement.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  // Touch devices get lighter effects (no pointer parallax, smaller drift).
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  /* Wrap every word of an element in spans, keeping inline children
     like <em> intact. Returns the innermost word spans. */
  function splitWords(el, wordClass, innerClass) {
    const out = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const word = document.createElement("span");
            word.className = wordClass;
            if (innerClass) {
              const inner = document.createElement("span");
              inner.className = innerClass;
              inner.textContent = part;
              word.appendChild(inner);
              out.push(inner);
            } else {
              word.textContent = part;
              out.push(word);
            }
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
    return out;
  }

  /* ---------- 1. Hero heading: masked word rise ---------- */
  document.querySelectorAll("[data-anim='split']").forEach((el) => {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const words = splitWords(el, "word", "word__inner");
    words.forEach((w) => w.parentElement.setAttribute("aria-hidden", "true"));
    gsap.from(words, {
      yPercent: 60,
      rotateX: -90,
      opacity: 0,
      duration: 1.1,
      ease: "power3.out",
      stagger: 0.06,
      delay: 0.1,
    });
  });

  /* ---------- 2. Hero sub-copy + CTAs: staggered rise ---------- */
  gsap.from("[data-anim='rise']", {
    y: 24,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    stagger: 0.12,
    delay: 0.45,
  });

  /* ---------- 3. Circuit traces: draw the signature line ---------- */
  gsap.utils.toArray("[data-anim='trace']").forEach((path, i) => {
    const len = path.getTotalLength();
    gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.8, ease: "power1.inOut", delay: 0.4 + i * 0.25 }
    );
  });
  gsap.from(".hero .node", {
    scale: 0, transformOrigin: "50% 50%", opacity: 0,
    duration: 0.4, stagger: 0.12, delay: 1.2, ease: "back.out(2)",
  });

  /* ---------- 4. Hero depth parallax ----------
     Far layers drift slower than the page. Text (depth 4) stays at
     scroll speed; the 3D scene (depth 3) is handled in step 5. */
  const drift = { 0: 220, 1: 140, 2: 80 };
  document.querySelectorAll(".hero [data-depth]").forEach((layer) => {
    const d = drift[layer.dataset.depth];
    if (!d) return;
    gsap.to(layer, {
      y: coarse ? d * 0.5 : d,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  });

  /* ---------- 5. Hero 3D scene ----------
     a) Entrance: the card and chips fly in from deep in z-space.
     b) Scroll: the tilted scene flattens, lifts and scales up.
     c) Pointer: the inner layer rotates toward the cursor, so chips at
        different translateZ depths visibly slide against the card.
        Touch devices get a slow idle sway instead. */
  const scene = document.querySelector("[data-anim='scene3d']");
  const tilt = document.querySelector("[data-anim='tilt-scene']");
  if (scene && tilt) {
    gsap.from(".hero__card", { z: -500, rotateX: 30, opacity: 0, duration: 1.6, ease: "power3.out", delay: 0.5 });
    gsap.from(".chip", { z: -700, opacity: 0, duration: 1.4, ease: "power3.out", stagger: 0.15, delay: 1.0 });
    gsap.from(".scene3d__floor", { opacity: 0, duration: 2, delay: 0.6 });

    gsap.fromTo(scene,
      { rotateX: 24, rotateY: -18, y: 0, scale: 0.95 },
      {
        rotateX: 0, rotateY: 0, y: -60, scale: 1.06,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 30%", scrub: 0.6 },
      }
    );

    if (!coarse) {
      const hero = document.querySelector(".hero");
      const rotY = gsap.quickTo(tilt, "rotationY", { duration: 0.9, ease: "power3.out" });
      const rotX = gsap.quickTo(tilt, "rotationX", { duration: 0.9, ease: "power3.out" });
      const glowX = gsap.quickTo(".hero__glow", "x", { duration: 1.2, ease: "power3.out" });
      const markX = gsap.quickTo(".hero__mark", "x", { duration: 1.6, ease: "power3.out" });
      hero.addEventListener("pointermove", (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        rotY(nx * 26);
        rotX(ny * -16);
        glowX(nx * 80);
        markX(nx * -40);
      });
      hero.addEventListener("pointerleave", () => { rotY(0); rotX(0); });
    } else {
      gsap.fromTo(tilt, { rotateY: -8, rotateX: 3 }, {
        rotateY: 8, rotateX: -3, duration: 6, ease: "sine.inOut", yoyo: true, repeat: -1,
      });
    }
  }

  /* ---------- 5b. Card 3D hover tilt (data-tilt) ---------- */
  function bindTilt(els) {
    if (coarse) return;
    els.forEach((el) => {
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 16);
        rx((py - 0.5) * -14);
        el.style.setProperty("--mx", px * 100 + "%");
        el.style.setProperty("--my", py * 100 + "%");
      });
      el.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
  }
  bindTilt(document.querySelectorAll("[data-tilt]"));

  /* ---------- 6. Run log: lines tick in one by one, then replay ---------- */
  const steps = gsap.utils.toArray("[data-anim='step']");
  if (steps.length) {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.5, delay: 1.4 });
    tl.from(steps, {
      opacity: 0, x: -14, duration: 0.5, ease: "power2.out", stagger: 0.9,
    });
    tl.from(".runlog__tick", {
      scale: 0.4, opacity: 0.2, duration: 0.35, ease: "back.out(3)", stagger: 0.9,
    }, 0.2);
    tl.to(steps, { opacity: 0.25, duration: 0.5, stagger: 0.05 }, "+=3");
  }

  /* ---------- 7. Floating panels: trigger-once entrances ----------
     ScrollTrigger.batch groups elements that enter together so
     cards in the same row stagger instead of popping simultaneously. */
  function bindFloat(els) {
    gsap.set(els, { y: 40, opacity: 0 });
    ScrollTrigger.batch(els, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
        }),
    });
  }
  bindFloat(gsap.utils.toArray("[data-anim='float']"));

  // Lets the projects loader (below) animate cards it adds later.
  window.GenriMotion = { bindFloat, bindTilt };

  /* ---------- 7b. Process steps flip up in 3D ---------- */
  gsap.set("[data-anim='flip']", { rotateX: -70, y: 60, opacity: 0, transformOrigin: "50% 0%", transformPerspective: 900 });
  ScrollTrigger.batch("[data-anim='flip']", {
    start: "top 85%",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        rotateX: 0, y: 0, opacity: 1,
        duration: 1.1, ease: "power3.out", stagger: 0.15,
        onComplete: () => gsap.set(batch, { transformOrigin: "50% 50%" }),
      }),
  });

  /* ---------- 8. Process line fills with scroll ---------- */
  document.querySelectorAll("[data-anim='progress']").forEach((bar) => {
    gsap.fromTo(bar, { scaleY: 0 }, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: {
        trigger: bar.closest(".process__steps") || bar,
        start: "top 70%",
        end: "bottom 60%",
        scrub: true,
      },
    });
  });

  /* ---------- 9. Statement words light up as you scroll ---------- */
  document.querySelectorAll("[data-anim='words']").forEach((el) => {
    const words = splitWords(el, "lit-word");
    gsap.fromTo(words, { opacity: 0.15 }, {
      opacity: 1,
      ease: "none",
      stagger: 0.1,
      scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 50%", scrub: true },
    });
  });
})();

/* ============================================================
   PROJECTS — the "Work" cards come from data/projects.json, which
   the admin publishes on every save. The cards already in the HTML
   are the fallback: if the file is missing or broken, they stay.
   ============================================================ */
(function () {
  "use strict";

  const list = document.getElementById("work-list");
  if (!list || !window.fetch) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function card(p) {
    const a = el("a", "project");
    a.href = p.url;
    a.rel = "noopener";
    a.setAttribute("data-anim", "float");
    a.setAttribute("data-tilt", "");
    a.appendChild(el("span", "project__tag", p.kind === "lab" ? "Lab" : "Client"));
    a.appendChild(el("span", "project__domain", p.domain));
    a.appendChild(el("h3", "", p.title));
    if (p.description) a.appendChild(el("p", "", p.description));
    const link = el("span", "project__link", "View project ");
    const arrow = el("span", "", "↗");
    arrow.setAttribute("aria-hidden", "true");
    link.appendChild(arrow);
    a.appendChild(link);
    return a;
  }

  fetch("data/projects.json", { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const items = data && Array.isArray(data.projects)
        ? data.projects.filter((p) => p && p.title && /^https?:\/\//.test(p.url || ""))
        : [];
      if (!items.length) return;

      const cards = items.map(card);
      list.replaceChildren(...cards);

      // Motion is skipped entirely under reduced motion / no GSAP —
      // the cards are then simply visible, like the fallback.
      if (window.GenriMotion) {
        window.GenriMotion.bindFloat(cards);
        window.GenriMotion.bindTilt(cards);
        ScrollTrigger.refresh();
      }
    })
    .catch(() => { /* keep the fallback cards */ });
})();
