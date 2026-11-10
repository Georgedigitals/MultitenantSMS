<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Production Engineering, Security & Design Standards

The following standards must be strictly followed on every single task:

## 1. Zero Guessing & Anti-Hallucination (Codebase Grounding)
- **Inspect Before Editing**: Always inspect active files, `prisma/schema.prisma`, route handlers, and component trees before proposing or writing code.
- **Never Assume Schemas or APIs**: Verify model field names, relation types, and imported package signatures directly against source definitions. Do not guess or invent APIs.
- **Plan First for Complex Tasks**: When introducing new architectural flows or multi-file features, outline dependencies and database constraints first.

## 2. Ironclad Security & Multi-Tenancy
- **Strict Tenant Isolation**: In every database query and mutation, scope operations to the authenticated user's `tenantId` extracted from the verified session or cookie. **Never** trust `tenantId` or sensitive IDs from the client request body or search parameters.
- **Role-Based Access Control (RBAC)**: Explicitly verify permissions (`school_admin`, `teacher`, `student`, `super_admin`) on every API endpoint before executing business logic.
- **Atomic Transactions**: Any multi-table write, cascade deletion, or critical financial/grading operation must be wrapped in `prisma.$transaction` to guarantee consistency and prevent orphaned data.
- **Input Validation**: Validate and sanitize all incoming payloads before processing.
- **Credential & Secret Protection**: Never log or expose passwords, pin hashes, or token secrets in responses or client bundles.

## 3. Bespoke High Design (Anti-AI Aesthetics)
- **Ban Generic AI Templates**: Avoid clichéd AI tropes (unbranded purple/indigo neon gradients, washed-out grey-on-grey text, uninformative decorative cards).
- **Enterprise-Grade UI**:
  - **Typography & Rhythm**: Use clean, modern font hierarchy with deliberate weights and line-heights.
  - **Contrast & Legibility**: Ensure all text passes WCAG AA/AAA contrast standards against dark and light backgrounds.
  - **Data Density**: Tables, lists, and forms should be structured for high productivity with filters, search, pagination, and clear status badges.
  - **Complete States**: Every component must gracefully handle loading, empty, and error states. Provide immediate visual feedback (toasts, copy buttons, confirmations) for mutations.

## 4. Mandatory Verification Loop
- **Compilers as Ground Truth**: Before declaring any coding task finished, run `npm run build` (or relevant test suites).
- **Zero Tolerated Regressions**: All TypeScript checks, JSX tags, and Next.js route builds must pass cleanly with exit code 0.
