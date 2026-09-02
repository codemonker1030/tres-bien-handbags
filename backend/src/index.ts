import dns from "dns";

// Many home networks/ISPs advertise IPv6 support that doesn't actually route
// correctly. Node's default DNS resolution can prefer an IPv6 address for a
// hostname even when IPv6 is broken locally, causing every connection to that
// host to hang until it times out — while tools like `psql` (built on libpq)
// fall back to IPv4 automatically and connect instantly. This makes Node
// prefer IPv4, matching that more resilient behavior, for every outbound
// connection made by this process (including to the Postgres database).
//
// This MUST run before `./app` (and the database pool it transitively
// creates) is loaded. A regular top-level `import` would not work here even
// if placed below this line — ES module imports are hoisted and execute
// before any of this file's own statements, regardless of source order.
// Dynamic `import()` is used instead specifically because it defers loading
// until this line is actually reached.
dns.setDefaultResultOrder("ipv4first");

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
