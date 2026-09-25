"use client";

import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import Constellation, { type Palette } from "./Constellation";
import styles from "./HeroCanvas.module.css";

/* Sampled from the same tokens the rest of the page uses, rather than invented.
   WebGL cannot read CSS custom properties, so these are the one place in the
   codebase where token values are duplicated — keep them in step with
   src/themes/light/theme.css if the palette moves. */
const PALETTE: Palette = {
    dust: "#8c9491", // --ink-3
    node: "#2e7d4f", // --signal
    edge: "#5c6664", // --ink-2
    fog: "#eff1ee", // --bg
};

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
    const scrollRef = useScrollProgress();
    const palette = PALETTE;

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
                    points stop competing with the type. */}
                <fogExp2 attach="fog" args={[palette.fog, 0.022]} />

                <Constellation scrollRef={scrollRef} palette={palette} />
            </Canvas>
        </div>
    );
}
