"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Constellation, { type Palette } from "./Constellation";
import styles from "./HeroCanvas.module.css";

/* Sampled from the same tokens the rest of the page uses, rather than invented.
   WebGL cannot read CSS custom properties, so these are the one place in the
   codebase where token values are duplicated — keep them in step with
   globals.css if the palette moves. */
const PALETTES: Record<"light" | "dark", Palette> = {
    light: {
        dust: "#8c9491", // --ink-3
        node: "#2e7d4f", // --signal
        edge: "#5c6664", // --ink-2
        fog: "#eff1ee", // --bg
    },
    dark: {
        dust: "#626c6a", // --ink-3
        node: "#4ade80", // --signal
        edge: "#98a2a0", // --ink-2
        fog: "#0a0c0d", // --bg
    },
};

/* The theme lives on a data attribute set by the blocking script in layout.tsx
   and flipped by ThemeToggle. Neither publishes an event, so observing the
   attribute is the only way to stay in sync without lifting theme into React. */
function useThemeName() {
    const [theme, setTheme] = useState<"light" | "dark">("dark");

    useEffect(() => {
        const root = document.documentElement;
        const read = () =>
            setTheme(root.dataset.theme === "light" ? "light" : "dark");

        read();
        const mo = new MutationObserver(read);
        mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
        return () => mo.disconnect();
    }, []);

    return theme;
}

/* Scroll progress through the hero, 0 at the top and 1 once it has scrolled a
   full viewport away. Written to a ref by a passive listener rather than to
   state — nothing in React needs to re-render when this changes, only the
   frame loop reads it. */
function useScrollProgress() {
    const progress = useRef(0);

    useEffect(() => {
        const read = () => {
            const span = window.innerHeight || 1;
            progress.current = Math.min(1, Math.max(0, window.scrollY / span));
        };

        read();
        window.addEventListener("scroll", read, { passive: true });
        window.addEventListener("resize", read, { passive: true });
        return () => {
            window.removeEventListener("scroll", read);
            window.removeEventListener("resize", read);
        };
    }, []);

    return progress;
}

export default function HeroCanvas({ active }: { active: boolean }) {
    const theme = useThemeName();
    const scrollRef = useScrollProgress();
    const palette = PALETTES[theme];

    return (
        <div className={styles.canvasWrap} aria-hidden="true">
            <Canvas
                /* Uncapped DPR is the usual cause of a scene that runs fine on a
                   laptop and crawls on a phone — a 3× display quadruples the
                   pixels being shaded. */
                dpr={[1, 1.75]}
                camera={{ position: [0, 0, 20], fov: 55, near: 0.1, far: 120 }}
                /* Suspended entirely when the hero is off screen. Browsers
                   already throttle rAF in a hidden tab, so that case is covered
                   by the platform. */
                frameloop={active ? "always" : "never"}
                gl={{
                    antialias: true,
                    powerPreference: "high-performance",
                    /* The page paints its own background behind this. */
                    alpha: true,
                }}
            >
                {/* Exponential fog fades the far edge of the field into the page
                    background, so the cloud has no visible boundary and distant
                    points stop competing with the type. Declared rather than set
                    in onCreated so it actually follows a theme swap — assigning
                    scene.fog once would leave the dark fog colour in place on a
                    flip to light. */}
                <fogExp2 attach="fog" args={[palette.fog, 0.022]} />

                <Constellation scrollRef={scrollRef} palette={palette} />
            </Canvas>
        </div>
    );
}
