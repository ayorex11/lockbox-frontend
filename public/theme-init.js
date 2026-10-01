// Apply the saved theme before first paint to avoid a flash. Kept as a separate file so the
// Content-Security-Policy can disallow inline scripts.
try {
  var saved = localStorage.getItem('lockbox:theme')
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (dark) document.documentElement.classList.add('dark')
} catch (e) {}
