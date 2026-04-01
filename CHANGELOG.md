# Changelog

All notable changes to this project will be documented in this file.  
Format follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — per Eukarya Engineering Guidelines.

---

## [Unreleased]

### In Progress
- `docs`: English proposal (proposal_en.md) — full draft
- `docs`: GitHub repository structure setup

---

## [0.3.0] — 2026-04-01

### Added
- `docs`: Complete English proposal document (docx) with 7 chapters, 3 Gemini-generated illustrations, architecture diagram, CMS schema design, and trust score engine specification
- `docs`: Mobile UI mockup (Phase 0/2/3 storyboard)
- `docs`: Government dashboard mockup (Re:Earth Visualizer)
- `docs`: Gemini image generation prompts (3 prompts: Phase 0, Phase 2, Phase 3)
- `docs`: Illustration set generated via Gemini (phase_0.png, phase_2.png, phase_3.png)

### Changed
- `docs`: Refined scope definition to explicitly exclude internet-shutdown scenarios (Iran 2026 case study added)
- `docs`: Trust Score engine framing updated — clarified as physical/geographical data integrity verification (not political speech judgment)

---

## [0.2.0] — 2026-03-31

### Added
- `docs`: Japanese proposal draft (proposal_ja.md) — 8-chapter structure
- `docs`: 3-layer system architecture design (Layer 1: CMS / Layer 2: Trust Engine / Layer 3: Visualizer)
- `docs`: CMS schema design — 27 fields across 4 groups including trust score fields
- `docs`: Architecture diagram (SVG, Re:Earth-based 3-layer structure)
- `docs`: User journey storyboard (Phase 0 / Phase 2 / Phase 3)
- `docs`: Mobile reporting form UI mockup
- `docs`: Government dashboard mockup with live data visualization

### Research
- Analyzed Iran 2026 internet blackout (98% traffic drop) — confirmed OUT OF SCOPE for internet-shutdown scenarios
- Reviewed historical precedents: Haiti 2010 (Ushahidi SMS 4636), Japan 2011 (Twitter), Kumamoto 2016 (LINE)
- Confirmed InnoCentive submission format: written proposal + interactive prototype/wireframe as attachment
- Confirmed UNDP misinformation policy alignment (iVerify, DPG standard)

---

## [0.1.0] — 2026-03-28

### Added
- `docs`: Initial theme selection and strategy proposal
- `docs`: UNDP challenge requirements analysis (Wazoku/InnoCentive platform)
- `docs`: Re:Earth capability assessment for crisis reporting use case
- `docs`: Competitive differentiation analysis (vs KoboToolbox, existing crisis tools)
- `docs`: Misinfomation/disinformation risk framing — confirmed as key differentiator
- `docs`: Document management strategy decision (Markdown → GitHub → PDF for submission)
- `docs`: Eukarya social GitHub rules confirmed via Notion Engineering Wiki

### Research
- UNDP Challenge #1 (underwater explosives) status: closed March 9, 2026; 385 solvers from 61 countries; results pending
- InnoCentive process confirmed: Register → Submit proposal+prototype → Evaluation → Shortlist → UNDP presentation
- Regional messaging app mapping (WhatsApp / LINE / Telegram / Viber by region)
- PWA offline access strategy validated against historical disaster cases

---

*Maintained by Eukarya Inc. | Follows Eukarya Engineering Guidelines (Conventional Commits)*
