# CLAUDE.md

## Design Context

### Users

Fardell is used by its author plus family and friends of varying tech comfort — clarity always beats density. It is a mobile-first installed PWA, used mostly at home while planning gear and preparing packs before a trip. The UI is Catalan-first (with Spanish and English); copy and code comments follow the repo's Catalan voice.

### Brand Personality

Sober equipment sheet. Technical, calm, utilitarian — like a well-made gear checklist or field manual («full d'equipament»). The interface should feel like trustworthy mountain equipment: nothing decorative that doesn't earn its weight. Emotions to evoke: confidence, order, quiet competence.

### Aesthetic Direction

- **«Pedra» is the identity**: cold-fog paper, fir-green ink, a single safety-orange accent (`--accent`), condensed display type (Avenir Next Condensed stack) for headings and the wordmark, system font for body, tabular monospace for every number and weight. The wordmark is `FARDELL` set airy and light (wide letter-spacing, no decorative mark); the orange lives in the app UI and the icon, not in the word. Design decisions optimize for Pedra in both light and dark; the other four themes (ports from the bitácora app) only need to remain usable — never let them dilute a design decision.
- Everything themes through the CSS variables in `src/styles.css` (`--paper`, `--card`, `--ink`, `--accent`, …). Never hardcode colors in components; a change must hold up in Pedra light and dark at minimum.
- Anti-reference: generic SaaS dashboards, playful/rounded consumer apps, anything that reads as a template.

### Design Principles

1. **Weight is the protagonist.** Grams, counts and load bars are the core content — always tabular, monospaced, scannable at a glance.
2. **One accent, spent carefully.** The safety-orange marks the primary action or the selected state, nothing else. If everything glows, nothing does.
3. **Sunlight-proof.** Prefer high contrast between ink and paper; text and bars must survive a phone screen outdoors.
4. **Still, not animated.** Minimal motion by default and respect `prefers-reduced-motion`; the app should feel like paper, not like an app store demo.
5. **Utility earns its place.** Every element justifies itself like gear in a pack: if it doesn't serve packing, weighing or finding material, it stays home.
