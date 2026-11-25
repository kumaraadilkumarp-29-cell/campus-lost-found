# Campus Lost & Found Portal

A complete, working full-stack web application for reporting and recovering lost
property on a university campus. Students report what they lost or found, the
portal searches, matches and notifies, and claims are settled through a verified
handover between the two people involved.

Built with **Node.js + Express 4 + MongoDB (Mongoose)** on the server and
**semantic HTML5 + hand-written CSS + native ES modules** in the browser. No
frontend framework, no build step, no CDN dependency.

---

## 1. What it does

| Capability | How it works |
|---|---|
| Browse and search | `/api/items` supports keyword search, type, category, zone, status, five sort modes and pagination. Filter state lives in the URL, so every view is shareable. |
| Report an item | Lost or found, category, campus zone, date, description and an optional photo (JPEG/PNG/WebP, 2 MB cap). |
| Possible-duplicate matching | On submit the server scores the opposite-type reports in the same category by shared keywords and returns the best five; the other side is notified. |
| Claims | A signed-in student sends a private message and proof. Only the reporter sees it. Self-claims, duplicate claims and claims on closed listings are rejected. |
| Decisions | The reporter approves or rejects. Approval marks the listing `recovered` and auto-rejects rival claims. |
| Dashboard | Four tabs: my reports (with claim counters), claims I sent, claims received, notifications. |
| Administration | Totals, recovery rate, three charts, and tables for every listing, claim and account. Admins can change status, force-delete a listing and change a user's role. |
| Security | JWT bearer auth, bcrypt hashing, per-resource ownership checks, admin-only middleware, NoSQL-injection sanitising, rate-limited auth routes, upload allow-list, one JSON error shape, helmet CSP. |
| Responsive | Single column under 560 px, two columns to 939 px, three columns above. Verified at 390 px and 1440 px with no horizontal overflow. |

---

## 2. Quick start

You need **Node.js 18 or newer** and a **MongoDB** database — either a local
`mongod` or a free MongoDB Atlas cluster.

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env        # Windows: copy .env.example .env
#    then edit MONGO_URI and JWT_SECRET

# 3. seed 4 demo users and 12 listings
npm run seed

# 4. run
npm start
```

Open <http://localhost:5000>. The API lives under `/api`.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@campus.edu` | `Admin@12345` |
| Student | `aditi@campus.edu` | `Student@123` |
| Student | `rohan@campus.edu` | `Student@123` |
| Student | `meera@campus.edu` | `Student@123` |

### Environment variables

| Key | Meaning |
|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/campus_lost_found` locally, or your Atlas SRV string. |
| `JWT_SECRET` | Any long random string. Rotate it if it ever leaks. |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d`. |
| `PORT` | Default `5000`. |
| `NODE_ENV` | `development` or `production` (stack traces are hidden in production). |
| `CLIENT_ORIGIN` | Comma-separated browser origins allowed to call the API. |

---

## 3. Scripts

| Command | What it does |
|---|---|
| `npm start` | Runs the server with `node server.js`. |
| `npm run dev` | Same, restarting on save with nodemon. |
| `npm run seed` | Adds the demo data if the database is empty. |
| `npm run seed -- --force` | Wipes the four collections first, then seeds. |
| `npm test` | Boots the app and runs the whole Postman collection with Newman. Exits non-zero if any assertion fails. |

---

## 4. API surface

28 endpoints. Full request/response reference: [`docs/API.md`](docs/API.md).

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `PATCH /api/auth/me` · `POST /api/auth/logout` |
| Items | `GET /api/items` · `GET /api/items/:id` · `POST /api/items` · `PATCH /api/items/:id` · `PATCH /api/items/:id/status` · `DELETE /api/items/:id` · `GET /api/items/user/mine` |
| Claims | `POST /api/claims` · `GET /api/claims/mine` · `GET /api/claims/received` · `PATCH /api/claims/:id` · `DELETE /api/claims/:id` |
| Notifications | `GET /api/notifications` · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/read-all` |
| Admin | `GET /api/admin/stats` · `GET /api/admin/items` · `GET /api/admin/claims` · `GET /api/admin/users` · `PATCH /api/admin/users/:id/role` · `DELETE /api/admin/items/:id` |
| Utility | `GET /api/meta` · `GET /api/health` |

Every response is `{ success: true, data, … }` on success and
`{ success: false, message, details? }` on failure.

---

## 5. Postman tests

The collection in `postman/` holds **45 requests and 129 assertions** across
seven folders. Import both files into Postman and run the collection top to
bottom — requests are ordered, and each one saves the ids the next one needs.

```bash
npm test    # same suite, no Postman app needed
```

Expected summary:

```
requests     45     failed 0
assertions  129     failed 0
```

What it proves, beyond the happy path: a `role: "admin"` field in the register
body is ignored, a wrong password issues no token, a student gets `403` on
another student's listing and on `/api/admin/stats`, a second claim is `409`, a
self-claim is `400`, approval moves the item to `recovered`, and a deleted
listing returns `404`. Details: [`docs/TESTING.md`](docs/TESTING.md).

---

## 6. Project structure

```
campus-lost-found-portal/
├── server.js                  entry point: env, database, listen
├── seed.js                    demo users, 12 listings, 1 claim
├── src/
│   ├── app.js                 middleware pipeline + five routers
│   ├── config/db.js           one Mongoose connection
│   ├── models/                User, Item, Claim, Notification
│   ├── controllers/           auth, item, claim, notification, admin
│   ├── routes/                one router per group
│   ├── middleware/            auth, validate, upload, sanitize, errorHandler
│   └── utils/                 ApiError, asyncHandler, token, findMatches
├── public/
│   ├── index.html  login.html  register.html  report.html
│   ├── item.html   dashboard.html  admin.html  404.html
│   ├── css/styles.css         design tokens + every component
│   ├── js/                    api, ui, common + one module per page
│   └── uploads/               item photos (server-generated filenames)
├── postman/                   collection + environment + sample photo
├── tests/run-collection.js    Newman runner used by npm test
└── docs/                      API, testing, structure notes,
                               plus six reference screenshots
```

### Request pipeline

`helmet → cors → json/urlencoded (1 MB) → sanitize → static → router → validate → protect → authorise → controller → model → errorHandler`

---

## 7. Design system

One stylesheet, driven by custom properties. The palette deliberately avoids the
usual blue-on-grey admin look:

| Token | Value | Used for |
|---|---|---|
| `--bg` / `--bg-deep` | `#f7f4ed` / `#f0ece2` | Warm sand canvas |
| `--ink` / `--ink-2` / `--ink-3` | `#10201c` / `#33463f` / `#6b7c74` | Text hierarchy |
| `--brand` / `--brand-2` | `#0e7c66` / `#0a5d4c` | Primary actions, links, charts |
| `--brand-soft` | `#e3f2ec` | Active nav, found badges |
| `--lost` | `#c05621` | Lost reports (clay, not alarm red) |
| `--gold` | `#d8a33c` | Eyebrows, step numbers, status chart |
| `--line` | `#e6dfd2` | Hairline borders |

Display headings use a serif stack (Iowan Old Style → Palatino → Georgia) against
a system sans body, so there are zero font downloads and the first paint is
instant. Components: buttons, segmented control, chips, item cards, badges,
stat cards, CSS bar charts, tables, tabs, toasts, skeletons and empty states.

---

## 8. Security controls

| Threat | Control |
|---|---|
| Password theft from a database dump | bcrypt, 10 salt rounds, `select: false`, `toSafeJSON()` |
| Token tampering | `jwt.verify` on every protected route; disabled accounts rejected |
| Privilege escalation | `role` is never read from a request body; `adminOnly()` on all admin routes |
| Editing someone else's listing | Owner-vs-requester comparison in the controller, `403` otherwise |
| NoSQL injection | Recursive `$` and `.` key stripping on body, query and params |
| Brute-force login | 30 attempts per IP per 15 minutes on the auth routes |
| Stored XSS | Every dynamic value passes `escapeHtml()` before it reaches the DOM |
| Malicious uploads | MIME allow-list, 2 MB cap, server-generated filename |
| Information leakage | One error shape; stack traces only outside production |
| Header-based attacks | helmet defaults; CSP allows only self scripts, self + data images |

---

## 9. Deployment notes

1. Push to GitHub (`.env` is git-ignored — never commit it).
2. Create a Render/Railway web service from the repository: build `npm install`,
   start `npm start`.
3. Add `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLIENT_ORIGIN` in the
   host's environment settings.
4. In Atlas, allow the host's outbound IPs (or `0.0.0.0/0` for a demo cluster).
5. Run `npm run seed` once against the production URI if you want demo data.

Uploaded photos are written to `public/uploads`, which is ephemeral on free
hosts — a Cloudinary or S3 adapter is the natural next step.

---

## 10. Known limitations

- Tokens are stateless, so logout is a client-side acknowledgement rather than a
  server-side revocation list.
- There is no email verification or password reset yet; both were scoped out of
  the MVP.
- Image uploads are stored on local disk, not object storage.
- Search uses case-insensitive regular expressions rather than a text index
  (the index exists on the model and can be swapped in with `$text`).

---

## Licence

MIT. Written as an academic project for Web Technology and Internet Programming.
