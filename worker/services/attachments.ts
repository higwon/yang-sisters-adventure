export const ATTACHMENT_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_POST = 5;

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateAttachments(files: File[]) {
  if (files.length === 0) return;
  const images = files.filter((file) => imageTypes.has(file.type));
  if (images.length > MAX_IMAGES_PER_POST) throw new Error(`이미지는 게시물당 ${MAX_IMAGES_PER_POST}개까지 올릴 수 있어요.`);
  for (const file of files) {
    if (imageTypes.has(file.type)) {
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: 이미지는 5MB까지 올릴 수 있어요.`);
    } else if (file.type === 'application/pdf') {
      if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name}: PDF는 10MB까지 올릴 수 있어요.`);
    } else {
      throw new Error(`${file.name}: JPEG, PNG, WEBP, PDF만 올릴 수 있어요.`);
    }
  }
}

export function assertWithinQuota(usedBytes: number, incomingBytes: number) {
  if (!Number.isSafeInteger(usedBytes) || !Number.isSafeInteger(incomingBytes) || incomingBytes < 0) {
    throw new Error('첨부파일 크기를 확인할 수 없어요.');
  }
  if (usedBytes + incomingBytes > ATTACHMENT_QUOTA_BYTES) {
    throw new Error('첨부파일 저장공간 2GB 한도에 도달했어요. 기존 파일을 삭제한 뒤 다시 시도해 주세요.');
  }
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'attachment';
}
