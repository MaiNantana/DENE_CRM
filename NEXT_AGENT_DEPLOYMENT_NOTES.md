# Deployment Notes for the Next Codex

Project: `DENE_CRM`
Target URL: `http://crm.serveftp.com/`
Target host: `hr.iexcellence.cloud`
Target folder on server: `C:\Program Files\iisnode\www\crm`

## What the app is

- This is a Vite + React frontend.
- There is no backend service in this repo.
- Deploying the built `dist/` folder is enough for static hosting.
- The app does not use a client-side router, so IIS rewrite rules are not currently required.

## Verified locally

- `npm install` completed successfully.
- `npm run lint` passed.
- `npm run build` passed and produced a `dist/` folder.

Build output currently includes:

- `dist/index.html`
- `dist/assets/index-*.css`
- `dist/assets/index-*.js`

## Network / access findings

- DNS resolves `hr.iexcellence.cloud` as a CNAME to `iexcellence.cloud`, which currently resolves to `13.55.200.177`.
- Open ports from this environment:
  - `22` open
  - `80` open
  - `443` open
  - `3389` open
- Closed/unavailable from this environment:
  - `21` closed
  - `445` closed
  - `5985` closed
  - `5986` closed
- SMB admin share access to `\\\\hr.iexcellence.cloud\\c$` failed.
- WinRM failed.
- SSH password auth failed with the provided credentials when trying `Administrator`.
- No CLI RDP client is installed in this environment (`xfreerdp`, `rdesktop`, `remmina` are not present).

## Credential notes

- The user provided:
  - username: `Administrator`
  - password: provided in chat
- Do not persist the password in repo files.

## Most likely working deployment path

RDP looks like the most plausible path because port `3389` is open and the target folder is clearly a Windows IIS path.

If you have a GUI-capable environment or an RDP client, try:

1. Connect to `hr.iexcellence.cloud:3389`
2. Log in as `Administrator`
3. Open `C:\Program Files\iisnode\www\crm`
4. Copy the contents of `dist/` into that folder
5. Make sure `index.html` is at the folder root, not inside another nested `dist` folder

## If RDP is not usable

If login fails on RDP too, the next agent should ask for one of these:

- a working SSH/SFTP username that actually authenticates on port `22`
- an FTP/SFTP account if the host is configured that way
- confirmation that the `Administrator` password is correct for RDP on this server

## Practical deployment checklist

1. Re-run `npm run build` if source files change.
2. Upload only the `dist/` contents.
3. Verify `http://crm.serveftp.com/` loads the built page.
4. If IIS serves a blank page, confirm the `index.html` and `/assets/*` files were copied to the correct web root.

