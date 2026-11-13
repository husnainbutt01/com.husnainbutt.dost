import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { storage } from './firebase';

// Prevent Firebase Storage SDK from silently retrying for 10 minutes when Storage isn't enabled/CORS blocked
storage.maxUploadRetryTime = 6000;
storage.maxOperationRetryTime = 6000;

// Session cache: if Storage bucket isn't initialized/CORS-enabled, avoid waiting on every small photo/voice upload
let storageBucketUnavailable = false;

export interface UploadOptions {
  isImage?: boolean;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

async function compressImageToBlobAndDataUrl(
  file: File,
  maxDim = 960,
  quality = 0.74
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            resolve({ blob, dataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function isStorageInfraError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    msg === 'STORAGE_STALLED' ||
    code === 'storage/bucket-not-found' ||
    code === 'storage/unauthorized' ||
    code === 'storage/retry-limit-exceeded' ||
    code === 'storage/project-not-found' ||
    code === 'storage/unknown'
  );
}

function uploadWithStallGuard(
  path: string,
  payload: Blob | File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
  stallTimeoutMs = 4500
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task: UploadTask = uploadBytesResumable(storageRef, payload);
    let hasTransferredAnyBytes = false;
    let settled = false;

    const cleanup = () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      task.cancel();
      reject(new Error('Upload cancelled.'));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort);

    // If 0 bytes move within stallTimeoutMs (e.g., Storage bucket not enabled or CORS blocked), fail fast instead of hanging!
    const stallTimer = window.setTimeout(() => {
      if (!hasTransferredAnyBytes && !settled) {
        settled = true;
        task.cancel();
        reject(new Error('STORAGE_STALLED'));
      }
    }, stallTimeoutMs);

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.bytesTransferred > 0) {
          hasTransferredAnyBytes = true;
          storageBucketUnavailable = false;
        }
        if (snapshot.totalBytes > 0 && onProgress) {
          const pct = Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          onProgress(pct);
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
      async () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          if (onProgress) onProgress(100);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function uploadMediaFile(
  path: string,
  file: Blob | File,
  options?: UploadOptions
): Promise<string> {
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  const { isImage, onProgress, signal } = options || {};

  if (signal?.aborted) {
    throw new Error('Upload cancelled.');
  }

  // 1. Compress images upfront so both Storage upload AND fallback are near-instant (~80KB instead of 8MB)
  let uploadPayload: Blob | File = file;
  let precompressedDataUrl: string | null = null;

  if (isImage && file instanceof File) {
    try {
      const compressed = await compressImageToBlobAndDataUrl(file, 900, 0.72);
      uploadPayload = compressed.blob;
      precompressedDataUrl = compressed.dataUrl;
      if (onProgress) onProgress(35);
    } catch {}
  }

  const fitsInlineLimit = Boolean(precompressedDataUrl) || uploadPayload.size <= 530 * 1024;
  const shouldAttemptStorage = isOnline && (!storageBucketUnavailable || !fitsInlineLimit);

  // 2. Try Firebase Storage with a short stall guard (2.5s for small/inline files, 5s for large videos)
  if (shouldAttemptStorage) {
    try {
      const stallMs = fitsInlineLimit ? 2500 : 5000;
      const downloadUrl = await uploadWithStallGuard(path, uploadPayload, onProgress, signal, stallMs);
      storageBucketUnavailable = false;
      return downloadUrl;
    } catch (err: any) {
      if (err?.message === 'Upload cancelled.') {
        throw err;
      }
      if (isStorageInfraError(err)) {
        storageBucketUnavailable = true;
      }
      console.warn('Firebase Storage fast fallback:', err?.message || err);
    }
  }

  // 3. Instant fallback for compressed images (must stay <= 750,000 chars per firestore.rules)
  if (precompressedDataUrl) {
    if (precompressedDataUrl.length <= 720000) {
      if (onProgress) onProgress(100);
      return precompressedDataUrl;
    }
    if (file instanceof File) {
      const tighter = await compressImageToBlobAndDataUrl(file, 640, 0.6);
      if (onProgress) onProgress(100);
      return tighter.dataUrl;
    }
  }

  // 4. Instant fallback for voice notes, small videos, and small documents (<= 530KB fits 750k base64 rule)
  if (uploadPayload.size <= 530 * 1024) {
    const dataUrl = await blobToDataUrl(uploadPayload);
    if (dataUrl.length <= 740000) {
      if (onProgress) onProgress(100);
      return dataUrl;
    }
  }

  throw new Error(
    isOnline
      ? 'Large videos (>500KB) require Firebase Storage enabled in Firebase Console (https://console.firebase.google.com/project/gen-lang-client-0702743020/storage → Get Started), or send a shorter clip under 500KB.'
      : 'Offline mode supports photos, voice notes, and clips up to 500KB.'
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
