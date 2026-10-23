# Poster Wall

A small site for browsing my posters at their true proportions. Once deployed, everything is managed from the site itself — no code changes needed to add or remove work.

- **Visitors** can browse without logging in. The toggle at the top switches between **Strip** (one poster at a time — click, drag, ←/→ keys, or trackpad scroll) and **Grid** (everything at once).
- **Admin** — click `Admin` in the footer and enter the password to add posters (drag and drop, paste, or the `+ Add posters` card) and remove them (click Remove twice).
- Posters are served as WebP resized to the size they're shown at, never as the original print file (Next.js Image Optimization).

## Deploy to Vercel

1. Push this folder to a GitHub repository and **Import** it in Vercel.
2. In the project, go to **Storage → Create → Blob** to create a store.
   - Choose **Public** access, so anyone can see the poster images.
   - Connecting the store adds the `BLOB_READ_WRITE_TOKEN` environment variable automatically.
3. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` (make it long and hard to guess).
4. **Redeploy**.

Changing the password logs out every existing session.

## Run locally

```bash
npm install
vercel link && vercel env pull   # fetches BLOB_READ_WRITE_TOKEN (the Blob store must be connected to the Development environment)
echo "ADMIN_PASSWORD=your-password" >> .env.local
npm run dev
```

Then open http://localhost:3000.

## Structure

| Path | Purpose |
| --- | --- |
| `app/PosterWall.tsx` | The whole interface: Strip and Grid views, login, uploads |
| `app/globals.css` | Styles, mirroring the tokens in `DESIGN.md` (light and dark) |
| `lib/store.ts` | Reading and deleting posters in Vercel Blob |
| `lib/auth.ts` | Admin password and session cookie |
| `app/api/*` | Upload, delete, login, and state endpoints |
| `next.config.ts` | Image optimization settings |
| `DESIGN.md` | Design system: tokens, components, and layout rules |

## How it works

There's no database — Vercel Blob is the only storage. Each poster's name, pixel size, and upload time are encoded in its file path, so listing the store is enough to rebuild the wall.

Uploads go straight from the browser to Blob. Each image can be up to 50 MB (JPG, PNG, WebP, GIF, or AVIF).

## Built with

Next.js, React, [Motion](https://motion.dev) for the spring animations, and Vercel Blob for storage.