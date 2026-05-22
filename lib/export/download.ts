// Client-side file download. The app is a static export with no server
// (AGENTS.md rule 1), so a "download" is a Blob handed to the browser — never
// a network round-trip. This keeps exports consistent with the privacy
// invariant (rule 2): the bytes go straight to the user's own disk.

export function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick — revoking synchronously can cancel the download
  // in some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
