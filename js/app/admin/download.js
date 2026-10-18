// Saves a CSV built in the browser (RF-58, RF-62): no request, the file is made from the loaded data.
// The text already carries its BOM (js/lib/csv.js), so Excel reads it as UTF-8.

/** Downloads `text` as `name` through a temporary <a download>. */
export function downloadCsv(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  // Some browsers start the download after the click returns: free the URL a moment later.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
