# API reference

Base URL: `http://localhost:5000/api`

All responses are JSON.

- Success: `{ "success": true, … }`
- Failure: `{ "success": false, "message": "…", "details": [{ "field": "…", "message": "…" }] }`

Authenticated routes expect `Authorization: Bearer <token>`.

| Status | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Validation failed — `details[]` names each field |
| 401 | Missing, invalid or expired token, or wrong credentials |
| 403 | Authenticated but not allowed (not the owner, not an admin) |
| 404 | Resource does not exist |
| 409 | Conflict (duplicate email, duplicate claim) |
| 429 | Rate limit on the auth routes |
| 500 | Unexpected server error (message is generic in production) |

---

## Utility

### `GET /api/health`
Public liveness probe. `200` when the database is connected, `503` otherwise.

```json
{ "success": true, "status": "ok", "database": "connected", "uptime": 42, "timestamp": "2026-11-25T10:00:00.000Z" }
```

### `GET /api/meta`
The single source of truth for the pickers: 8 categories, 10 campus zones, the
item statuses, the claim statuses and the upload limit.

---

## Auth

### `POST /api/auth/register`
Body: `name`, `email`, `password` (min 8), optional `department`, `phone`.
`role` in the body is **ignored** — every new account is a student.

`201` → `{ success, message, token, data: { _id, name, email, role, … } }`
`409` when the email is taken.

### `POST /api/auth/login`
Body: `email`, `password`. `200` → token + safe user. `401` on bad credentials.

### `GET /api/auth/me`
`200` → the signed-in user. Never includes the password hash.

### `PATCH /api/auth/me`
Body: any of `name`, `email`, `department`, `phone`. Validators and the schema
run on save; `409` if the new email belongs to someone else.

### `POST /api/auth/logout`
`200` acknowledgement. Tokens are stateless; the client discards its copy.

---

## Items

### `GET /api/items`
Public. Query parameters:

| Parameter | Values |
|---|---|
| `search` | keyword, matched against title and description |
| `type` | `lost` \| `found` |
| `category` | one of the 8 categories |
| `location` | one of the 10 zones |
| `status` | `open` \| `claimed` \| `recovered` \| `closed` (default: everything except `closed`) |
| `sort` | `newest` \| `oldest` \| `date` \| `title` \| `popular` |
| `page`, `limit` | `page` from 1; `limit` 1–50, default 12 |

```json
{
  "success": true,
  "count": 9,
  "pagination": { "page": 1, "limit": 12, "total": 14, "pages": 2 },
  "counts": { "lost": 6, "found": 8 },
  "data": [ { "_id": "…", "title": "…", "reporter": { "name": "Aditi Sharma" } } ]
}
```

### `GET /api/items/:id`
Public. Increments `views`, populates the reporter's public fields and returns
`claims` filtered to the ones the caller is allowed to see (owner sees all, a
claimant sees their own, a guest sees none).

### `POST /api/items`
Requires auth. `multipart/form-data` (optional `image` file) or JSON.

Required: `title` (3–90), `description` (20–1000), `category`, `type`,
`location`, `dateLostOrFound` (not in the future).
Optional: `contactInfo`, `image` (JPEG/PNG/WebP, ≤ 2 MB).

`201` → the created item plus `possibleMatches`, the custom duplicate-detection
feature:

```json
{ "success": true, "data": { … }, "possibleMatches": [ { "_id": "…", "title": "…", "matchScore": 62 } ] }
```

### `PATCH /api/items/:id`
Owner or admin. Same field rules, all optional. `403` otherwise.

### `PATCH /api/items/:id/status`
Body `{ "status": "open" | "claimed" | "recovered" | "closed" }`.
Owner may set the first three; only an admin may set `closed`. A closed listing
cannot change status.

### `DELETE /api/items/:id`
Owner or admin. Removes the listing, its claims and its notifications.

### `GET /api/items/user/mine`
Requires auth. The caller's reports, newest first, each with
`claimCounts: { total, pending }`.

---

## Claims

### `POST /api/claims`
Body: `item`, `message` (10–500), optional `proof` (≤ 300).

Rules: you cannot claim your own report (`400`), one claim per person per item
(`409`), and no claims on `recovered` or `closed` items (`400`). Success moves
an `open` item to `claimed` and notifies the reporter.

### `GET /api/claims/mine`
Claims the caller submitted, with the item populated.

### `GET /api/claims/received`
Claims on listings the caller reported, with the claimant's name, email and
department plus their private proof.

### `PATCH /api/claims/:id`
Body: `status` (`approved` | `rejected`), optional `decisionNote`.
Only the item's reporter or an admin may decide (`403`). Approving sets the item
to `recovered`, stamps `decidedAt`, and auto-rejects every rival pending claim
with a note. Both sides are notified.

### `DELETE /api/claims/:id`
The claimant (or an admin) withdraws a **pending** claim. If no pending claims
remain, the item returns to `open`.

---

## Notifications

### `GET /api/notifications`
Up to 50 newest, with `unread` count. Types: `duplicate`, `claim`, `decision`,
`status`.

### `PATCH /api/notifications/:id/read`
Marks one as read. Only the owner can (`404` otherwise, so ids do not leak).

### `PATCH /api/notifications/read-all`
Marks every unread notification of the caller as read.

---

## Admin

Every route below requires `protect` **and** `adminOnly`; a student receives `403`.

| Route | Purpose |
|---|---|
| `GET /api/admin/stats` | Totals, recovery rate, `byStatus`, `byCategory`, `byType` and a 7-day activity series |
| `GET /api/admin/items` | Every listing, including closed ones, with the reporter |
| `GET /api/admin/claims` | Every claim, with item and claimant |
| `GET /api/admin/users` | Every account, password-free |
| `PATCH /api/admin/users/:id/role` | Body `{ "role": "student" \| "admin" }`. You cannot change your own role |
| `DELETE /api/admin/items/:id` | Force delete a listing and its claims |

`GET /api/admin/stats` response shape:

```json
{
  "success": true,
  "data": {
    "totals": { "items": 14, "users": 4, "claims": 2, "pendingClaims": 1,
                "openItems": 9, "recovered": 1, "recoveryRate": 7 },
    "byStatus":   [ { "status": "open", "count": 9 } ],
    "byCategory": [ { "category": "electronics", "count": 4 } ],
    "byType":     [ { "type": "lost", "count": 6 }, { "type": "found", "count": 8 } ],
    "activity":   [ { "date": "2026-11-19", "label": "19 Nov", "lost": 1, "found": 2 } ]
  }
}
```

---

## curl examples

```bash
# login and keep the token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aditi@campus.edu","password":"Student@123"}' | jq -r .token)

# create a report with a photo
curl -X POST http://localhost:5000/api/items \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=Blue umbrella left in the library" \
  -F "description=A grey folding umbrella with a wooden handle, left at the entrance stand." \
  -F "category=other" -F "type=lost" -F "location=library" \
  -F "dateLostOrFound=2026-11-24" \
  -F "image=@postman/fixtures/sample-item.png"

# search
curl "http://localhost:5000/api/items?search=bottle&type=found&limit=5"
```
