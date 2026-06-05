# Hardened Firestore Security Specification for Uber Driver Data Extractor

This spec details the strict identity boundaries, relational constraints, and strict schema layouts that protect driver information.

## 1. Data Invariants

1.  **Identified Access Only**: Only Google authenticated organization managers with verified emails can search, view, create, or update driver profiles.
2.  **Immutability of Key Timestamps**: `first_seen` timestamps cannot be changed after initial document creation.
3.  **Strict Size Enforcements**: To protect against denial of wallet string overflows, maximum characters are strictly enforced on all strings:
    -   `photo_url` max size: 2048 chars.
    -   `name` max size: 200 chars.
    -   `email`, `old_email` max size: 256 chars.
    -   `phone`, `old_phone` max size: 64 chars.
4.  **Uniform Record Target**: The document key must strictly equal the driver's parsed `uuid`.

## 2. The "Dirty Dozen" Payloads

The rules are proven secure against these standard privilege escalation and integrity attacks:

| ID  | Scenario | Target Path | Payload | Expected Outcome |
|---|---|---|---|---|
| D01 | Unauthenticated read | `/drivers/e0d56434-9cab` | Read document | `PERMISSION_DENIED` |
| D02 | Unauthenticated write | `/drivers/e0d56434-9cab` | Create mock driver | `PERMISSION_DENIED` |
| D03 | Unverified Email bypass | `/drivers/e0d56434-9cab` | Write payload | `PERMISSION_DENIED` |
| D04 | Document ID mismatch | `/drivers/malicious-uuid` | `{ uuid: "correct-uuid" }` | `PERMISSION_DENIED` |
| D05 | Giant photo URL attack | `/drivers/e0d56434-9cab` | `{ photo_url: "A" * 3000 }` | `PERMISSION_DENIED` |
| D06 | Invalid type injection (trips as bool) | `/drivers/e0d56434-9cab` | `{ tip_count: true }` | `PERMISSION_DENIED` |
| D07 | Missing required schema key | `/drivers/e0d56434-9cab` | `{ name: "Mehedi" }` // missing other core fields | `PERMISSION_DENIED` |
| D08 | Malformed custom regex ID | `/drivers/driver#$$` | Valid driver payload | `PERMISSION_DENIED` |
| D09 | Immortal field modification (`first_seen`) | `/drivers/e0d56434-9cab` | Modify `first_seen` | `PERMISSION_DENIED` |
| D10 | Unauthorized deletion by random user | `/drivers/e0d56434-9cab` | Delete document | `PERMISSION_DENIED` |
| D11 | Overriding contact change flag to false | `/drivers/e0d56434-9cab` | Payload with malformed boolean type | `PERMISSION_DENIED` |
| D12 | System injection (ghost parameters) | `/drivers/e0d56434-9cab` | `{ ghost_param : true }` | `PERMISSION_DENIED` |
