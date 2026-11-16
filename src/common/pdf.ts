/** True when the bytes start with the PDF magic number. */
export const isPdf = (file: Buffer): boolean => file.subarray(0, 5).toString() === '%PDF-';
