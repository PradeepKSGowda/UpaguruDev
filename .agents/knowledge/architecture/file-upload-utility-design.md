# File Upload Utility & Multi-Tier Validation Architecture

## 1. Executive Summary & Problem Context
In government exam portals like UPA-GURU, uploading arbitrary files carries severe security risks:
- Malicious executable binaries disguised as PDF files (e.g. `.exe` renamed to `.pdf`).
- Path traversal exploits (`../../etc/passwd` or overwrite attacks).
- Storage exhaustion denial-of-service via massive file uploads.
- Unsanctioned public access to sensitive draft recruitment notifications prior to admin HITL verification.

To eliminate these vulnerabilities, **TASK-06010102** (`SUB-0601010201`) establishes a resilient, strongly-typed file upload utility in `lib/storage/upload.ts` backed by a pre-upload validation engine (`lib/storage/validation.ts`) and Zod schemas (`lib/schemas/storage.ts`).

---

## 2. Multi-Tier Validation Pipeline

Every file passing through `uploadFile()` is subjected to a 6-stage validation pipeline before any storage bytes are allocated:

```
  Incoming Upload Payload (File / Blob / Buffer / Uint8Array)
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Bucket Registry Validation                            │
  │    - Is bucket a known StorageBucketId?                  │
  │    - Rejects invalid/tampered bucket names               │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 2. File Size Threshold Gate                              │
  │    - Detects byte length across all payload types        │
  │    - Blocks 0-byte empty files                           │
  │    - Compares size against bucket limit:                 │
  │      • 50 MB for PDFs (notifications/drafts)             │
  │      • 5 MB for logos                                    │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 3. MIME Whitelist Verification                           │
  │    - Normalizes explicit and detected content types      │
  │    - Matches against STORAGE_BUCKET_CONFIGS whitelist    │
  │    - Rejects prohibited MIME formats immediately         │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 4. Extension-MIME Anti-Spoofing Check                    │
  │    - Verifies extension matches detected MIME type       │
  │    - Prevents masked executables (.exe with PDF header)  │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 5. Path Sanitization & Traversal Immunity                │
  │    - Strips null bytes, control chars, and '..' segments │
  │    - Replaces whitespace and non-ASCII chars with '_'    │
  │    - Generates unique timestamped IDs if unnamed         │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 6. Storage Dispatch & URL Strategy                       │
  │    - Public Buckets: Resolves immutable CDN URL          │
  │    - Private Buckets: Issues 15-minute Signed URL        │
  └──────────────────────────────────────────────────────────┘
```

---

## 3. Storage Bucket Configuration Matrix

| Bucket ID | Max Size | Allowed MIME Types | Valid Extensions | URL Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **`public-notifications`** | 50 MB (`52,428,800` bytes) | `application/pdf` | `.pdf` | Global CDN URL (`getPublicUrl`) |
| **`public-logos`** | 5 MB (`5,242,880` bytes) | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg` | Global CDN URL (`getPublicUrl`) |
| **`draft-attachments`** | 50 MB (`52,428,800` bytes) | `application/pdf` | `.pdf` | 15-Minute Signed URL (`createSignedUrl`) |

---

## 4. Structured Error Model

Failures return structured, non-throwing error results typed via `UploadFileFailure`:

| Error Code | Trigger Condition | Example User-Facing Message |
| :--- | :--- | :--- |
| `INVALID_BUCKET` | Unrecognized bucket string passed | `Bucket 'temp' is not recognized in UPA-GURU storage registry.` |
| `FILE_EMPTY` | File payload has 0 bytes | `The uploaded file is empty (0 bytes).` |
| `FILE_TOO_LARGE` | Size exceeds bucket threshold | `File size (54.20 MB) exceeds maximum allowed threshold of 50.0 MB for bucket 'public-notifications'.` |
| `INVALID_MIME_TYPE` | MIME type not in whitelist | `MIME type 'application/zip' is prohibited in bucket 'public-notifications'.` |
| `EXTENSION_MISMATCH` | Extension contradicts MIME type | `File extension '.exe' does not match detected MIME type 'application/pdf'.` |
| `STORAGE_UPLOAD_ERROR` | Supabase gateway rejection or S3 network error | `Failed to upload file to Supabase Storage.` |
| `SIGNED_URL_ERROR` | Failed to issue signed URL on private bucket | `File uploaded successfully but failed to create signed URL.` |

---

## 5. Client Selection & Security Isolation

`uploadFile()` incorporates contextual client resolution:
1. **Private Buckets (`draft-attachments`)**: Automatically utilizes `createAdminClient()` (service-role key) or authenticated admin server client. Anonymous clients cannot upload or read files.
2. **Public Buckets (`public-notifications`, `public-logos`)**: Uses standard authenticated `createServerClient()`, respecting user RLS permissions.
3. **Optional Client Injection**: Callers can inject pre-existing Supabase instances to maintain existing transaction or session contexts.
