# Lumora Admin Portal — Production Responsive Certification Checklist (v1.0)

## Release Information
- **Scope:** Admin Portal Frontend
- **Deployment Type:** Frontend Only
- **Backend Changes:** None
- **Database Changes:** None
- **Authentication Changes:** None
- **API Changes:** None
- **Firestore Schema Changes:** None

---

## Phase 1 — Responsive Layout Certification

### Viewports
Test each page in:

| Device | Width | Status |
| :--- | :---: | :---: |
| iPhone SE | 320px | ☐ |
| iPhone 12/13/14 | 390px | ☐ |
| Pixel 7 | 412px | ☐ |
| Small Tablet | 768px | ☐ |
| iPad Air | 820px | ☐ |
| iPad Pro | 1024px | ☐ |
| Laptop | 1366px | ☐ |
| Desktop | 1440px+ | ☐ |
| Ultrawide | 1920px | ☐ |

### Layout Verification
- [ ] No horizontal scrolling
- [ ] No clipped cards
- [ ] No overlapping components
- [ ] No hidden buttons
- [ ] No hidden tables
- [ ] No broken spacing
- [ ] No overflowing text

---

## Phase 2 — Navigation & Module Verification

### Dashboard
- [ ] Opens correctly
- [ ] Cards responsive
- [ ] Charts resize
- [ ] KPIs wrap correctly

### Orders
- [ ] Desktop table visible (>= 768px)
- [ ] Mobile card layout visible (< 768px)
- [ ] Every order displayed
- [ ] Pagination works
- [ ] Filters work
- [ ] Search works
- [ ] Status badges render correctly
- [ ] Action menu usable and non-clipping

### Payments
- [ ] All payments visible
- [ ] Refund section visible
- [ ] Mobile cards show: Transaction ID, Amount, Date, Status, Payment Method
- [ ] Desktop unchanged

### Vendors
- [ ] All vendors load
- [ ] No "Failed to load vendors" error
- [ ] Firestore reconnects correctly
- [ ] Offline recovery works
- [ ] Mobile cards show complete information

### Affiliates
- [ ] All affiliates visible
- [ ] Commission visible
- [ ] Status visible
- [ ] Search works
- [ ] Filters work
- [ ] Mobile cards complete

### Customers
- [ ] Customer list complete
- [ ] Search works
- [ ] Filters work
- [ ] Responsive cards render

### Products
- [ ] Product images display properly
- [ ] Categories render
- [ ] Price & Status badges render
- [ ] Pagination works

---

## Phase 3 — Forms & Inputs
- [ ] Inputs don't overflow
- [ ] Labels visible
- [ ] Validation messages visible
- [ ] On-screen keyboard doesn't hide fields
- [ ] Buttons remain clickable

---

## Phase 4 — Modal & Dialog Verification
- [ ] Centered on desktop
- [ ] Full-width bottom-sheet layout on mobile
- [ ] Scrollable content area
- [ ] No clipped footer or actions
- [ ] Close button visible and touch-friendly (≥44px)
- [ ] `Escape` key closes modal
- [ ] Outside click closes modal

---

## Phase 5 — Dropdown & Popover Verification (`AdminSelect`)
- [ ] Doesn't overflow viewport boundary
- [ ] Opens upward when near screen bottom
- [ ] Z-index layering correct (above table containers)
- [ ] Scrollable when option list is long
- [ ] Keyboard navigation (`Arrow Up/Down`, `Enter`, `Space`, `Escape`) functional

---

## Phase 6 — Touch & Haptic Experience
- [ ] Buttons & touch targets ≥44×44 px
- [ ] Dropdowns easy to tap without zoom
- [ ] Data tables converted to stacked cards on mobile
- [ ] No accidental adjacent taps

---

## Phase 7 — Typography & Content Wrapping
- [ ] No text clipping
- [ ] No ellipsis on critical data
- [ ] Long emails wrap correctly (`break-all`)
- [ ] Long IDs wrap or truncate cleanly with tooltip
- [ ] Status badges legible on all backgrounds

---

## Phase 8 — Performance & Network Audit

### Chrome DevTools Lighthouse Targets
- [ ] Performance > 90
- [ ] Accessibility > 95
- [ ] Best Practices > 95
- [ ] SEO > 90

### Slow 3G Emulation
- [ ] Skeleton loaders display during fetch
- [ ] Zero layout shift (CLS < 0.05)
- [ ] Graceful loading sequence

### Offline Recovery
- [ ] Appropriate offline message / notification
- [ ] Reconnects automatically when connection restores
- [ ] Firestore listeners recover without full page reload

---

## Phase 9 — Browser & Device Compatibility

### Desktop Browsers
- [ ] Google Chrome
- [ ] Microsoft Edge
- [ ] Mozilla Firefox
- [ ] Apple Safari (macOS)

### Mobile Browsers
- [ ] Android Chrome
- [ ] Samsung Internet
- [ ] iOS Safari (iPhone & iPad)

---

## Phase 10 — Authentication Regression Testing
- [ ] Email/Password Login
- [ ] Google Sign-In
- [ ] Admin Invite Creation & Delivery
- [ ] Resend Invite Flow
- [ ] Accept Invite Flow (Handling Back Button, Mismatch, Expired JWT)
- [ ] Logout & Session Termination
- [ ] Session Persistence Across Navigation

---

## Phase 11 — Console & Network Diagnostics
Open DevTools Console during full workflow:
- [ ] No React warnings or key missing errors
- [ ] No hydration warnings
- [ ] No uncaught exceptions
- [ ] No failed network requests (0 `404`, `500`, `CORS` errors)

---

## Phase 12 — Production Smoke Test (Post-Deployment)
Verify live on production URL:
- [ ] Login -> Dashboard -> Orders -> Payments -> Vendors -> Affiliates -> Customers -> Products -> Invite Admin -> Logout

---

## Final Release Gate

| Gate Check | Required | Status |
| :--- | :---: | :---: |
| All responsive layout issues resolved | Yes | ☐ |
| Desktop functionality unchanged | Yes | ☐ |
| Mobile fully functional | Yes | ☐ |
| Tablet viewports verified | Yes | ☐ |
| No console errors | Yes | ☐ |
| No network errors | Yes | ☐ |
| Lighthouse targets met | Yes | ☐ |
| Authentication regression-free | Yes | ☐ |
| Backend untouched | Yes | ☐ |
| Firestore schema untouched | Yes | ☐ |
| API contracts unchanged | Yes | ☐ |
| Cross-browser verified | Yes | ☐ |
| Production smoke test passed | Yes | ☐ |

### Push Criteria
> Only push to the main production branch when all mandatory checks are marked **PASS**, at least one real Android and iOS device have been validated, and no P0/P1/P2 responsive defects remain open.
