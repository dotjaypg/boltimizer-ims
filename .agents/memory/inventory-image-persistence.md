---
name: Inventory image persistence
description: Safe persistence boundary for inventory item images
---
Persist inventory images as nullable external URLs or App Storage object paths. File uploads must request a protected presigned upload URL and must never store base64 data in PostgreSQL.

**Why:** Uploaded image files need durable storage without inflating database rows, and the upload URL is the access-control boundary.

**How to apply:** Keep external HTTPS URLs working. Store returned object paths for uploaded files and render them through the API storage route. Keep upload URL issuance authenticated.