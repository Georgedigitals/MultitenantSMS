---
name: ui-expert
description: Design or improve web interfaces with a distinctive visual direction, clear hierarchy, and production-ready interaction states. Use for UI design and frontend implementation; adapt to the project's stack and constraints.
---

# UI Expert

Create interfaces that feel deliberate, legible, and specific to their product. Treat the user's visual preferences as a strong design brief, then adapt them to the project rather than applying a fixed template.

## Before implementation

For substantial new screens or visual redesigns, briefly state:

1. The feeling the interface should evoke, inferred from the product and user brief.
2. Up to three relevant real website references, with links when browsing or supplied references are available. Explain the useful pattern from each; do not imply endorsement or copy a site wholesale.
3. Proposed typography and color direction, including how it fits the existing product.

Keep this compact. For small fixes, skip the presentation and make the change directly. If the user asks for code immediately, do not block implementation on a preamble.

## Design workflow

Work through these decisions in order, revisiting earlier choices when needed:

1. **Intent:** identify users, task, content, context, and desired emotional tone. Preserve real product meaning and copy.
2. **Hierarchy:** decide what users should notice and do first; choose a layout that serves the content, including asymmetry or overlap where useful.
3. **Typography:** use a purposeful heading/body pairing. Consider Newsreader, Instrument Serif, or Sora for headings and Geist, Satoshi, or General Sans for body when available and appropriate. Check the repository and loading setup before introducing fonts. Do not force these families when the brand, language coverage, performance, or project convention calls for another choice.
4. **Space:** use a consistent spacing rhythm (an 8px base is a useful starting point), with deliberate density and occasional generous whitespace. Do not add empty space that weakens task completion.
5. **Color:** choose a restrained palette informed by the product or a relevant real-world reference. Keep contrast accessible in both themes; use saturated colors sparingly and never depend on color alone for meaning.
6. **Motion:** animate only to clarify state changes, hierarchy, or feedback. Respect reduced-motion preferences and keep interactions responsive.

## Visual direction

- Avoid generic template treatments: purple-to-blue gradient backgrounds, identical rounded cards, centered-everything layouts, generic feature grids, and stock filler copy.
- Prefer a clear editorial detail when it serves the page: a meaningful quote, prominent number, image with an offset crop, or small sticker-like annotation.
- Add character through considered details such as fine borders, subtle texture, inset shadows, or a hand-drawn accent. Use them sparingly and preserve legibility.
- Use real, context-appropriate copy. Use imagery only when it contributes to the message. When sourcing new imagery, prefer an appropriate Unsplash image with a specific aesthetic and verify the source and license context; follow any repository or user restrictions on external assets.
- Avoid making every button pill-shaped or every surface heavily rounded. Choose radii, borders, shadows, and density to fit the product.

## Implementation

- Inspect the existing app, design tokens, component library, and package configuration before choosing APIs or adding dependencies. Follow the repository's local instructions and established conventions.
- When the project uses Tailwind and shadcn/ui, treat them as a base to customize, not a finished visual system. Preserve compatibility with installed versions; do not assume a package is available.
- If Framer Motion is already used or explicitly requested, use it for appropriate transitions and interactions. Otherwise prefer the project's existing motion approach and avoid adding a dependency just to animate every hover.
- If using Lucide icons, match the project's icon conventions; a 1.5px stroke is a useful target when supported. Use icons to aid recognition, not as decoration in place of clear labels.
- Implement complete loading, empty, error, focus, disabled, and success states where relevant. Ensure keyboard use, visible focus, semantic markup, responsive behavior, and sufficient contrast.
- Support light and dark themes when the product provides both. Design and check each theme intentionally rather than mechanically inverting colors.
- Reuse existing patterns where they improve consistency, while adjusting spacing, borders, radius, typography, or states when the design calls for it.

## Review

Before finishing, compare the result with the stated intent and hierarchy. Check representative viewport sizes, long or missing content, interactive feedback, and both themes when available. Describe what changed and call out any material limitation such as an unavailable font or image source.

For a substantial UI build or redesign, run two critique-and-revision passes automatically before presenting the result:

1. Review the current implementation as a design lead. Ask whether it reads as a generic template, whether the main hierarchy is clear within a few seconds, and whether it has a distinctive point of view that could hold attention in a strong design portfolio.
2. Identify the three most consequential improvements across hierarchy, typography, spacing, color, composition, copy, or interaction. Make those changes in the implementation; do not stop at listing critique.
3. Reinspect the revised result and repeat the critique and three-improvement cycle once more. Make the second set of changes, then check that the improvements still serve the product, accessibility, and existing project constraints.

Keep both passes focused on observable design weaknesses. Do not add arbitrary decoration or rewrite working code without a clear benefit just to satisfy a numeric “10x” claim. For a small isolated fix, use judgment and skip the two full passes when they would add no meaningful review.
