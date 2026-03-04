# ClearDoc

ClearDoc is a web application to store and browse explanations of payslip lines. Each entry has a title, a description, a category, keywords, and an optional image.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TipTap |
| Backend | Node.js, Express |
| Database | SQLite (`data/cleardoc.db`) |
| Auth | JWT (httpOnly cookie) + bcrypt |

---

## Requirements

- **Node.js 18 or higher** — [Download here](https://nodejs.org)
- **build-essential and python3** — required by the SQLite package to compile on Linux/Debian:

```bash
apt install build-essential python3
```

> On Windows and macOS, no extra tools are needed.

---

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/PetitOursManu/ClearDoc.git
cd ClearDoc
npm install
```

---

## Configuration

Create a `.env` file at the root of the project. This file is never committed to git.

```bash
JWT_SECRET=replace_this_with_a_long_random_string
PORT=3001
```

> **What is JWT_SECRET?** It is a secret key used to sign authentication tokens. Use any long random string (e.g. 64+ characters). Keep it private.

Optional settings:

```bash
VITE_API_URL=           # Leave empty in production (same server)
VITE_API_TIMEOUT=10000  # Request timeout in milliseconds
```

---

## First-time setup

### Step 1 — Create the admin account

```bash
npm run setup-admin
```

This interactive script asks for a username and a password (minimum 8 characters). Run it only once. To replace the existing admin account, run it again and confirm.

### Step 2 — Start the server

```bash
npm run server
```

The server starts on `http://localhost:3001`. On first run, it automatically creates:
- `data/cleardoc.db` — the SQLite database
- `data/uploads/` — the folder where uploaded images are stored

### Step 3 — Start the frontend (development only)

Open a second terminal and run:

```bash
npm run dev
```

The app is now available at `http://localhost:5173`.

> In development, the frontend and backend run on separate ports. API requests from the browser are automatically forwarded to the backend by Vite's built-in proxy.

---

## Production

Build the frontend and serve everything from the Express server:

```bash
npm run build
npm start
```

The app is now available at `http://localhost:3001`. Express serves both the frontend and the API from the same port — no need for a separate frontend server.

---

## Admin interface

A small shield icon in the top-right corner of the app links to `/admin/login`.

Once logged in:
- Your username appears in the header
- A **Logout** button is visible
- Each entry shows **Edit** and **Delete** buttons
- An **Add entry** button appears in the list
- Category badges show **rename** (pencil) and **delete** (×) icons
- A **New** button lets you create additional categories

---

## Rich text editor

The description field in the add and edit dialogs uses a rich text editor powered by [TipTap](https://tiptap.dev). Available formatting options:

- **Bold**, *italic*, underline
- Text color (color picker)
- Headings (H1, H2, H3) and paragraph
- Text alignment (left, center, right, justify)
- Bullet lists and ordered lists

Descriptions are stored as HTML in the database. They are rendered with full formatting on the entry detail page, and displayed as plain text (tags stripped) in the card preview.

---

## Interactive payslip

ClearDoc includes an interactive payslip feature:

- **`/fiche-de-paie`** — A payslip image with clickable zones. Hovering a zone shows the document title; clicking navigates directly to its explanation.
- **`/admin/payslip-map`** — Admin page to set up the interactive payslip:
  1. Upload a payslip image
  2. Draw clickable zones by dragging over the image
  3. Link each zone to a document from your library
  4. Delete or edit zones at any time

Zones are stored as percentages of the image dimensions, so they stay correctly positioned at any screen size.

---

## Structure documents

ClearDoc supports sharing PDF documents organized by structure (e.g. companies within a group):

- **`/documents`** — Public page where users select their structure from a dropdown and access the PDFs assigned to it.
- **`/admin/pdf-manager`** — Admin page to manage everything:
  - Create, rename and delete structures
  - Upload PDF files (up to 20 MB each)
  - Expand any PDF to assign or unassign it from one or more structures using checkboxes
  - Use **Check all** / **Uncheck all** to assign a PDF to all structures at once
  - The same PDF can be assigned to multiple structures

---

## Data persistence

The `data/` folder (database + uploaded images) is listed in `.gitignore`. It will never be overwritten by a `git pull` or a code update.

---

## Available commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the frontend in development mode (port 5173) |
| `npm run server` | Start the Express backend (port 3001) |
| `npm start` | Same as `npm run server` |
| `npm run build` | Build the frontend for production |
| `npm run setup-admin` | Create or replace the admin account |

---

## Security

- Passwords are hashed with **bcrypt** (cost 12)
- JWT token is stored in an **httpOnly cookie** (not accessible from JavaScript)
- Maximum **5 login attempts** per IP address — blocked for 15 minutes after that
- All login attempts (successful or not) are logged in the database with timestamp and IP
- Token expires after **1 hour**, redirecting to the login page automatically
- Cookie is `secure` in production (HTTPS only)

---

## API reference

### Authentication

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Log in — sets a JWT httpOnly cookie |
| `POST` | `/api/auth/logout` | Log out — clears the cookie |
| `GET` | `/api/auth/me` | Check if currently logged in |

### Documents (public read, protected write)

| Method | Route | Auth required |
|---|---|---|
| `GET` | `/api/documents` | No |
| `GET` | `/api/documents/:id` | No |
| `POST` | `/api/documents` | Yes |
| `PUT` | `/api/documents/:id` | Yes |
| `DELETE` | `/api/documents/:id` | Yes |

### Categories (public read, protected write)

| Method | Route | Auth required | Notes |
|---|---|---|---|
| `GET` | `/api/categories` | No | |
| `POST` | `/api/categories` | Yes | Create a new category |
| `PATCH` | `/api/categories/:id` | Yes | Rename a category |
| `DELETE` | `/api/categories/:id` | Yes | Returns 409 if category is in use |

### Descriptions

| Method | Route | Auth required |
|---|---|---|
| `GET` | `/api/descriptions` | No |
| `POST` | `/api/descriptions` | Yes |
| `PUT` | `/api/descriptions/:id` | Yes |
| `DELETE` | `/api/descriptions/:id` | Yes |

### Image upload

| Method | Route | Auth required | Notes |
|---|---|---|---|
| `POST` | `/api/upload` | Yes | Field name: `image`, max 10 MB |

Uploaded images are stored in `data/uploads/` and served at `/uploads/filename.jpg`.

### Interactive payslip

| Method | Route | Auth required | Notes |
|---|---|---|---|
| `GET` | `/api/payslip-settings` | No | Returns the current payslip image path |
| `POST` | `/api/payslip-settings/image` | Yes | Upload payslip image (field: `image`) |
| `GET` | `/api/payslip-zones` | No | Returns all zones with linked document title |
| `POST` | `/api/payslip-zones` | Yes | Create a zone (`document_id`, `x`, `y`, `width`, `height` in %) |
| `PUT` | `/api/payslip-zones/:id` | Yes | Update a zone |
| `DELETE` | `/api/payslip-zones/:id` | Yes | Delete a zone |

### Structure documents

| Method | Route | Auth required | Notes |
|---|---|---|---|
| `GET` | `/api/companies` | No | List all structures |
| `POST` | `/api/companies` | Yes | Create a structure |
| `PATCH` | `/api/companies/:id` | Yes | Rename a structure |
| `DELETE` | `/api/companies/:id` | Yes | Delete a structure and its assignments |
| `GET` | `/api/pdf-files` | No | List all PDFs (or filter by `?company_id=`) |
| `POST` | `/api/pdf-files/upload` | Yes | Upload a PDF (field: `pdf`, max 20 MB) |
| `DELETE` | `/api/pdf-files/:id` | Yes | Delete a PDF and its assignments |
| `GET` | `/api/company-pdfs` | Yes | List all structure–PDF assignments |
| `POST` | `/api/company-pdfs` | Yes | Assign a PDF to a structure |
| `DELETE` | `/api/company-pdfs/:company_id/:pdf_id` | Yes | Remove an assignment |
