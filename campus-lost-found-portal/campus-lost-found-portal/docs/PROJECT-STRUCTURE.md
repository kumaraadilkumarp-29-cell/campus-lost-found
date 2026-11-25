# File-by-file map

Useful when writing the implementation chapter or preparing for the viva.

## Root

| File | Responsibility |
|---|---|
| `server.js` | Loads `.env`, connects the database, starts listening, handles SIGINT/SIGTERM. Exits with a readable message if the database is unreachable. |
| `seed.js` | Four users (1 admin, 3 students), 12 listings with staggered dates, one pending claim and its notification. `--force` wipes first. |
| `package.json` | Dependencies and the five scripts (`start`, `dev`, `seed`, `test`). |
| `.env.example` | Every environment variable the app reads. |

## `src/`

| File | Responsibility |
|---|---|
| `app.js` | Assembles Express: helmet (CSP), CORS allow-list, body parsers, sanitise, morgan, static files, `/api/meta`, `/api/health`, five routers, 404, error handler. |
| `config/db.js` | One `mongoose.connect` with `strictQuery`, a 10 s server-selection timeout and an actionable error message. |
| `models/User.js` | name, email (unique, lowercase), password (`select: false`), role, department, phone, isActive. bcrypt pre-save hook, `comparePassword()`, `toSafeJSON()`. |
| `models/Item.js` | title, description, category, type, location, dateLostOrFound, imageUrl, contactInfo, status, reporter, views. Text + compound indexes, `isOpen` virtual, and the `CATEGORIES` / `LOCATIONS` / `ITEM_STATUSES` constants the validators share. |
| `models/Claim.js` | item, claimant, message, proof, status, decisionNote, decidedAt. Compound unique index on `{ item, claimant }`. |
| `models/Notification.js` | user, type (`duplicate`/`claim`/`decision`/`status`), message, item, claim, read. |
| `controllers/authController.js` | register (role never read from the body), login (`select('+password')`), profile read/update, logout acknowledgement. |
| `controllers/itemController.js` | Filtered/paginated search, detail with view counter and claim filtering, create with match detection, owner-or-admin update/delete, status transitions, my listings with claim counts. |
| `controllers/claimController.js` | Self-claim, duplicate and closed-item guards; notify the owner; approve → item recovered + rivals auto-rejected; withdraw. |
| `controllers/notificationController.js` | List with unread count, mark one, mark all. |
| `controllers/adminController.js` | Aggregation-based statistics plus the 7-day series, and the four admin listings. |
| `routes/authRoutes.js` | Five auth routes, rate-limited on register/login. |
| `routes/itemRoutes.js` | Seven item routes; `/user/mine` declared before `/:id`. |
| `routes/claimRoutes.js` | Five claim routes. |
| `routes/notificationRoutes.js` | Three notification routes behind `protect`. |
| `routes/adminRoutes.js` | `router.use(protect, adminOnly)` then six routes. |
| `middleware/auth.js` | `protect()` (verify, load user, reject disabled), `adminOnly()`, `optionalAuth()`. |
| `middleware/validate.js` | Nine hand-written validators; each throws `400` with a `details[]` array. |
| `middleware/upload.js` | multer disk storage, MIME allow-list, 2 MB cap, crypto-random filename. |
| `middleware/sanitize.js` | Recursive removal of `$` and `.` keys from body, query and params. |
| `middleware/errorHandler.js` | `notFound()` (JSON for `/api`, styled page otherwise) and `errorHandler()` mapping ApiError, ValidationError, 11000, CastError and multer limits to one shape. |
| `utils/ApiError.js` | Error subclass with `statusCode`, `details` and the `badRequest/unauthorized/forbidden/notFound/conflict` helpers. |
| `utils/asyncHandler.js` | Higher-order function funnelling rejected promises into `next()`. |
| `utils/token.js` | Signs `{ id, role }` with the configured lifetime. |
| `utils/findMatches.js` | Stop-word filter, keyword regex, opposite type + same category, percentage score, top five. |

## `public/`

| File | Responsibility |
|---|---|
| `css/styles.css` | Design tokens, reset, header, buttons, forms, hero, search panel, cards, badges, steps, panels, auth shell, detail layout, tabs, stat cards, bar charts, tables, toasts, footer and five breakpoints. |
| `js/api.js` | Token storage and the single `api()` fetch wrapper (FormData passthrough, JSON parsing, readable errors, 401 handling). |
| `js/ui.js` | `escapeHtml`, dates, `timeAgo`, category/zone labels, badges, `itemCard`, empty state, skeleton, spinner, toast, form-error rendering, button busy state. |
| `js/common.js` | Header and footer rendering, active nav, unread bell, mobile menu, `requireLogin()`, `requireAdmin()`. |
| `js/home.js` | URL ⇄ state ⇄ `GET /api/items`, 400 ms debounce, chips, sort, windowed pagination, hero counters. |
| `js/auth-page.js` | One module for login and register, with password confirmation and role-based redirect. |
| `js/report.js` | Create or edit, type toggle, character counters, image preview with size guard, possible-matches panel. |
| `js/item.js` | Detail render, guest/claimant/owner states, claim submission, owner status/edit/delete and claim decisions. |
| `js/dashboard.js` | Four tabs, four parallel requests, stat cards, three tables, approve/reject/withdraw/delete, mark-all-read. |
| `js/admin.js` | Stat cards, three CSS bar charts, listings table with inline status select, claims table, users table with role toggle. |
| `js/page.js` | Header and footer for the static 404 page. |

## `postman/` and `tests/`

| File | Responsibility |
|---|---|
| `postman/*.json` | The 45-request collection and its environment. |
| `postman/fixtures/sample-item.png` | Photo used by the multipart upload request. |
| `tests/run-collection.js` | Boots the app on port 5099, runs the collection with Newman, prints failures and exits non-zero. |
