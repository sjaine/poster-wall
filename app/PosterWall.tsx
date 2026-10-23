'use client';

import Image from 'next/image';
import { upload } from '@vercel/blob/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform,
  type AnimationPlaybackControls, type MotionValue, type PanInfo, type Transition,
} from 'motion/react';
import type { Poster } from '@/lib/store';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
};
const ADD = '__add__';
const DEFAULT_RATIO = 9 / 11; // empty mockup and the Add card
const VIEW_KEY = 'poster-wall-view';
const PORTFOLIO_URL = 'https://jaineysshin.com';
// The view area runs up behind the Strip/Grid toggle so the grid can scroll under it.
// Keep in sync with --header-h in globals.css.
const HEADER_H = 52;
// It also runs down behind the name line and footer; their measured height is passed to CSS as --bottom-h.
type View = 'strip' | 'grid';

type Props = { initialPosters: Poster[]; initialAdmin: boolean };

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
    const img = new window.Image();
    img.onload = () => { resolve([img.naturalWidth, img.naturalHeight]); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve([0, 0]); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
const ratioOf = (p?: Poster) => (p && p.pw && p.ph ? p.pw / p.ph : DEFAULT_RATIO);
const mod = (a: number, n: number) => ((a % n) + n) % n;

export default function PosterWall({ initialPosters, initialAdmin }: Props) {
  const [posters, setPosters] = useState(initialPosters);
  const [admin, setAdmin] = useState(initialAdmin);
  const [status, setStatus] = useState<{ msg: string; err?: boolean }>({ msg: '' });
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [drag, setDrag] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [bottomH, setBottomH] = useState(0); // name line + footer, which sit over the bottom of the view
  const box = useMemo(() => ({ w: viewSize.w, h: viewSize.h - HEADER_H - bottomH }), [viewSize, bottomH]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>('strip');
  // Remember each visitor's last view in their own browser.
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === 'grid' || v === 'strip') setViewState(v); } catch {}
  }, []);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} };

  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const say = (msg: string, err = false) => setStatus({ msg, err });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    const b = bottomRef.current;
    const rb = new ResizeObserver(([e]) => setBottomH(Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    if (b) rb.observe(b);
    return () => { ro.disconnect(); rb.disconnect(); };
  }, []);

  // ---------- data ----------
  const pendingSelect = useRef<string | null>(null); // poster to move to after the next refresh
  const refresh = useCallback(async (select?: string) => {
    const res = await fetch('/api/state', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { posters: Poster[]; admin: boolean };
    if (select) pendingSelect.current = select;
    setPosters(data.posters);
    setAdmin(data.admin);
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
    if (done) { await refresh(firstUrl); say(`Added ${done} poster${done > 1 ? 's' : ''}.`); }
  }, [admin, refresh]);

  const remove = async (p: Poster) => {
    if (armed !== p.url) { setArmed(p.url); say(`Click Remove again to delete “${p.name}”.`); return; }
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
      setPassword(''); setLoginOpen(false);
      await refresh();
      say('Logged in. You can add and remove posters.');
    } else {
      const msg = res ? ((await res.json().catch(() => ({}))).error ?? 'Wrong password.') : 'Could not reach the server.';
      say(msg, true);
    }
  };
  const logout = async () => { await fetch('/api/login', { method: 'DELETE' }).catch(() => null); setAdmin(false); say('Logged out.'); };

  // ---------- ring of posters ----------
  // Admins get an "Add" card after the last poster. With 4+ items the strip is a ring:
  // … 30 31 1 2 3 … and it opens on the first poster uploaded.
  const items = useMemo(() => [...posters.map((p) => p.url), ...(admin ? [ADD] : [])], [posters, admin]);
  const byUrl = useMemo(() => new Map(posters.map((p) => [p.url, p])), [posters]);
  const ratios = useMemo(() => items.map((id) => ratioOf(byUrl.get(id))), [items, byUrl]);
  const n = items.length;
  const loop = n >= 4;

  const narrow = box.w < 640;
  // Height of the active poster: up to 75% of the stage and 530px; the widest poster never takes
  // more than half the width (72% on phones). It doesn't depend on which poster is active.
  const widest = Math.max(DEFAULT_RATIO, ...ratios);
  const big = Math.max(180, Math.min(box.h * 0.75, 530, (box.w * (narrow ? 0.72 : 0.5)) / widest));
  // Size steps down with distance from the active poster.
  const STEPS = useMemo(() => (narrow ? [1, 0.42, 0.34, 0.28] : [1, 0.46, 0.36, 0.3]), [narrow]);
  const GAP = narrow ? 4 : 6;
  const top = (box.h - big) / 2;
  const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : DEFAULT_RATIO;
  const spacing = (big * avgRatio * (1 + STEPS[1])) / 2 + GAP; // px of drag per poster

  // Geometry lives in a ref so per-frame transforms always read the latest values;
  // `geoVersion` nudges every card to recompute when the layout itself changes (resize, uploads).
  const geo = useRef({ big, GAP, STEPS, ratios, n, cx: box.w / 2 });
  geo.current = { big, GAP, STEPS, ratios, n, cx: box.w / 2 };
  const geoVersion = useMotionValue(0);
  useEffect(() => { geoVersion.set(geoVersion.get() + 1); }, [big, GAP, STEPS, ratios, n, box.w, geoVersion]);

  // ---------- motion ----------
  const reduce = useReducedMotion();
  const spring = useCallback((velocity = 0): Transition => (reduce
    ? { duration: 0 }
    : { type: 'spring', stiffness: 210, damping: 30, mass: 1, velocity }), [reduce]);

  // One value drives the whole strip: the (fractional) position in the ring.
  const pos = useMotionValue(0);
  const [activeV, setActiveV] = useState(0);
  useMotionValueEvent(pos, 'change', (v) => {
    const r = Math.round(v);
    setActiveV((a) => (a === r ? a : r));
  });
  const activeI = n ? mod(activeV, n) : 0;
  const activeId = items[activeI];

  const anim = useRef<AnimationPlaybackControls | null>(null);
  const target = useRef<number | null>(null);
  const clampV = useCallback((v: number) => (loop ? v : Math.min(n - 1, Math.max(0, v))), [loop, n]);
  const goTo = useCallback((v: number, velocity = 0) => {
    const t = clampV(v);
    target.current = t;
    anim.current?.stop();
    anim.current = animate(pos, t, { ...spring(velocity), onComplete: () => { target.current = null; } });
  }, [clampV, pos, spring]);
  const step = useCallback((d: number) => {
    if (!n) return;
    goTo((target.current ?? Math.round(pos.get())) + d);
  }, [goTo, n, pos]);
  // Move to item `i` by the shortest way round the ring.
  const goToItem = useCallback((i: number, instant = false) => {
    if (!n || i < 0) return;
    const base = Math.round(pos.get());
    let d = mod(i - mod(base, n), n);
    if (loop && d > n / 2) d -= n;
    const v = loop ? base + d : i;
    if (instant) { anim.current?.stop(); target.current = null; pos.jump(v); setActiveV(v); }
    else goTo(v);
  }, [goTo, loop, n, pos]);

  // Keep the same poster in front when the list changes; then move to a just-uploaded one.
  const prevItems = useRef(items);
  useEffect(() => {
    const before = prevItems.current;
    prevItems.current = items;
    if (before === items) return;
    const was = before[mod(Math.round(pos.get()), Math.max(1, before.length))];
    const keep = items.indexOf(was);
    goToItem(keep >= 0 ? keep : Math.min(mod(Math.round(pos.get()), Math.max(1, before.length)), items.length - 1), true);
    if (pendingSelect.current) {
      const i = items.indexOf(pendingSelect.current);
      pendingSelect.current = null;
      if (i >= 0) requestAnimationFrame(() => goToItem(i));
    }
  }, [items, goToItem, pos]);

  // Drag / swipe
  const dragged = useRef(false);
  const panStart = useRef(0);
  const soft = (v: number) => (loop ? v : Math.min(n - 1 + 0.35, Math.max(-0.35, v)));
  const onPanStart = () => { anim.current?.stop(); target.current = null; panStart.current = pos.get(); dragged.current = true; };
  const onPan = (_: PointerEvent, info: PanInfo) => pos.set(soft(panStart.current - info.offset.x / spacing));
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    const v = -info.velocity.x / spacing; // posters per second
    goTo(Math.round(pos.get() + v * 0.2), v);
    setTimeout(() => (dragged.current = false), 0);
  };

  // Scrolling (wheel or trackpad, either direction) moves exactly one poster per gesture.
  // A trackpad swipe keeps sending fading "momentum" events for up to a second or two, so after a
  // step the strip stays locked until those events stop, or until they suddenly get stronger
  // again (a new swipe started during the old one's momentum).
  const stripRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = stripRef.current;
    if (!el || view !== 'strip') return;
    let acc = 0, locked = false, lastEvent = 0, lastMag = 0, lastStep = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // also stops the browser's swipe-to-go-back
      const now = performance.now();
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 40 : 1);
      const mag = Math.abs(d);
      const gap = now - lastEvent;

      if (gap > 160) { locked = false; acc = 0; }                         // the previous gesture ended
      else if (locked && mag > lastMag * 1.6 && mag > 12) locked = false;  // a fresh swipe on top of momentum
      lastEvent = now; lastMag = mag;
      if (locked || !d) return;

      // A mouse wheel sends separate notches; allow one poster per notch, but not faster than 220ms.
      const notch = e.deltaMode === 1 || (gap > 60 && mag >= 100 && Number.isInteger(d));
      if (notch) {
        if (now - lastStep < 220) return;
        step(d > 0 ? 1 : -1); lastStep = now; acc = 0;
        return;
      }

      acc += d;
      if (Math.abs(acc) < 24) return;
      step(acc > 0 ? 1 : -1);
      lastStep = now; acc = 0; locked = true;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view, step]);

  // ---------- lightbox ----------
  const [lb, setLb] = useState<{ i: number; from: DOMRect | null; lowSizes: string } | null>(null);
  const openLightbox = (p: Poster, el: Element | null, lowSizes: string) =>
    setLb({ i: posters.indexOf(p), from: el?.getBoundingClientRect() ?? null, lowSizes });
  // Closing brings the strip to the poster that was last shown.
  const closeLightbox = useCallback(() => {
    if (lb && view === 'strip') goToItem(items.indexOf(posters[lb.i]?.url));
    setLb(null);
  }, [lb, view, goToItem, items, posters]);
  const navLightbox = useCallback((d: number) => {
    setLb((cur) => (cur && posters.length ? { ...cur, i: mod(cur.i + d, posters.length), from: null } : cur));
  }, [posters.length]);

  // ---------- drag-and-drop files, paste, keyboard ----------
  useEffect(() => {
    const over = (e: DragEvent) => { e.preventDefault(); if (admin && e.dataTransfer?.types.includes('Files')) setDrag(true); };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDrag(false); };
    const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles([...(e.dataTransfer?.files ?? [])]); };
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])].map((i) => i.getAsFile()).filter((f): f is File => !!f);
      if (files.length) addFiles(files);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (lb) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') navLightbox(1);
        if (e.key === 'ArrowLeft') navLightbox(-1);
        return;
      }
      if (view !== 'strip') return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop); window.addEventListener('paste', paste); window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop); window.removeEventListener('paste', paste); window.removeEventListener('keydown', key);
    };
  }, [admin, addFiles, step, view, lb, closeLightbox, navLightbox]);

  // ---------- render ----------
  const poster = byUrl.get(activeId ?? '');
  const ready = box.w > 0;

  // Only the cards that can be on screen are mounted.
  const minW = big * Math.min(DEFAULT_RATIO, ...ratios) * STEPS[STEPS.length - 1] + GAP;
  const K = Math.min(14, Math.ceil(box.w / 2 / Math.max(40, minW)) + 2);
  const windowV: number[] = [];
  if (n) for (let v = activeV - K; v <= activeV + K; v++) if (loop || (v >= 0 && v < n)) windowV.push(v);

  // Masonry in reading order: each tile goes into the currently shortest column.
  const colCount = box.w < 640 ? 2 : box.w < 1000 ? 3 : 4;
  const columns = useMemo(() => {
    const cols: { tiles: (Poster | 'add')[]; h: number }[] = Array.from({ length: colCount }, () => ({ tiles: [], h: 0 }));
    const tiles: (Poster | 'add')[] = [...posters, ...(admin ? ['add' as const] : [])];
    tiles.forEach((t) => {
      const col = cols.reduce((a, c) => (c.h < a.h ? c : a));
      col.tiles.push(t);
      col.h += (t === 'add' ? 1 / DEFAULT_RATIO : 1 / ratioOf(t)) + 0.12; // + caption
    });
    return cols;
  }, [posters, admin, colCount]);

  return (
    <div className="app" style={{ ['--bottom-h' as string]: `${bottomH}px` }}>
      <header className="top">
        <a href={PORTFOLIO_URL} className="logo" aria-label="Jaine Shin — portfolio">
          <motion.div className="logo-mark"
            initial={{ scale: 0.9 }}
            animate={reduce ? { rotate: 0, scale: 0.9 } : {
              rotate: [0, 45, 90, 135, 180, 225, 270, 315, 360],
              scale: [0.9, 0.95, 0.9, 0.95, 0.9, 0.95, 0.9, 0.95, 0.9],
            }}
            transition={{
              repeat: Infinity,
              duration: 40,
              ease: 'linear',
              times: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
              scale: { repeat: Infinity, duration: 4, ease: 'backInOut' },
            }}
            whileHover={{ scale: 1, rotate: 15, transition: { type: 'spring', stiffness: 100, damping: 10 } }}>
            <Image src="/images/logo-white.svg" alt="Jaine Shin Logo" fill priority draggable={false} />
          </motion.div>
        </a>
        <div className="seg view-toggle" role="group" aria-label="Layout">
          <button aria-pressed={view === 'strip'} onClick={() => setView('strip')} aria-label="Strip view">
            <span>Strip</span>
          </button>
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view">
            <span>Grid</span>
          </button>
        </div>
      </header>

      <div className="view" ref={stageRef}>
        <AnimatePresence mode="wait" initial={false}>
          {view === 'strip' ? (
            <motion.main key="strip" ref={stripRef} className="stage" onPanStart={onPanStart} onPan={onPan} onPanEnd={onPanEnd}
              aria-roledescription="carousel" aria-label="Posters"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.22 }}>
              {ready && n === 0 && (
                <div className="card mockup is-active" style={{ left: box.w / 2 - (big * DEFAULT_RATIO) / 2, top, width: big * DEFAULT_RATIO, height: big }}>
                  <div className="empty"><strong>Mockup</strong><span>No posters yet</span></div>
                </div>
              )}
              {ready && windowV.map((v) => {
                const id = items[mod(v, n)];
                const p = byUrl.get(id);
                const active = v === activeV;
                const w = big * ratioOf(p);
                const sizes = `${Math.round(w)}px`;
                return (
                  <StripCard key={v} v={v} pos={pos} geo={geo} geoVersion={geoVersion}
                    width={w} height={big} top={top}
                    className={`card ${p ? 'mockup' : 'add-card'}${active ? ' is-active' : ''}${active && drag ? ' drag' : ''}`}
                    onSelect={(el) => {
                      if (dragged.current) return;
                      if (!active) goTo(v);
                      else if (p) openLightbox(p, el, sizes);
                      else fileRef.current?.click();
                    }}>
                    {p ? (
                      <Image src={p.url} alt={active ? p.name : ''} fill draggable={false} sizes={sizes} quality={75}
                        loading={Math.abs(v - activeV) <= 4 ? 'eager' : 'lazy'} unoptimized={p.url.endsWith('.gif')} />
                    ) : (
                      <button className="empty" tabIndex={active ? 0 : -1} disabled={busy}>
                        <strong>{busy ? 'Uploading…' : '+ Add posters'}</strong>
                        <span>Drop images here or click</span>
                      </button>
                    )}
                  </StripCard>
                );
              })}
            </motion.main>
          ) : (
            <motion.section key="grid" className="grid-view" aria-label="All posters"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}>
              <div className="masonry" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                {columns.map((col, ci) => (
                  <div className="masonry-col" key={ci}>
                    {col.tiles.map((t) => t === 'add' ? (
                      <figure className="grid-item" key="add">
                        <button className="grid-thumb add-tile" disabled={busy} onClick={() => fileRef.current?.click()} style={{ aspectRatio: '9 / 11' }}>
                          <span className="empty"><strong>{busy ? 'Uploading…' : '+ Add posters'}</strong><span>Drop images here or click</span></span>
                        </button>
                      </figure>
                    ) : (
                      <motion.figure key={t.url} className="grid-item"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: Math.min(posters.indexOf(t), 12) * 0.03 }}>
                        <button className="grid-thumb" onClick={(e) => openLightbox(t, e.currentTarget, GRID_SIZES)}
                          aria-label={`Enlarge ${t.name}`} style={{ aspectRatio: `${t.pw || 9} / ${t.ph || 11}` }}>
                          <Image src={t.url} alt="" fill sizes={GRID_SIZES} quality={75} unoptimized={t.url.endsWith('.gif')} />
                        </button>
                        <figcaption>{t.name}</figcaption>
                      </motion.figure>
                    ))}
                  </div>
                ))}
              </div>
              {!admin && posters.length === 0 && <p className="grid-empty">No posters yet</p>}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Soft, progressively stronger blur where the grid scrolls under the toggle and the footer. */}
        <AnimatePresence>
          {view === 'grid' && (
            <motion.div key="edges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }} aria-hidden>
              <div className="edge-blur edge-top"><span /><span /><span /><span /><span /></div>
              <div className="edge-blur edge-bottom"><span /><span /><span /><span /><span /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bottom" ref={bottomRef}>
      <div className="meta">
        {view === 'strip' && poster && (
          <>
            <span className="name">{poster.name}</span>
            {poster.pw > 0 && <span>{poster.pw}×{poster.ph}px</span>}
            {admin && (
              <button className={`btn btn-xs ${armed === poster.url ? 'btn-danger' : 'btn-text'}`} onClick={() => remove(poster)}>
                {armed === poster.url ? 'Click again to remove' : 'Remove'}
              </button>
            )}
          </>
        )}
      </div>

      <footer className="foot">
        <p className={`status${status.err ? ' err' : ''}`} role="status">{status.msg}</p>
        <div className="right">
          {posters.length > 0 && <span className="data">{poster ? posters.indexOf(poster) + 1 : '–'} / {posters.length}</span>}
          {admin ? (
            <button className="btn btn-text btn-xs" onClick={logout}>Log out</button>
          ) : loginOpen ? (
            <form className="login" onSubmit={login}>
              <input id="pw" type="password" autoFocus autoComplete="current-password" placeholder="Admin password"
                aria-label="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-xs" disabled={!password}>Log in</button>
              <button type="button" className="btn btn-text btn-xs" onClick={() => setLoginOpen(false)}>Cancel</button>
            </form>
          ) : (
            <button className="btn btn-text btn-xs" onClick={() => setLoginOpen(true)}>Admin</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden
          onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </footer>
      </div>

      <AnimatePresence>
        {lb && posters[lb.i] && (
          <Lightbox key="lightbox" posters={posters} index={lb.i} from={lb.from} lowSizes={lb.lowSizes}
            onClose={closeLightbox} reduce={!!reduce} />
        )}
      </AnimatePresence>
    </div>
  );
}

const GRID_SIZES = '(max-width: 640px) 50vw, 260px';

// ---------- one card in the strip ----------
// Every card reads the shared `pos` value and works out its own place and size each frame,
// so the whole ring moves as one on a single spring. Cards are drawn at full size and only
// transformed (translate + scale), so nothing is laid out again while it moves.
type Geo = { big: number; GAP: number; STEPS: number[]; ratios: number[]; n: number; cx: number };

function centreAndScale(v: number, a: number, g: Geo) {
  const scaleAt = (d: number) => g.STEPS[Math.min(Math.abs(d), g.STEPS.length - 1)];
  const width = (j: number) => g.big * g.ratios[mod(j, g.n)] * scaleAt(j - a);
  const s = scaleAt(v - a);
  if (v === a) return { c: 0, s };
  const dir = v > a ? 1 : -1;
  let c = width(a) / 2 + g.GAP;
  for (let j = a + dir; j !== v; j += dir) c += width(j) + g.GAP;
  c += width(v) / 2;
  return { c: c * dir, s };
}

function StripCard({ v, pos, geo, geoVersion, width, height, top, className, onSelect, children }: {
  v: number; pos: MotionValue<number>; geo: React.RefObject<Geo>; geoVersion: MotionValue<number>;
  width: number; height: number; top: number; className: string;
  onSelect: (el: HTMLElement) => void; children: React.ReactNode;
}) {
  // Blend between the layouts for the two nearest whole positions.
  const frame = () => {
    geoVersion.get();
    const g = geo.current;
    const p = pos.get();
    const f = Math.floor(p), t = p - f;
    const A = centreAndScale(v, f, g), B = centreAndScale(v, f + 1, g);
    return { c: A.c + (B.c - A.c) * t, s: A.s + (B.s - A.s) * t, cx: g.cx };
  };
  const x = useTransform(() => { const r = frame(); return r.cx + r.c - width / 2; });
  const scale = useTransform(() => frame().s);

  return (
    <motion.div className={className} onClick={(e) => onSelect(e.currentTarget)}
      style={{ x, scale, top, width, height }}>
      {children}
    </motion.div>
  );
}

// ---------- lightbox ----------
// Opens from the clicked poster's own spot, then loads a sharper copy on top.
function Lightbox({ posters, index, from, lowSizes, onClose, reduce }: {
  posters: Poster[]; index: number; from: DOMRect | null; lowSizes: string; onClose: () => void; reduce: boolean;
}) {
  const p = posters[index];
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const [sharp, setSharp] = useState<Record<string, boolean>>({});
  const firstUrl = useRef(p.url);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const pad = vp.w < 640 ? 12 : 40;
  const cap = 48;
  const r = ratioOf(p);
  const maxW = vp.w - pad * 2, maxH = vp.h - pad * 2 - cap;
  const h = Math.max(100, Math.min(maxH, maxW / r)), w = h * r;
  const cy = pad + maxH / 2; // centre of the image area

  const fromFirst = p.url === firstUrl.current && from;
  const spring: Transition = reduce ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 32 };

  return (
    <motion.div className="lightbox" role="dialog" aria-modal="true" aria-label={p.name}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}
      onClick={onClose}>
      <AnimatePresence initial={!!fromFirst}>
        <motion.div key={p.url} className="lb-frame"
          style={{ width: w, height: h, left: vp.w / 2 - w / 2, top: cy - h / 2 }}
          initial={fromFirst
            ? { x: from.left + from.width / 2 - vp.w / 2, y: from.top + from.height / 2 - cy, scale: from.width / w }
            : { opacity: 0, scale: 0.97 }}
          animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: reduce ? 0 : 0.15 } }}
          transition={spring}>
          <Image src={p.url} alt="" fill sizes={fromFirst ? lowSizes : GRID_SIZES} quality={75} unoptimized={p.url.endsWith('.gif')} />
          <Image src={p.url} alt={p.name} fill sizes={`${Math.round(w)}px`} quality={75} unoptimized={p.url.endsWith('.gif')}
            className={sharp[p.url] ? 'is-sharp' : ''} onLoad={() => setSharp((s) => ({ ...s, [p.url]: true }))} />
        </motion.div>
      </AnimatePresence>

      <div className="lb-caption" onClick={(e) => e.stopPropagation()}>
        <span className="name">{p.name}</span>
        {p.pw > 0 && <span className="data">{p.pw}×{p.ph}px</span>}
        <span className="data">{index + 1} / {posters.length}</span>
        <a className="btn btn-text btn-xs" href={p.url} target="_blank" rel="noopener noreferrer">Open original ↗</a>
      </div>
      <button ref={closeRef} className="btn btn-icon btn-sm lb-close" aria-label="Close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2l10 10M12 2L2 12" /></svg>
      </button>
    </motion.div>
  );
}