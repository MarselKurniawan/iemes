/**
 * External storage upload utility
 * Uploads files to storage-ims.sinergimax.com
 */

const STORAGE_UPLOAD_URL = 'https://storage-ims.sinergimax.com/upload.php';
const STORAGE_MIGRATE_URL = 'https://storage-ims.sinergimax.com/migrate.php';
export const STORAGE_BASE_URL = 'https://storage-ims.sinergimax.com/uploads';

/**
 * Upload a file to external storage
 */
export async function uploadToExternalStorage(
  file: File,
  propertyId: string
): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('property_id', propertyId);

  try {
    const response = await fetch(STORAGE_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Upload error:', result.error);
      return null;
    }

    return result.url;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
}

/**
 * Migrate images from old storage to external storage
 */
export async function migrateImages(
  images: { url: string; property_id: string }[]
): Promise<{ old_url: string; new_url?: string; success: boolean; error?: string }[]> {
  try {
    const response = await fetch(STORAGE_MIGRATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });

    const result = await response.json();
    return result.results || [];
  } catch (error) {
    console.error('Migration failed:', error);
    return images.map((img) => ({ old_url: img.url, success: false, error: 'Network error' }));
  }
}

/**
 * Get storage folder URL for a property
 */
export function getExternalStorageUrl(propertyId: string): string {
  return `${STORAGE_BASE_URL}/${propertyId}/`;
}
