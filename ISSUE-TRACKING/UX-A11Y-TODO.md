# UX & Accessibility TODOs (auto-generated)

Priority: High

- **Fix ARIA input field names** (selector: `.border-primary`) — Add `<label>` or `aria-label` to inputs. *(Severity: serious / WCAG A)*
- **Fix icon-only buttons** (selector: `.hover\:bg-gray-100.rounded`) — Add `aria-label` or visually hidden text to buttons without text. *(Severity: critical)*
- **Fix color contrast** (selector: `.hover\:bg-\[\#E00000\]`) — Adjust color palette or use accessible variants to reach WCAG AA 4.5:1. *(Severity: high)*
- **Make scrollable regions focusable** (selector: `.snap-x`) — Ensure scrollable containers are keyboard focusable (`tabindex="0"`) and have visible focus styles. *(Severity: high)*
- **Review touch target sizes on mobile** — Increase target size to 44x44px where possible; currently many small targets detected (80). *(Severity: medium)*

Priority: Medium

- **Reduce total page size** — Optimize large images (convert to AVIF/WebP, resize to display size), enable compressed assets and caching. (Total size: 10.19MB)
- **Increase minimum font size on mobile** — Many text elements under 14px; consider base font-size >= 16px for mobile readability.

Notes & Next Steps

1. For each selector above, capture screenshots and exact DOM paths (already available in `outputs/ux-report/screenshots/`).
2. Create small, safe patches as PRs for the low-risk changes: add missing `alt` attributes, add `aria-label` to icon-only buttons, add `tabindex` to scroll containers.
3. For color and layout changes, create scoped design proposals and run visual regression tests (screenshot assertions).

Suggested first PRs (small, non-breaking):
- `chore/a11y-fixes` — Add `aria-label`s and missing `alt` texts (sample changes included in `tests/fixtures/html/`).
- `feat/image-optimization` — Convert hero images to WebP/AVIF and update markup to preload hero image.

Refer to `./outputs/ux-report/ux-report.json` for selectors and detailed findings.
