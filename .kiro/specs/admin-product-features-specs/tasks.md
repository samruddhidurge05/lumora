# Implementation Plan: Admin Product Features & Specs

## Overview

All changes are confined to a single file: `frontend/src/pages/admin/ProductsManagement.jsx`. The
work has four logical steps: extend the form state initialiser, extend the API mapper, add the
Section 5 JSX block, and wire in property-based and integration tests. Each step builds directly
on the previous one and integrates continuously — there is no orphaned code at any stage.

---

## Tasks

- [x] 1. Extend `ProductFormModal` form state and scoped input state
  - [x] 1.1 Add three scoped `useState` pairs for dynamic list inputs
    - Inside the `ProductFormModal` function body, alongside the existing `thumbPreview` and
      `demoVideoPreview` state declarations, add:
      ```jsx
      const [keyFeaturesInput,        setKeyFeaturesInput]        = useState('');
      const [whatsIncludedInput,       setWhatsIncludedInput]      = useState('');
      const [systemRequirementsInput,  setSystemRequirementsInput] = useState('');
      ```
    - These three pairs provide the controlled-input values for the three `DynamicListEditor`
      instances in Section 5.
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 1.2 Add four new fields to the `form` `useState` initialiser
    - Append the following four entries to the existing `useState({...})` object that already
      initialises `name`, `price`, `description`, etc.:
      ```jsx
      keyFeatures:         Array.isArray(product?.features)            ? product.features            : [],
      whatsIncluded:       Array.isArray(product?.whatYouGet)          ? product.whatYouGet          : [],
      systemRequirements:  Array.isArray(product?.systemRequirements)  ? product.systemRequirements  : [],
      installationGuide:   product?.installationGuide                  || product?.installation_guide || '',
      ```
    - Defaults to empty arrays and empty string for the New Product workflow.
    - Pre-populates from the Firestore `product` prop for the Edit Product workflow.
    - _Requirements: 1.2, 1.3, 5.3, 7.1_

  - [ ]* 1.3 ~~Write property test for round-trip data integrity (Property 4)~~ — **SKIPPED (RC: no test infrastructure)**
    - **Property 4: Round-trip data integrity**
    - **Validates: Requirements 7.1, 7.3**
    - Using `fast-check`, assert that for any `product` with valid `features`, `whatYouGet`,
      `systemRequirements`, and `installationGuide` arrays/strings, the `useState` initialiser
      correctly maps those values into form state fields `keyFeatures`, `whatsIncluded`,
      `systemRequirements`, `installationGuide` with no data loss.
    - Create test file `frontend/src/__tests__/productFeaturesSpecs.property.test.js`.
    - _Requirements: 7.1, 7.3_

- [x] 2. Extend `mapAdminProductToApi` to include Section 5 fields
  - [x] 2.1 Append four new key-value pairs to the `apiPayload` object in `mapAdminProductToApi`
    - Locate `mapAdminProductToApi` in `ProductsManagement.jsx` and add after the existing
      `commission_value` line:
      ```js
      // ── Features & Specs (Section 5) ──────────────────────────────────────
      features:             Array.isArray(uiForm.keyFeatures)        ? uiForm.keyFeatures        : [],
      what_you_get:         Array.isArray(uiForm.whatsIncluded)       ? uiForm.whatsIncluded       : [],
      system_requirements:  Array.isArray(uiForm.systemRequirements)  ? uiForm.systemRequirements  : [],
      installation_guide:   typeof uiForm.installationGuide === 'string' ? uiForm.installationGuide : '',
      ```
    - The function signature and all existing mappings remain unchanged.
    - _Requirements: 6.1, 6.2_

  - [ ]* 2.2 ~~Write property test for `mapAdminProductToApi` null-safety (Property 3)~~ — **SKIPPED (RC: no test infrastructure)**
    - **Property 3: `mapAdminProductToApi` never sends `null` for array fields**
    - **Validates: Requirements 6.1, 6.2**
    - Using `fast-check`, generate `uiForm` objects where `keyFeatures`, `whatsIncluded`, and
      `systemRequirements` are each `fc.oneof(fc.array(fc.string()), fc.constant(null), fc.constant(undefined))`
      and assert `Array.isArray(payload.features)`, `Array.isArray(payload.what_you_get)`,
      `Array.isArray(payload.system_requirements)`, and `typeof payload.installation_guide === 'string'`.
    - Add to `frontend/src/__tests__/productFeaturesSpecs.property.test.js`.
    - _Requirements: 6.1, 6.2_

- [x] 3. Checkpoint — Verify mapper and state before adding UI
  - Ensure the extended `form` state initialiser and `mapAdminProductToApi` are consistent.
    Confirm property tests 3 and 4 pass. Ask the user if any questions arise before continuing.

- [x] 4. Add Section 5 "Features & Specs" JSX block to `ProductFormModal`
  - [x] 4.1 Insert Section 5 heading and Key Features dynamic list editor (sub-field 5.1)
    - Inside the `<form>` element, immediately after the closing `</div>` of the existing
      "4. Global Distribution & SEO" section and before the `</form>` tag, add:
      - A wrapping `<div>` containing an `<h3>` with text "5. Features & Specs" styled with
        `text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-3 pb-1 border-b border-[#F3EAF8]`.
      - Inside, a `<div className="space-y-5">` to hold the four sub-fields.
      - The Key Features dynamic list editor (sub-field 5.1) as specified in the design:
        pill list rendering `form.keyFeatures`, controlled input bound to `keyFeaturesInput`,
        Enter-key handler with `trim()` guard, and "Add" button with the same guard.
    - Use `aria-label="Remove key feature"` on the remove button.
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Add What's Included dynamic list editor (sub-field 5.2)
    - Inside the `<div className="space-y-5">` from task 4.1, append the What's Included
      sub-field using the identical inline pattern with `form.whatsIncluded`,
      `whatsIncludedInput`/`setWhatsIncludedInput`, `handleChange('whatsIncluded', ...)`, and
      `aria-label="Remove item"`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.3 Add System Requirements dynamic list editor (sub-field 5.3)
    - Inside the same `<div className="space-y-5">`, append the System Requirements sub-field
      using the identical inline pattern with `form.systemRequirements`,
      `systemRequirementsInput`/`setSystemRequirementsInput`,
      `handleChange('systemRequirements', ...)`, and `aria-label="Remove requirement"`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.4 Add Installation Guide textarea (sub-field 5.4)
    - Append a controlled `<textarea rows={5}>` bound to `form.installationGuide` via
      `handleChange('installationGuide', e.target.value)`, with placeholder "Step-by-step setup
      and installation instructions (plain text or markdown)..." and the same styling classes as
      the existing Technical Specifications textarea in Section 1.
    - No sanitisation or encoding — accept plain text and markdown as-is.
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ]* 4.5 ~~Write property test for empty-string guard (Property 1)~~ — **SKIPPED (RC: no test infrastructure)**
    - **Property 1: Empty-string guard (array fields)**
    - **Validates: Requirements 2.5, 3.5, 4.5**
    - Extract the add-item logic into a pure helper `addIfNonEmpty(list, rawInput)` that
      mirrors the `trim()` guard. Using `fast-check`, assert that for any `rawInput` where
      `rawInput.trim() === ''` the returned list length equals the input list length, and for
      any non-empty trimmed value the list grows by exactly 1 with the trimmed value appended.
    - Add to `frontend/src/__tests__/productFeaturesSpecs.property.test.js`.
    - _Requirements: 2.5, 3.5, 4.5_

  - [ ]* 4.6 ~~Write property test for remove entry correctness (Property 2)~~ — **SKIPPED (RC: no test infrastructure)**
    - **Property 2: Remove entry correctness**
    - **Validates: Requirements 2.3, 3.3, 4.3**
    - Extract the remove-item logic into a pure helper `removeAtIndex(list, idx)` that mirrors
      `list.filter((_, i) => i !== idx)`. Using `fast-check`, for any non-empty list and any
      valid index, assert the result has length `N-1` and all original entries except the one at
      `idx` are preserved in order.
    - Add to `frontend/src/__tests__/productFeaturesSpecs.property.test.js`.
    - _Requirements: 2.3, 3.3, 4.3_

- [x] 5. Checkpoint — Verify Section 5 renders correctly
  - Ensure all four sub-fields appear inside `ProductFormModal` in the correct order after
    the existing Section 4. Confirm property tests 1 and 2 pass. Ask the user if questions arise.

- [ ] 6. Write integration tests to validate Section 5 end-to-end behaviour — **SKIPPED (RC: no test infrastructure)**
  - [ ]* 6.1 ~~Write integration tests for new product form (Section 5 defaults)~~ — SKIPPED
  - [ ]* 6.2 ~~Write integration tests for edit product pre-population~~ — SKIPPED
  - [ ]* 6.3 ~~Write integration tests for add and remove flows and submit payload~~ — SKIPPED

- [x] 7. Final checkpoint — Production implementation complete

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All changes are confined to `frontend/src/pages/admin/ProductsManagement.jsx` — no other file
  is modified
- The backend (schemas, routes, model, Firestore sync) already supports all four fields; no
  backend changes are needed
- `fast-check` is the recommended property-testing library for JavaScript; install with
  `npm install --save-dev fast-check` if not already present
- React Testing Library is the recommended integration-test library; install with
  `npm install --save-dev @testing-library/react @testing-library/jest-dom` if not present
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties; integration tests validate specific
  examples and workflows

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4"] },
    { "id": 5, "tasks": ["4.5", "4.6"] },
    { "id": 6, "tasks": ["6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3"] }
  ]
}
```
