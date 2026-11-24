# Cyber Pocket Lab – ESP32 CYD web flasher

1. Push this folder to a GitHub repo, import it in Vercel (build/output are set in `vercel.json`).
2. Vercel > Settings > Environment Variables: `SITE_URL` = https://your-domain, `GITHUB_TOKEN` = any token with no scopes (avoids API rate limits).
3. Vercel > Settings > Git > Deploy Hooks: create a hook, add its URL as GitHub repo secret `VERCEL_DEPLOY_HOOK` (daily refresh in `.github/workflows`).
4. Add your domain in Vercel > Domains.
5. Add a firmware: edit `firmwares.json` (`enabled: true`, `match` regex for the CYD asset name, `offset`). Build logs show `ok` or `SKIP <reason>` per firmware.

Test locally: `GITHUB_TOKEN=... node scripts/sync.mjs` then serve `public/` over `localhost` (Web Serial needs HTTPS or localhost).
