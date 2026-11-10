# BMS public site design direction

This is a BMS-specific direction for the public SaaS website. It follows the user's preference for warm, editorial design and draws on the photography-led, warm-paper approach in the [Awesome DESIGN.md Oura analysis](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/oura/DESIGN.md). It is not a copy of Oura's brand or product styling.

## Product and audience

- BMS helps school owners and school teams manage everyday work around attendance, student records, fees, term results, parent access, and school portals.
- The primary visitor is a school owner deciding whether the platform fits their school. Make the benefit, plan path, and next step understandable without SaaS jargon.
- The primary conversion is school registration. Keep school sign-in and school discovery visible as secondary paths.
- Custom domains belong to the Enterprise plan. State this beside Enterprise wherever plans are summarized.
- Never show demo pricing, invented customer logos, testimonials, student counts, uptime, or performance claims as real proof.

## BMS-specific design idea

Organize the public landing page around the rhythm of a school day: attendance before lessons, connected records and fee follow-up during the day, and results at term close. This gives the page a story rooted in how school teams work, rather than borrowing another site's layout.

Use reference sites to study how clearly they show product areas and responsive states. Do not reuse their exact compositions, colors, wording, screenshots, branding, or section sequence. Use a product-tour panel to show real BMS workflows with no student names, tenant names, or fabricated metrics. If a data-bearing screen is shown later, build it from a separate, clearly labeled marketing demo; never publish the local test database.

## Visual language

- Warm editorial composition with real, context-appropriate school photography. Prefer photographs from the school's world over decorative interface mockups.
- Use photos to show people and school life; do not overlay fabricated metrics or fake dashboards.
- Palette: warm paper `#fbfaf6`, ink `#202d23`, evergreen `#315540`, quiet sage `#819472`, warm-gray text `#687269`, and white surfaces. Use green for primary actions; reserve stronger accents for meaningful states.
- Typography: an editorial serif for large headlines and a neutral sans-serif for navigation, body text, and UI. Use available, licensed fonts or system fallbacks.
- Keep the page asymmetrical and content-led. Alternate photography, prose, and practical plan information instead of repeating identical feature cards.
- Avoid gradients, ornamental dashboard mockups, decorative icon tiles, repeated eyebrow labels, and unsupported social proof.

## Conversion and content

- Explain what BMS does in the first viewport and pair it with one specific primary action.
- Describe school-owner outcomes in plain language: less searching across records, clearer term-result work, and visible fee follow-up.
- Show complete plan details only after production prices and limits are confirmed. Until then, omit demo numbers and direct visitors to plan details.
- Explain the Enterprise custom-domain benefit at the point of plan comparison.
- Use a full footer with useful destinations: platform features, plans, school directory, sign-in, registration, and contact information only when verified.

## Responsive and accessible behavior

- Design and review at phone, tablet, laptop, and wide-desktop sizes. On phones, keep the headline, explanation, and primary action near the top; stack content naturally and prevent horizontal scrolling.
- Use semantic landmarks, one clear `h1`, descriptive image alt text, a skip link, visible `:focus-visible` indicators, and keyboard-operable navigation.
- Give touch controls at least 44px hit areas, maintain strong text contrast, and announce menu state accessibly.
- Set image dimensions or aspect ratio to prevent layout shift. Prioritize the hero image and lazy-load below-fold imagery.
- Respect `prefers-reduced-motion`; keep hover and focus feedback clear and never rely on color alone for meaning.

## Review before implementation

- Confirm product claims, destinations, and production plan/pricing data with the owner.
- Review desktop and mobile as complete pages, including the footer and navigation states.
- Use Vercel's Web Interface Guidelines to check accessibility and browser behavior; use design critique for hierarchy, composition, copy, and imagery.
