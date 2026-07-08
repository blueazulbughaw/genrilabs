/* ============================================================
   GENRI LABS — LANDING ANIMATIONS (GSAP + ScrollTrigger)

   Three animation systems, each keyed off a data-anim attribute
   in the HTML so you can add/remove animated elements without
   touching this file:

     data-anim="rise"       → load-time entrance (hero text)
     data-anim="hero-card"  → 3D card that straightens on scroll (scrubbed)
     data-anim="float"      → panels that float up when scrolled into view
     data-anim="trace"      → circuit path that draws itself on load
   ============================================================ */

(function () {
  "use strict";

  // Respect the user's OS-level motion preference. If reduced
  // motion is on, we skip GSAP entirely — content is fully
  // visible by default, animations are progressive enhancement.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. Hero entrance: staggered rise ---------- */
  gsap.from("[data-anim='rise']", {
    y: 24,
    opacity: 0,
    duration: 0.7,
    ease: "power2.out",
    stagger: 0.12,
  });

  /* ---------- 2. Circuit trace: draw the signature line ---------- */
  const trace = document.querySelector("[data-anim='trace']");
  if (trace) {
    const len = trace.getTotalLength();
    gsap.fromTo(
      trace,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.6, ease: "power1.inOut", delay: 0.3 }
    );
  }

  /* ---------- 3. Hero card: 3D rotation scrubbed to scroll ----------
     The card starts tilted (rotateY -14°, rotateX 4°) and straightens
     as it moves through the viewport. scrub: true ties the animation
     progress directly to scroll position, so it plays both ways. */
  gsap.fromTo(
    "[data-anim='hero-card']",
    { rotateY: -14, rotateX: 4, scale: 0.96 },
    {
      rotateY: 0,
      rotateX: 0,
      scale: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "[data-anim='hero-card']",
        start: "top 90%",   // begin when card's top hits 90% down the viewport
        end: "top 35%",     // finish when it reaches 35%
        scrub: true,
      },
    }
  );

  /* ---------- 4. Floating panels: trigger-once entrances ----------
     Unlike the scrubbed hero, these play forward once and stay put.
     ScrollTrigger.batch groups elements that enter together so
     cards in the same row stagger instead of popping simultaneously. */
  gsap.set("[data-anim='float']", { y: 32, opacity: 0 });

  ScrollTrigger.batch("[data-anim='float']", {
    start: "top 88%",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        y: 0,
        opacity: 1,
        duration: 0.65,
        ease: "power2.out",
        stagger: 0.12,
      }),
  });
})();
