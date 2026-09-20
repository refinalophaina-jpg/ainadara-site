try {
  const saved = localStorage.getItem('ainadara-theme');
  if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
} catch { /* Theme is optional when storage is unavailable. */ }
