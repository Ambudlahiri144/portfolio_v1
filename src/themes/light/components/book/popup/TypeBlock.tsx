"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type * as THREE from "three";

/* ==================================================================
   TYPE BLOCK — one piece of maple type, its word cut in the face.

   The projects' letterpress (Letterpress.tsx) sets each project's stack
   in these, and the book's last scene lays its way-back buttons on the
   table in front of the cat in the very same blocks (end/EndScene.tsx).
   Units are centimetres; the word is on the +z face, toward the camera.
   ================================================================== */

export const FONT = "/book/fonts/plexmono-500.ttf";
export const TYPE_SIZE = 0.56;
export const BLOCK_H = 1.05;
export const BLOCK_D = 1.3;

/* A block just wide enough for its word. */
export const widthOf = (name: string) => 0.8 + name.length * TYPE_SIZE * 0.6;

/* One rounded body per block width, shared by every block of that width
   (and by the sinking copy of a block as it leaves). drei's RoundedBox
   built and creased a fresh geometry per block, and a project's type
   landing all at once spent ~130 ms of one frame doing it. */
const bodies = new Map<number, THREE.BufferGeometry>();
export function bodyFor(w: number) {
    let g = bodies.get(w);
    if (!g) {
        g = new RoundedBoxGeometry(w, BLOCK_H, BLOCK_D, 3, 0.12);
        bodies.set(w, g);
    }
    return g;
}

export function Block({
    name,
    w,
    texture,
    pressed,
    characters,
}: {
    name: string;
    w: number;
    texture: THREE.Texture;
    pressed: boolean;
    characters?: string;
}) {
    const body = useMemo(() => bodyFor(w), [w]);
    return (
        <>
            <mesh geometry={body} castShadow receiveShadow>
                <meshStandardMaterial map={texture} color={pressed ? "#f6d9ad" : "#ffffff"} roughness={0.78} />
            </mesh>
            <Text
                font={FONT}
                characters={characters}
                fontSize={TYPE_SIZE}
                color="#3a2618"
                anchorX="center"
                anchorY="middle"
                position={[0, 0, BLOCK_D / 2 + 0.012]}
            >
                {name}
            </Text>
        </>
    );
}
