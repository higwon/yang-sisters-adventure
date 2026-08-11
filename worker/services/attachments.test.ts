import { describe, expect, it } from 'vitest';
import { assertWithinQuota, ATTACHMENT_QUOTA_BYTES, safeFileName, validateAttachments } from './attachments';

describe('attachment limits', () => {
  it('accepts supported small files', () => {
    expect(() => validateAttachments([new File(['x'], 'photo.webp', { type: 'image/webp' })])).not.toThrow();
  });

  it('rejects unsupported files and more than five images', () => {
    expect(() => validateAttachments([new File(['x'], 'note.txt', { type: 'text/plain' })])).toThrow();
    const images = Array.from({ length: 6 }, (_, index) => new File(['x'], `${index}.png`, { type: 'image/png' }));
    expect(() => validateAttachments(images)).toThrow('5개');
  });

  it('blocks writes over the app quota', () => {
    expect(() => assertWithinQuota(ATTACHMENT_QUOTA_BYTES - 1, 1)).not.toThrow();
    expect(() => assertWithinQuota(ATTACHMENT_QUOTA_BYTES, 1)).toThrow('2GB');
  });

  it('removes unsafe object-key characters', () => {
    expect(safeFileName('../여권 사진.png')).toBe('..______.png');
  });
});
