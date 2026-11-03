// Back to the site: on Try again, when Windows says it's online, and every 15 seconds once the
// site answers. A failed load brings this page back (src/site.js).
const site = new URLSearchParams(location.search).get('site')
const retry = () => site && location.replace(site)

async function siteAnswers() {
  try {
    await fetch(site, { mode: 'no-cors', cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

document.getElementById('retry').addEventListener('click', retry)
window.addEventListener('online', async () => (await siteAnswers()) && retry())
setInterval(async () => (await siteAnswers()) && retry(), 15000)
