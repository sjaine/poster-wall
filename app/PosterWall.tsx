'use client';

import { upload } from '@vercel/blob/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Fit, Poster, Settings } from '@/lib/store';

const PRESETS: [string, number, number][] = [
  ['9×11', 9, 11],
  ['11×17', 11, 17],
  ['18×24', 18, 24],
  ['24×36', 24, 36],
  ['A4', 8.27, 11.69],
];
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
};
const LOCAL_KEY = 'poster-wall-size';

type Props = { initialPosters: Poster[]; initialSettings: Settings; initialAdmin: boolean };

// ---------- helpers ----------
function nameToB64(name: string) {
  const bytes = new TextEncoder().encode(name.slice(0, 60));
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function measure(file: File) {
  return new Promise<[number, number]>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve([img.naturalWidth, img.naturalHeight]); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve([0, 0]); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
const readLocal = (): Settings | null => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { return null; }
};
const writeLocal = (s: Settings | null) => {
  try { s ? localStorage.setItem(LOCAL_KEY, JSON.stringify(s)) : localStorage.removeItem(LOCAL_KEY); } catch {}
};

export default function PosterWall({ initialPosters, initialSettings, initialAdmin }: Props) {
  const [posters, setPosters] = useState(initialPosters);
  const [admin, setAdmin] = useState(initialAdmin);
  const [shared, setShared] = useState(initialSettings); // the site-wide default
  const [wStr, setWStr] = useState(String(initialSettings.w));
  const [hStr, setHStr] = useState(String(initialSettings.h));
  const [fit, setFit] = useState<Fit>(initialSettings.fit);
  const [hasLocal, setHasLocal] = useState(false);
  const [current, setCurrent] = useState<string | null>(initialPosters[0]?.url ?? null);
  const [status, setStatus] = useState<{ msg: string; err?: boolean }>({ msg: '' });
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [drag, setDrag] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const stageRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const w = Math.min(200, Math.max(1, parseFloat(wStr) || shared.w));
  const h = Math.min(200, Math.max(1, parseFloat(hStr) || shared.h));
  const say = (msg: string, err = false) => setStatus({ msg, err });

  // Visitors may keep their own size in this browser; the admin always edits the shared default.
  useEffect(() => {
    if (initialAdmin) return;
    const local = readLocal();
    if (local) { setWStr(String(local.w)); setHStr(String(local.h)); setFit(local.fit); setHasLocal(true); }
  }, [initialAdmin]);

  // Fit the mockup inside the stage at the chosen ratio.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mock = useMemo(() => {
    const availW = Math.max(0, box.w - 8), availH = Math.max(200, box.h - 8);
    let ph = availH, pw = (ph * w) / h;
    if (pw > availW) { pw = availW; ph = (pw * h) / w; }
    return { pw, ph };
  }, [box, w, h]);

  // ---------- size changes ----------
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commitSize = useCallback((next: Settings) => {
    if (admin) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const res = await fetch('/api/settings', { method: 'PUT', body: JSON.stringify(next) }).catch(() => null);
        if (res?.ok) { setShared(await res.json()); say('Default size saved for everyone.'); }
        else if (res?.status === 401) { setAdmin(false); say('Your login expired. Log in again to save the size.', true); }
        else say('The size could not be saved. Check your connection and try again.', true);
      }, 600);
    } else {
      writeLocal(next); setHasLocal(true);
    }
  }, [admin]);

  const setSize = (nw: number | string, nh: number | string, nf: Fit = fit) => {
    setWStr(String(nw)); setHStr(String(nh)); setFit(nf);
    const pw = parseFloat(String(nw)), ph = parseFloat(String(nh));
    if (pw >= 1 && ph >= 1 && pw <= 200 && ph <= 200) commitSize({ w: pw, h: ph, fit: nf });
  };
  const resetToDefault = () => {
    writeLocal(null); setHasLocal(false);
    setWStr(String(shared.w)); setHStr(String(shared.h)); setFit(shared.fit);
  };

  // ---------- data ----------
  const refresh = useCallback(async (select?: string) => {
    const res = await fetch('/api/state', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { posters: Poster[]; settings: Settings; admin: boolean };
    setPosters(data.posters);
    setShared(data.settings);
    setAdmin(data.admin);
    setCurrent((c) => (select && data.posters.some((p) => p.url === select) ? select
      : data.posters.some((p) => p.url === c) ? c : data.posters[0]?.url ?? null));
    return data;
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const list = files.filter((f) => EXT[f.type]);
    if (!list.length) { if (files.length) say('Use JPG, PNG, WebP, GIF or AVIF images.', true); return; }
    if (!admin) { say('Log in as admin to add posters.', true); return; }
    setBusy(true);
    let done = 0, firstUrl: string | undefined;
    for (const [i, f] of list.entries()) {
      say(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const [pw, ph] = await measure(f);
        const rand = Math.random().toString(36).slice(2, 8).padEnd(4, '0');
        const name = nameToB64(f.name.replace(/\.[^.]+$/, ''));
        const pathname = `posters/${Date.now()}-${rand}_${pw}x${ph}_${name}.${EXT[f.type]}`;
        const blob = await upload(pathname, f, {
          access: 'public', handleUploadUrl: '/api/upload', multipart: f.size > 8 * 1024 * 1024,
        });
        firstUrl ??= blob.url; done++;
      } catch (e) {
        const msg = (e as Error).message || '';
        say(/log in/i.test(msg) ? 'Your login expired. Log in again to add posters.'
          : /size|large|exceed/i.test(msg) ? `“${f.name}” is over 50 MB. Export a smaller file and try again.`
          : `“${f.name}” could not be uploaded. Try again.`, true);
        if (/log in/i.test(msg)) { setAdmin(false); break; }
      }
    }
    setBusy(false);
    if (done) {
      await refresh(firstUrl);
      say(`Added ${done} poster${done > 1 ? 's' : ''}.`);
      requestAnimationFrame(() => stripRef.current?.scrollTo({ left: stripRef.current.scrollWidth, behavior: 'smooth' }));
    }
  }, [admin, refresh]);

  const remove = async (p: Poster) => {
    if (armed !== p.url) { setArmed(p.url); say(`Click × again to remove “${p.name}”.`); return; }
    setArmed(null);
    const res = await fetch('/api/posters', { method: 'DELETE', body: JSON.stringify({ url: p.url }) }).catch(() => null);
    if (res?.ok) { say(`Removed “${p.name}”.`); refresh(); }
    else if (res?.status === 401) { setAdmin(false); say('Your login expired. Log in again to remove posters.', true); }
    else say('The poster could not be removed. Try again.', true);
  };
  useEffect(() => { if (!armed) return; const t = setTimeout(() => { setArmed(null); say(''); }, 4000); return () => clearTimeout(t); }, [armed]);

  // ---------- login ----------
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) }).catch(() => null);
    if (res?.ok) {
      setPassword(''); setLoginOpen(false); writeLocal(null); setHasLocal(false);
      const data = await refresh();
      const d = data?.settings ?? shared;
      setWStr(String(d.w)); setHStr(String(d.h)); setFit(d.fit);
      say('Logged in. You can add posters and set the default size.');
    } else {
      const msg = res ? ((await res.json().catch(() => ({}))).error ?? 'Wrong password.') : 'Could not reach the server.';
      say(msg, true);
    }
  };
  const logout = async () => { await fetch('/api/login', { method: 'DELETE' }).catch(() => null); setAdmin(false); say('Logged out.'); };

  // Keep size fields in sync when the shared default changes and nothing local overrides it.
  useEffect(() => {
    if (admin || hasLocal) return;
    setWStr(String(shared.w)); setHStr(String(shared.h)); setFit(shared.fit);
  }, [shared, admin, hasLocal]);

  // ---------- drag, paste, keyboard ----------
  useEffect(() => {
    const over = (e: DragEvent) => { e.preventDefault(); if (admin) setDrag(true); };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDrag(false); };
    const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles([...(e.dataTransfer?.files ?? [])]); };
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])].map((i) => i.getAsFile()).filter((f): f is File => !!f);
      if (files.length) addFiles(files);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const i = posters.findIndex((p) => p.url === current);
      if (e.key === 'ArrowRight' && i < posters.length - 1) setCurrent(posters[i + 1].url);
      if (e.key === 'ArrowLeft' && i > 0) setCurrent(posters[i - 1].url);
    };
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop); window.addEventListener('paste', paste); window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop); window.removeEventListener('paste', paste); window.removeEventListener('keydown', key);
    };
  }, [admin, addFiles, posters, current]);

  // ---------- render ----------
  const poster = posters.find((p) => p.url === current);
  const dpi = poster?.pw ? Math.round(Math.min(poster.pw / w, poster.ph / h)) : 0;
  const ratioOff = poster?.pw ? Math.abs(poster.pw / poster.ph / (w / h) - 1) > 0.02 : false;
  const isPreset = (pw: number, ph: number) => (pw === w && ph === h) || (pw === h && ph === w);

  return (
    <div className="app">
      <section className="settings" aria-labelledby="size-h">
        <h1 id="size-h">Size Settings</h1>
        <div className="dims">
          <label className="field" htmlFor="w">
            <input id="w" type="number" min={1} max={200} step={0.25} value={wStr}
              aria-label="Width in inches" onChange={(e) => setSize(e.target.value, hStr)} />
            <span>in</span>
          </label>
          <span className="times">×</span>
          <label className="field" htmlFor="h">
            <input id="h" type="number" min={1} max={200} step={0.25} value={hStr}
              aria-label="Height in inches" onChange={(e) => setSize(wStr, e.target.value)} />
            <span>in</span>
          </label>
          <button className="icon-btn" title="Swap orientation" aria-label="Swap width and height" onClick={() => setSize(hStr, wStr)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M4 2v11M4 13l-2.5-2.5M4 13l2.5-2.5M12 14V3M12 3L9.5 5.5M12 3l2.5 2.5" />
            </svg>
          </button>
        </div>
        <div className="presets">
          {PRESETS.map(([label, pw, ph]) => (
            <button key={label} aria-pressed={isPreset(pw, ph)}
              onClick={() => (h >= w ? setSize(pw, ph) : setSize(ph, pw))}>{label}</button>
          ))}
        </div>
        <p className="scope">
          {admin ? 'Size changes are saved as the default for everyone.'
            : hasLocal ? <>Showing your own size. <button onClick={resetToDefault}>Use default ({shared.w}×{shared.h} in)</button></>
            : `Default size ${shared.w}×${shared.h} in`}
        </p>
      </section>

      <main className="stage" ref={stageRef}>
        <div className={`mockup ${fit}${drag ? ' drag' : ''}`} style={{ width: mock.pw, height: mock.ph }} aria-live="polite">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster.url} alt={poster.name} />
          ) : admin ? (
            <button className="empty" onClick={() => fileRef.current?.click()}>
              <strong>Mockup</strong><span>Drop poster images here<br />or add them below</span>
            </button>
          ) : (
            <div className="empty"><strong>Mockup</strong><span>No posters yet</span></div>
          )}
        </div>
      </main>

      <div className="meta">
        {poster && (
          <>
            <span className="name">{poster.name}</span>
            {poster.pw > 0 && <span>{poster.pw}×{poster.ph}px</span>}
            {dpi > 0 && <span className={dpi < 150 ? 'warn' : ''} title={dpi < 150 ? 'Below 150 dpi may print soft' : undefined}>{dpi} dpi at {w}×{h} in</span>}
            {ratioOff && (
              <>
                <span className="warn">ratio differs</span>
                <span className="seg">
                  {(['fill', 'fit'] as Fit[]).map((k) => (
                    <button key={k} aria-pressed={fit === k} onClick={() => setSize(wStr, hStr, k)}>{k === 'fill' ? 'Fill' : 'Fit'}</button>
                  ))}
                </span>
              </>
            )}
          </>
        )}
      </div>
      <p className={`status${status.err ? ' err' : ''}`} role="status">{status.msg}</p>

      <section className="strip-wrap" aria-labelledby="prev-h">
        <div className="strip-head">
          <h2 id="prev-h">Previews</h2>
          <div className="right">
            {posters.length > 0 && <span className="count">{posters.length} poster{posters.length > 1 ? 's' : ''}</span>}
            {admin ? (
              <button className="text-btn" onClick={logout}>Log out</button>
            ) : loginOpen ? (
              <form className="login" onSubmit={login}>
                <input id="pw" type="password" autoFocus autoComplete="current-password" placeholder="Admin password"
                  aria-label="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="submit">Log in</button>
                <button type="button" className="text-btn" onClick={() => setLoginOpen(false)}>Cancel</button>
              </form>
            ) : (
              <button className="text-btn" onClick={() => setLoginOpen(true)}>Admin</button>
            )}
          </div>
        </div>
        <div className="strip" ref={stripRef}>
          {posters.map((p) => (
            <div className="thumb-item" key={p.url}>
              <button className="thumb" aria-label={`Preview ${p.name}`} aria-current={p.url === current} onClick={() => setCurrent(p.url)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" />
              </button>
              {admin && (
                <button className={`remove${armed === p.url ? ' armed' : ''}`} aria-label={`Remove ${p.name}`}
                  onClick={(e) => { e.stopPropagation(); remove(p); }}>×</button>
              )}
            </div>
          ))}
          {admin && (
            <button className="add" aria-label="Add posters" disabled={busy} onClick={() => fileRef.current?.click()}>
              <b>+</b><span>{busy ? 'Uploading' : 'Add'}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden
          onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </section>
    </div>
  );
}
