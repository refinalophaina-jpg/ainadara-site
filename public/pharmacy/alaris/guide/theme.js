try {
  if (localStorage.getItem('ainadara-theme') === 'dark' || (!localStorage.getItem('ainadara-theme') && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
} catch { /* Storage may be unavailable; keep the readable light default. */ }
