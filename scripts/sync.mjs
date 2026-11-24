// Build step: pulls release binaries from GitHub, writes esp-web-tools manifests + data.json into /public
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const SITE = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');
const cfg = JSON.parse(await fs.readFile('firmwares.json', 'utf8'));
const H = { 'User-Agent': 'cyber-pocket-lab', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) H.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const safe = s => String(s).replace(/[^\w.-]+/g, '_');

await fs.rm('public', { recursive: true, force: true });
await fs.mkdir('public/fw', { recursive: true });
const out = { updated: new Date().toISOString(), device: cfg.device, firmwares: [], soon: [] };

for (const fw of cfg.firmwares) {
  if (!fw.enabled) { out.soon.push({ name: fw.name, repo: fw.repo }); continue; }
  try {
    const r = await fetch(`https://api.github.com/repos/${fw.repo}/releases?per_page=20`, { headers: H });
    if (!r.ok) throw new Error('GitHub API ' + r.status);
    const rels = (await r.json()).filter(x => !x.draft);
    const re = new RegExp(fw.match, 'i'), ex = fw.exclude ? new RegExp(fw.exclude, 'i') : null;
    const pick = x => x.assets.find(a => a.name.endsWith('.bin') && re.test(a.name) && !(ex && ex.test(a.name)));
    const ok = rels.filter(pick);
    const stable = ok.filter(x => !x.prerelease);
    const sel = [];
    if (stable[0]) sel.push(['Latest', stable[0]]);
    if (stable[1]) sel.push(['Previous', stable[1]]);
    const beta = ok.find(x => x.prerelease && (!stable[0] || new Date(x.published_at) > new Date(stable[0].published_at)));
    if (beta) sel.push([sel.length ? 'Beta' : 'Latest', beta]);
    if (!sel.length) throw new Error(`no asset matching /${fw.match}/ in last ${rels.length} releases`);

    const versions = [];
    for (const [label, rel] of sel) {
      const a = pick(rel), dir = `fw/${fw.id}/${safe(rel.tag_name)}`;
      const res = await fetch(a.browser_download_url, { headers: { 'User-Agent': 'cyber-pocket-lab' } });
      if (!res.ok) throw new Error(`download ${a.name}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = safe(a.name);
      await fs.mkdir(`public/${dir}`, { recursive: true });
      await fs.writeFile(`public/${dir}/${file}`, buf);
      await fs.writeFile(`public/${dir}/manifest.json`, JSON.stringify({
        name: `${fw.name} ${rel.tag_name}`, version: rel.tag_name, new_install_prompt_erase: true,
        builds: [{ chipFamily: cfg.device.chip, parts: [{ path: file, offset: fw.offset ?? 0 }] }]
      }));
      versions.push({
        label, tag: rel.tag_name, date: rel.published_at, prerelease: rel.prerelease,
        manifest: `${dir}/manifest.json`, file: `${dir}/${file}`, size: buf.length,
        sha256: crypto.createHash('sha256').update(buf).digest('hex'), notes: rel.html_url
      });
    }
    out.firmwares.push({ id: fw.id, name: fw.name, desc: fw.desc, repo: fw.repo, license: fw.license, url: `https://github.com/${fw.repo}`, versions });
    console.log(`ok   ${fw.id}: ${versions.map(v => v.tag).join(', ')}`);
  } catch (e) { console.warn(`SKIP ${fw.id}: ${e.message}`); }
}

if (!out.firmwares.length) { console.error('No firmware built. Failing so the last good deploy stays live.'); process.exit(1); }
await fs.writeFile('public/data.json', JSON.stringify(out));
const html = await fs.readFile('site/index.html', 'utf8');
await fs.writeFile('public/index.html', html.replaceAll('__SITE_URL__', SITE));
await fs.writeFile('public/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
await fs.writeFile('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc><lastmod>${out.updated.slice(0, 10)}</lastmod></url></urlset>\n`);
