"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Image from "next/image";
import {
    SiExpress,
    SiDjango,
    SiFastapi,
    SiExpo,
    SiSocketdotio,
} from "react-icons/si";
import { FaAws } from "react-icons/fa";
import { tech, type TechId } from "@/lib/site";
import styles from "./Techglobe.module.css";

/* ── Custom PNG icons (served from /public) ────────────────────────── */
const PNG_ICONS: Record<string, string> = {
    react: "/react.png",
    nextjs: "/next.js.png",
    typescript: "/typescript.png",
    javascript: "/javascript.png",
    nodejs: "/nodejs.png",
    mongodb: "/mongodb.png",
    python: "/python.png",
    tailwind: "/tailwindcss.png",
    java: "/java.png",
    flutter: "/flutter.png",
    git: "/git.png",
    cpp: "/c++.png",
};

/* ── Fallback react-icons for techs without a PNG ──────────────────── */
const SVG_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    express: SiExpress,
    django: SiDjango,
    fastapi: SiFastapi,
    expo: SiExpo,
    socketio: SiSocketdotio,
    aws: FaAws,
};

/* ==================================================================
   GEOMETRY — all of this runs once at module load, never per frame.
   ================================================================== */

type Vec = { x: number; y: number; z: number };

const DEG = 180 / Math.PI;

/* Fibonacci sphere — scatters N points evenly without the pole crowding
   you get from a naive lat/lon grid. Deterministic, so server and client
   render identical markup. */
function spherePoints(n: number) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: n }, (_, i) => {
        const y = 1 - (i / (n - 1)) * 2;
        const theta = golden * i;
        return { lat: Math.asin(y) * DEG, lon: ((theta * DEG) % 360) };
    });
}

/* Must match the pin transform exactly:
   rotateY(lon) rotateX(-lat) translateZ(r)  →  this unit vector. */
function toVec({ lat, lon }: { lat: number; lon: number }): Vec {
    const p = lat / DEG;
    const l = lon / DEG;
    return {
        x: Math.cos(p) * Math.sin(l),
        y: Math.sin(p),
        z: Math.cos(p) * Math.cos(l),
    };
}

/* A line is a 1px bar translated to the chord's midpoint and rotated so
   its local +X axis points along the chord. Solving
   rotateY(a)·rotateZ(b)·(1,0,0) = direction gives b = asin(dy/len) and
   a = atan2(-dz, dx). */
function makeLink(a: Vec, b: Vec, ai: number, bi: number) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    return {
        key: `${ai}-${bi}`,
        ai,
        bi,
        len,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        mz: (a.z + b.z) / 2,
        rotY: Math.atan2(-dz, dx) * DEG,
        rotZ: Math.asin(dy / len) * DEG,
    };
}

/* Connect every node to its k nearest neighbours, deduped. Produces a
   constellation mesh rather than a hairball. */
function buildLinks(points: Vec[], k = 2) {
    const seen = new Set<string>();
    const links: ReturnType<typeof makeLink>[] = [];

    points.forEach((a, i) => {
        points
            .map((b, j) => ({ j, d: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) }))
            .filter((o) => o.j !== i)
            .sort((p, q) => p.d - q.d)
            .slice(0, k)
            .forEach(({ j }) => {
                const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (seen.has(key)) return;
                seen.add(key);
                links.push(makeLink(points[i], points[j], Math.min(i, j), Math.max(i, j)));
            });
    });

    return links;
}

const POINTS = spherePoints(tech.length);
const VECS = POINTS.map(toVec);
const LINKS = buildLinks(VECS);

/* ================================================================== */

export default function TechGlobe({ active }: { active: TechId[] }) {
    const stageRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState<string | null>(null);

    /* Drag offsets live in refs, not state. Writing them straight to CSS
       custom properties keeps React out of the pointermove path entirely —
       re-rendering 18 pins per pointer event was the main source of jank. */
    const dragX = useRef(0);
    const dragY = useRef(0);
    const last = useRef({ x: 0, y: 0 });

    function onPointerDown(e: PointerEvent<HTMLDivElement>) {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
        setDragging(true);
    }

    function onPointerMove(e: PointerEvent<HTMLDivElement>) {
        if (!dragging) return;
        const el = stageRef.current;
        if (!el) return;

        /* 0.45deg per pixel — roughly a full turn per screen width. */
        dragX.current += (e.clientX - last.current.x) * 0.45;
        /* Clamped so the globe can't be tipped past readable. */
        dragY.current = Math.max(
            -70,
            Math.min(70, dragY.current - (e.clientY - last.current.y) * 0.45),
        );
        last.current = { x: e.clientX, y: e.clientY };

        el.style.setProperty("--drag", String(dragX.current));
        el.style.setProperty("--dragY", String(dragY.current));
    }

    function endDrag(e: PointerEvent<HTMLDivElement>) {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setDragging(false);
    }

    const hasSelection = active.length > 0;
    const hotIndex = new Set(
        tech.map((t, i) => (active.includes(t.id as TechId) ? i : -1)),
    );

    const caption =
        hovered ?? "Drag to spin · select a role to highlight its stack";

    return (
        <div className={styles.shell}>
            <div
                ref={stageRef}
                className={styles.stage}
                data-dragging={dragging || undefined}
                style={{ "--drag": 0, "--dragY": 0 } as CSSProperties}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                role="img"
                aria-label={`Technology globe. ${hasSelection ? `Highlighted: ${active.join(", ")}.` : "No stack selected."
                    }`}
            >
                <span className={styles.halo} aria-hidden="true" />

                <div className={styles.tilt}>
                    <div className={styles.globe}>
                        {/* Constellation. Positions are fixed relative to the sphere,
                so these are computed once and then simply spin with it. */}
                        {LINKS.map((l) => (
                            <span
                                key={l.key}
                                className={styles.link}
                                data-hot={
                                    (hotIndex.has(l.ai) || hotIndex.has(l.bi)) || undefined
                                }
                                data-dim={
                                    (hasSelection && !hotIndex.has(l.ai) && !hotIndex.has(l.bi)) ||
                                    undefined
                                }
                                style={
                                    {
                                        "--len": l.len.toFixed(4),
                                        "--mx": l.mx.toFixed(4),
                                        "--my": l.my.toFixed(4),
                                        "--mz": l.mz.toFixed(4),
                                        "--ry": `${l.rotY.toFixed(2)}deg`,
                                        "--rz": `${l.rotZ.toFixed(2)}deg`,
                                    } as CSSProperties
                                }
                            />
                        ))}

                        {tech.map((t, i) => {
                            const { lat, lon } = POINTS[i];
                            const pngSrc = PNG_ICONS[t.id];
                            const SvgIcon = SVG_ICONS[t.id];
                            const hot = active.includes(t.id as TechId);

                            return (
                                <span
                                    key={t.id}
                                    className={styles.pin}
                                    data-hot={hot || undefined}
                                    data-dim={(hasSelection && !hot) || undefined}
                                    style={
                                        {
                                            "--lat": lat.toFixed(2),
                                            "--lon": lon.toFixed(2),
                                        } as CSSProperties
                                    }
                                >
                                    {/* face: undoes this pin's own placement + drag yaw
                      bb:   undoes the globe's spin
                      up:   undoes the tilt, innermost so it lands last
                      Together they cancel to identity, keeping each icon
                      square-on to the viewer. All pure transforms. */}
                                    <span className={styles.face}>
                                        <span className={styles.bb}>
                                            <span className={styles.up}>
                                                <span
                                                    className={styles.chip}
                                                    onPointerEnter={() => setHovered(t.label)}
                                                    onPointerLeave={() => setHovered(null)}
                                                >
                                                    {pngSrc ? (
                                                        <Image
                                                            src={pngSrc}
                                                            alt=""
                                                            width={36}
                                                            height={36}
                                                            className={styles.icon}
                                                            draggable={false}
                                                        />
                                                    ) : SvgIcon ? (
                                                        <SvgIcon className={styles.icon} />
                                                    ) : null}
                                                </span>
                                            </span>
                                        </span>
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Caption lives OUTSIDE the 3D scene. Text inside a perspective
          subtree gets rasterised at the wrong scale and comes out blurry —
          this renders at native resolution, so it stays crisp. */}
            <p className={styles.caption} data-name={hovered ? "" : undefined}>
                {caption}
            </p>
        </div>
    );
}