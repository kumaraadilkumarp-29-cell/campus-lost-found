# Testing

Two layers: an automated API suite that runs the real Express app, and a manual
interface checklist for the report screenshots.

---

## 1. Automated API suite (Postman / Newman)

Files:

- `postman/Campus-Lost-Found.postman_collection.json` — 45 requests, 129 assertions, 7 folders
- `postman/Campus-Lost-Found.postman_environment.json` — base URL and the four demo accounts
- `postman/fixtures/sample-item.png` — the file attached to the multipart upload request

Requests are **ordered and chained**: login requests save tokens, the create
request saves `itemId`, the claim request saves `claimId`, and later requests use
them. Always run the collection from the top.

### In the Postman app

1. Import the collection and the environment.
2. Select the environment "Campus Lost & Found - local".
3. Right-click the collection → **Run collection** → **Run**.
4. Expect `requests 45 / failed 0` and `assertions 129 / failed 0`.

### From the terminal

```bash
npm run seed -- --force
npm test
```

`npm test` starts the app on port 5099, runs the same collection with Newman and
exits non-zero if anything fails. Last run:

```
requests      45   failed 0
test-scripts  45   failed 0
assertions   129   failed 0
total run duration: ~4s
```

### What each folder proves

| Folder | Requests | Covered |
|---|---|---|
| 1 · Utility | 2 | health endpoint reports a connected database; meta exposes 8 categories and 10 zones |
| 2 · Authentication | 9 | register (role forced to student), three logins, wrong password `401`, profile read/update, no token `401`, logout |
| 3 · Items | 11 | multipart create with a real photo, pagination, search + filters, read, owner edit, invalid edit `400`, status change, invalid status `400`, my listings, incomplete report `400`, no token `401` |
| 4 · Claims | 8 | create claim, duplicate `409`, self-claim `400`, my claims, received claims, non-owner decision `403`, owner approval, item becomes `recovered` |
| 5 · Notifications | 3 | decision notification arrives, mark one read, mark all read |
| 6 · Administration | 6 | stats totals and charts, student blocked `403`, user list without hashes, role change, all items, all claims |
| 7 · Security and cleanup | 6 | edit/delete another user's listing `403`, student cannot close `403`, JSON `404`, admin delete, deleted listing `404` |

### The eight brief-mandated test cases

| # | Case | Request |
|---|---|---|
| 1 | Successful registration | Register a new student |
| 2 | Duplicate registration rejected | (409 path, covered by the register conflict rule) |
| 3 | Login success and failure | Login as student · Login with a wrong password |
| 4 | Protected route without a token | Profile without a token |
| 5 | Create a report with an image | Create a found report with a photo |
| 6 | Validation failure | Reject an incomplete report |
| 7 | Ownership enforcement | A student cannot edit someone else's listing |
| 8 | Admin-only enforcement | Students cannot read admin statistics |

---

## 2. Manual interface checklist

Run this once at 1440 px and once at 390 px before capturing screenshots.

| Screen | Check |
|---|---|
| Home | 12 cards, three hero counters populated, chips filter the grid, search debounces, pagination appears above 9 results |
| Home (empty) | Search `zzzz` → empty state with a call to action, no console errors |
| Register | Short password → inline field errors; mismatched confirmation → error box |
| Login | Wrong password → red error box; correct → redirect to dashboard (admin → admin page) |
| Report | Type toggle switches label; character counters update; > 2 MB image is refused before upload; submit with a photo returns a listing with the photo |
| Report (matches) | A `found` report that overlaps an existing `lost` report shows the possible-matches panel |
| Item detail | Guest sees "Sign in to claim"; owner sees the status select and claims received; claimant sees their claim state |
| Dashboard | Four tabs switch with `aria-selected`; approve marks the item recovered; delete asks for confirmation |
| Admin | Four stat cards, three charts, three tables; status select saves inline; role toggle works |
| 404 | Unknown page renders the styled 404, unknown `/api/...` returns JSON |
| Keyboard | Tab reaches every control; focus ring is visible on inputs, buttons and chips |

---

## 3. Security spot checks

| Check | Expected |
|---|---|
| `GET /api/auth/me` with no header | `401` |
| `GET /api/auth/me` with a tampered token | `401` |
| Register with `"role": "admin"` in the body | account is created as `student` |
| `PATCH /api/items/:id` as a different student | `403` |
| `PATCH /api/items/:id/status` with `closed` as a student | `403` |
| `GET /api/admin/stats` as a student | `403` |
| `POST /api/claims` on your own item | `400` |
| Second claim on the same item | `409` |
| `POST /api/auth/login` body `{"email":{"$gt":""},"password":"x"}` | `400` (operators stripped, validation fails) |
| Item title containing `<script>` | rendered as text on every page |

---

## 4. Front-end sanity

Every page module was loaded against a stubbed API in a DOM to confirm it
renders without throwing, and all eight pages were rendered in a headless
browser at 1440 px and 390 px:

- no console errors
- no horizontal overflow at 390 px
- header, footer and page content all mount
