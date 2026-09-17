import { api } from './axios';

/**
 * Downloads a CSV from an authenticated endpoint. A plain `<a href>` cannot be
 * used because the export routes sit behind the bearer token, so the file is
 * fetched as a blob and handed to the browser through a temporary object URL.
 */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const response = await api.get(path, { responseType: 'blob' });

  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
