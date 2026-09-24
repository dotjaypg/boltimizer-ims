---
name: Inventory image persistence
description: Safe persistence boundary for inventory item images
---
Persist inventory images as nullable validated URLs until authenticated object storage uploads are available. Do not accept base64 image data or expose an unauthenticated file-upload endpoint.

**Why:** The inventory app currently has no authentication or protected upload path, while persistent object storage requires access-controlled upload URLs.

**How to apply:** Keep the image URL field as the supported mechanism. If true file uploads are requested, add authentication and App Storage together before adding a file input that persists uploaded assets.