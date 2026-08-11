# R2 attachment policy

The attachment bucket is private. Objects are uploaded and downloaded only through authenticated, trip-scoped Worker routes; `r2.dev` public access must remain disabled.

Application limits:

- Total stored attachment metadata: 2 GiB. Uploads are rejected before `R2.put` when the D1 sum plus the incoming files exceeds this cap.
- JPEG, PNG, WEBP: 5 MiB per file and up to five images per post.
- PDF: 10 MiB per file.
- D1 stores metadata and byte sizes only. File bytes live in R2.
- Deleting a post deletes its R2 objects before deleting D1 metadata.

The 2 GiB limit is an application guard, not a Cloudflare account spending cap. Direct Dashboard/S3 uploads bypass it, so production writes must use the application API only. Configure a low billable-usage notification (recommended: USD 1) in Cloudflare Billing as a secondary alert; notifications do not stop usage.

Cloudflare currently includes a monthly R2 free tier for Standard storage, but limits and pricing can change. Verify the current [R2 pricing documentation](https://developers.cloudflare.com/r2/pricing/) before changing this policy.
