# Running this project locally (outside Replit)

This project was originally built on Replit, which auto-provisions a database
and wires environment variables for you. Running it on your own machine needs
a few one-time setup steps — after that, it's just `pnpm dev`.

## 1. Install prerequisites

- **Node.js 22 or later** — https://nodejs.org (LTS is fine)
- **pnpm** — after installing Node, run:
  ```
  npm install -g pnpm
  ```

## 2. Install and set up Postgres locally

Since this app runs entirely on your own computer, the database should too —
no network dependency, no cold starts, no third-party outages, completely
free forever.

Install Postgres:
```
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create a dedicated database and user for this app (replace `your_password`
with something of your own — you'll need it in the next step):
```
sudo -u postgres psql -c "CREATE USER tresbien WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE tresbien_db OWNER tresbien;"
```

**Prefer a cloud database instead** (e.g. to access your data from another
device)? Neon (https://neon.tech) or Supabase (https://supabase.com) both work
— just grab the connection string from their dashboard for the next step
instead of the `localhost` one below. Note this reintroduces a dependency on
your internet connection and their uptime.

## 3. Set up product photo storage (Cloudflare R2)

Product photos are stored in Cloudflare R2 (not on this computer), so they
survive no matter where or how you deploy the app later.

1. Go to https://dash.cloudflare.com and sign up (free, no card needed for
   the free tier — 10GB storage free)
2. In the left sidebar, go to **R2 Object Storage** → **Create bucket**
   - Name it something like `tresbien-photos`
   - Leave the default location settings
3. Open the new bucket → **Settings** tab → **Public access** → enable
   **Allow public access** via the "R2.dev subdomain" option. Copy the
   `pub-xxxxxxxxxx.r2.dev` URL it gives you — that's your `R2_PUBLIC_URL`.
4. Back on the R2 overview page, find **Manage API tokens** (or
   **Account API Tokens** in account settings) → **Create API token** →
   choose **Object Read & Write** permissions, scoped to this bucket.
   Copy the **Access Key ID** and **Secret Access Key** it shows you —
   this is the only time the secret is shown, so save it now.
5. Your **Account ID** is shown on the main R2 overview page (a long
   hex string) — copy that too.

You should now have 4 values: Account ID, Access Key ID, Secret Access Key,
and the public `.r2.dev` URL. You'll paste these into `.env` in the next step.

## 4. Configure your environment

In the project root:
```
cp .env.example .env
```
Open `.env` and set:
- `DATABASE_URL` to:
  ```
  DATABASE_URL=postgresql://tresbien:your_password@localhost:5432/tresbien_db
  ```
  (using the same password you set in step 2)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
  to the 4 values from step 3
- `R2_BUCKET_NAME` to whatever you named the bucket (e.g. `tresbien-photos`)

## 5. Install dependencies

From the project root:
```
pnpm install
```
This installs everything for every package in the monorepo (frontend, API,
shared libraries) in one go.

## 6. Create the database tables

```
pnpm db:push
```
This reads the schema in `shared/db/src/schema` and creates all the tables
(products, sales, expenses, debts, tasks, etc.) in your database.
If it warns about data loss on an empty database, that's expected — use
`pnpm db:push:force` if it asks for confirmation you're sure about.

## 7. Run it

```
pnpm dev
```
This starts both the API server (http://localhost:8080) and the web app
(http://localhost:18500) together. Open **http://localhost:18500** in your
browser.

To run them separately instead: `pnpm dev:api` and `pnpm dev:web`.

## If something goes wrong

Copy the exact error message and share it — most first-run issues are either
a malformed `DATABASE_URL`, missing R2 credentials, or a port already in use
(something else already running on 8080 or 18500).

**"Password authentication failed" even though you're sure the password is
right?** Check whether something else is already using Postgres's default
port 5432 — a Docker container running its own Postgres is a common culprit.
Run:
```
pg_lsclusters
```
If your cluster shows a port other than 5432 (e.g. 5433), Ubuntu assigned it
that port automatically to avoid the conflict — update the port number in
your `DATABASE_URL` in `.env` to match, and it'll connect correctly.

## Backing up your data

With a local database, you're in charge of backups (a cloud provider isn't
doing it for you anymore). A simple habit: run this occasionally, or set up
a weekly cron job to run it automatically.
```
pg_dump 'postgresql://tresbien:your_password@localhost:5432/tresbien_db' -f ~/tresbien-backup-$(date +%F).sql
```
That creates a plain-text SQL file you could restore from with:
```
psql 'postgresql://tresbien:your_password@localhost:5432/tresbien_db' -f ~/tresbien-backup-2026-07-23.sql
```
Consider occasionally copying that backup file somewhere off this machine
too (a USB drive, cloud storage folder, email to yourself) in case the
computer itself has a problem.
