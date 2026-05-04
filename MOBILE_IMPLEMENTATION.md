# Mobile App OCR Implementation Guide

To enable driver self-service document uploads with OCR support, follow these implementation details.

## 1. OCR Integration (OCR.space)

Use the same API logic as the portal. Drivers should be able to snap a photo, which is then sent to OCR.space for pre-filling.

**API Endpoint:** `https://api.ocr.space/parse/image`
**Request Format:** `multipart/form-data`
**Key Fields:**
- `apikey`: Use the shared OCR.space API key.
- `file`: The image captured by the camera.
- `language`: `eng`
- `isOverlayRequired`: `false`

## 2. Document Storage Convention

Files must be uploaded to the Supabase buckets using the following pathing to ensure the portal can locate and manage them.

- **Driver Documents:** `driver-documents` bucket
  - Path: `/{company_id}/{user_id}/{document_type}_{timestamp}`
  - Example: `/789/123/HGV_Licence_1710432000000`

- **Vehicle Documents:** `vehicle-documents` bucket (if drivers are allowed to upload V5C/Insurance)
  - Path: `/{company_id}/{vehicle_id}/{document_type}_{timestamp}`

## 3. Database Metadata

After a successful storage upload, insert a record into the corresponding table:

### `driver_documents`
- `user_id`: UUID of the driver.
- `company_id`: UUID of the company.
- `document_type`: `HGV_Licence`, `CPC_Card`, or `Tacho_Card`.
- `storage_path`: The path used in Supabase storage.
- `id_number`: Extracted/edited licence or card number.
- `expiry_date`: Extracted/edited date in `YYYY-MM-DD`.
- `verified_at`: **MUST BE NULL**. This indicates "Pending Review" status in the Manager Portal.

## 4. UI/UX Flow
1. Driver selects document type.
2. App opens camera.
3. Photo is taken and sent to OCR.
4. App shows "Processing..." overlay.
5. App displays a form pre-filled with OCR data (ID Number and Expiry).
6. Driver confirms or corrects the data.
7. File is uploaded to Supabase Storage.
8. Record is created in Supabase DB with `verified_at = null`.
9. Driver sees a "Pending Verification" badge on their profile.
