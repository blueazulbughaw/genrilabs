/* ============================================================
   GENRI LABS — LANDING ANIMATIONS (GSAP + ScrollTrigger)

   Every animation is keyed off a data attribute in the HTML, so you
   can add/remove animated elements without touching this file:

     data-anim="rise"       → load-time entrance (hero text)
     data-anim="split"      → heading whose words rise out of a mask on load
     data-anim="float"      → panels that float up when scrolled into view
     data-anim="trace"      → circuit path that draws itself on load
     data-anim="hero-card"  → 3D card that straightens on scroll (scrubbed)
     data-anim="step"       → run-log lines that tick in, on a loop
     data-anim="progress"   → line that fills as its section scrolls by
     data-anim="words"      → paragraph whose words light up with scroll
     data-depth="0..4"      → hero layers parallaxed at depth-based speeds

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
      yPercent: 110,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.045,
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
     Far layers drift slower than the page; the hero object rises a
     little faster. Text (depth 4) stays at scroll speed. */
  const drift = { 0: 140, 1: 90, 2: 50, 3: -40 };
  document.querySelectorAll(".hero [data-depth]").forEach((layer) => {
    const d = drift[layer.dataset.depth];
    if (!d) return;
    gsap.to(layer, {
      y: coarse ? d * 0.5 : d,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  });

  // Fine pointers: background layers lean gently toward the cursor.
  if (!coarse) {
    const hero = document.querySelector(".hero");
    const glow = document.querySelector(".hero__glow");
    const mark = document.querySelector(".hero__mark");
    if (hero && glow && mark) {
      const glowX = gsap.quickTo(glow, "x", { duration: 1.2, ease: "power3.out" });
      const markX = gsap.quickTo(mark, "x", { duration: 1.6, ease: "power3.out" });
      const markY = gsap.quickTo(mark, "y", { duration: 1.6, ease: "power3.out" });
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        glowX(nx * 60);
        markX(nx * -30);
        markY(ny * -20);
      });
    }
  }

  /* ---------- 5. Hero card: 3D rotation scrubbed to scroll ----------
     The card starts tilted and straightens as it moves through the
     viewport. scrub ties progress to scroll position, both ways. */
  gsap.fromTo(
    "[data-anim='hero-card']",
    { rotateY: -14, rotateX: 8, scale: 0.94 },
    {
      rotateY: 0,
      rotateX: 0,
      scale: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "[data-anim='hero-card']",
        start: "top 95%",
        end: "top 35%",
        scrub: true,
      },
    }
  );

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
  gsap.set("[data-anim='float']", { y: 40, opacity: 0 });

  ScrollTrigger.batch("[data-anim='float']", {
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
