/**
 * Utility functions for image processing
 */

/**
 * Convert an image file to WebP format
 * @param file - The original image file
 * @param quality - Quality of the output (0-1), default 0.8
 * @returns Promise<File> - The converted WebP file
 */
export async function convertToWebP(file: File, quality: number = 0.8): Promise<File> {
  // If already WebP, return as-is
  if (file.type === 'image/webp') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not convert image to WebP'));
            return;
          }

          // Create new filename with .webp extension
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const webpFile = new File([blob], `${originalName}.webp`, {
            type: 'image/webp',
          });

          resolve(webpFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get the storage bucket URL for direct access
 * @param bucketName - The storage bucket name
 * @param projectId - The Supabase project ID
 * @returns The direct URL to the storage bucket
 */
export function getStorageBucketUrl(bucketName: string, projectId: string): string {
  return `https://${projectId}.supabase.co/storage/v1/object/public/${bucketName}`;
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
