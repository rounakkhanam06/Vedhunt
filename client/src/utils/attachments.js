// Ticket attachments are stored as Cloudinary URLs — helpers shared by the
// Client Portal, Admin Support Desk and Employee Portal ticket views.

export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_UPLOAD = 3;
export const ATTACHMENT_MAX_PER_TICKET = 10;

const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp)$/i;

export const attachmentName = (url = '') => {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return last || 'attachment';
  } catch {
    return String(url).split('/').pop() || 'attachment';
  }
};

export const isImageAttachment = (url = '') => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) || /\/image\/upload\//.test(url);

// Returns an error message, or null if the selection is acceptable
export const validateAttachmentFiles = (files, alreadyAttached = 0) => {
  if (files.length > ATTACHMENT_MAX_PER_UPLOAD) return `You can upload up to ${ATTACHMENT_MAX_PER_UPLOAD} files at a time.`;
  if (alreadyAttached + files.length > ATTACHMENT_MAX_PER_TICKET) {
    return `A ticket can have at most ${ATTACHMENT_MAX_PER_TICKET} attachments.`;
  }
  for (const f of files) {
    if (!ALLOWED_EXT.test(f.name)) return `"${f.name}" is not allowed. Use PDF, JPG, PNG or WEBP.`;
    if (f.size > ATTACHMENT_MAX_BYTES) return `"${f.name}" is larger than 5MB.`;
  }
  return null;
};
