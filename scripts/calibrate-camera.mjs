#!/usr/bin/env node
/* ==================================================================
   CALIBRATE CAMERA — solves the 3D camera that took the front rest.

     node scripts/calibrate-camera.mjs
     node scripts/calibrate-camera.mjs --fov 34.5 --dy -0.4   # hand-tune

   The pop-up scene draws real 3D paper onto a photograph, so its camera
   has to be the photograph's camera. Four points on a plane of known
   size are enough to recover it:

   1. The flat top of the page block, marked in the front rest frame
      (geometry.front.pageQuad in scripts/book-frames.mjs), and its real
      size (geometry.front.spreadCm).
   2. A homography from that plane (in cm) to the image.
   3. With square pixels and the principal point at the image centre,
      the homography's two rotation columns must be orthogonal and of
      equal length — which pins the focal length.
   4. Decompose into rotation and translation, then convert OpenCV's
      camera (looks down +z, y down) into three.js's (looks down -z, y up).

   World space, in centimetres: the page plane is y = 0, the spine runs
   along x = 0, +x is the right-hand page, +z comes toward the camera.

   Writes `camera` into public/book/manifest.json. Fine adjustments
   (--fov degrees, --dx/--dy/--dz cm, --pitch degrees) are applied on top
   of the solve, for when the ?calibrate=3d overlay shows a small offset.
   ================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST = join(ROOT, "public/book/manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const { width: W, height: H } = manifest;
const { pageQuad, spreadCm } = manifest.geometry.front;

const arg = (name, fallback = 0) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(process.argv[i + 1]);
};

/* ---- small linear algebra ------------------------------------------ */

function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        [M[c], M[p]] = [M[p], M[c]];
        for (let r = 0; r < n; r++) {
            if (r === c) continue;
            const f = M[r][c] / M[c][c];
            for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));
const scale = (a, k) => a.map((v) => v * k);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ---- 1. plane points (cm) and image points (centred px) ------------ */

const [sw, sd] = spreadCm;
/* Same order as pageQuad: far-left, far-right, near-right, near-left. */
const plane = [
    [-sw / 2, -sd / 2],
    [sw / 2, -sd / 2],
    [sw / 2, sd / 2],
    [-sw / 2, sd / 2],
];
const cx = W / 2;
const cy = H / 2;
const img = pageQuad.map(([x, y]) => [x - cx, y - cy]);

/* ---- 2. homography (8 unknowns, h33 = 1) --------------------------- */

const A = [];
const b = [];
plane.forEach(([X, Z], i) => {
    const [u, v] = img[i];
    A.push([X, Z, 1, 0, 0, 0, -u * X, -u * Z]);
    b.push(u);
    A.push([0, 0, 0, X, Z, 1, -v * X, -v * Z]);
    b.push(v);
});
const h = solve(A, b);
const Hm = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
];
const col = (j) => [Hm[0][j], Hm[1][j], Hm[2][j]];
const h1 = col(0);
const h2 = col(1);
const h3 = col(2);

/* ---- 3. focal length from orthogonality (and equal norm) ------------ */

const fOrtho = -(h1[0] * h2[0] + h1[1] * h2[1]) / (h1[2] * h2[2]);
const fNorm = (h2[0] ** 2 + h2[1] ** 2 - h1[0] ** 2 - h1[1] ** 2) / (h1[2] ** 2 - h2[2] ** 2);
const candidates = [fOrtho, fNorm].filter((f2) => Number.isFinite(f2) && f2 > 0);
if (!candidates.length) {
    console.error("Could not solve a focal length from pageQuad; check the corner order.");
    process.exit(1);
}
const f = Math.sqrt(candidates.reduce((s, v) => s + v, 0) / candidates.length);

/* ---- 4. pose -------------------------------------------------------- */

const Kinv = (v) => [v[0] / f, v[1] / f, v[2]];
let r1 = Kinv(h1);
let r3 = Kinv(h2); /* plane Z maps to world Z */
const lambda = 1 / ((norm(r1) + norm(r3)) / 2);
r1 = scale(r1, lambda);
r3 = scale(r3, lambda);
let t = scale(Kinv(h3), lambda);
/* The camera must be in front of the plane. */
if (t[2] < 0) {
    r1 = scale(r1, -1);
    r3 = scale(r3, -1);
    t = scale(t, -1);
}
/* Y completes a right-handed frame: X x Y = Z  =>  Y = Z x X. */
let r2 = cross(r3, r1);
/* Re-orthogonalise (the four clicked corners are never perfect). */
r1 = scale(r1, 1 / norm(r1));
r2 = scale(r2, 1 / norm(r2));
r3 = cross(r1, r2);

/* R's columns are the world axes seen from the camera (OpenCV). */
const R = [
    [r1[0], r2[0], r3[0]],
    [r1[1], r2[1], r3[1]],
    [r1[2], r2[2], r3[2]],
];
const Rt = [0, 1, 2].map((i) => [0, 1, 2].map((j) => R[j][i]));
const C = scale([0, 1, 2].map((i) => dot(Rt[i], t)), -1); /* camera centre */

/* The camera's own axes in world space are R's ROWS (R maps world to
   camera). three.js looks down -z with y up, so its basis is OpenCV's
   x, -y, -z. */
const camX = R[0];
const camY = scale(R[1], -1);
const camZ = scale(R[2], -1);

/* The camera is above the table — flip world Y if the solve put it below. */
if (C[1] < 0) {
    console.error("Solve placed the camera below the page; the corner order is probably mirrored.");
    process.exit(1);
}

/* Rotation matrix (columns camX camY camZ) -> quaternion. */
function quat(m) {
    const [m00, m01, m02] = [m[0][0], m[0][1], m[0][2]];
    const [m10, m11, m12] = [m[1][0], m[1][1], m[1][2]];
    const [m20, m21, m22] = [m[2][0], m[2][1], m[2][2]];
    const tr = m00 + m11 + m22;
    if (tr > 0) {
        const s = 0.5 / Math.sqrt(tr + 1);
        return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
    }
    if (m00 > m11 && m00 > m22) {
        const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
    }
    if (m11 > m22) {
        const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
    }
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}
const basis = [0, 1, 2].map((i) => [camX[i], camY[i], camZ[i]]);
const q = quat(basis);

const fovDeg = (2 * Math.atan(H / 2 / f) * 180) / Math.PI;

/* ---- hand tuning, and reprojection error ---------------------------- */

const camera = {
    fov: +(fovDeg + arg("fov")).toFixed(3),
    position: [C[0] + arg("dx"), C[1] + arg("dy"), C[2] + arg("dz")].map((v) => +v.toFixed(3)),
    quaternion: q.map((v) => +v.toFixed(6)),
    /* Extra pitch applied at runtime, degrees, for hand tuning. */
    pitch: arg("pitch"),
    near: 1,
    far: 1000,
    unit: "cm",
    plane: { width: sw, depth: sd },
};

/* Project the plane corners back through the solved camera to report how
   far off each lands, in source pixels. */
function project([X, Z]) {
    const p = [X - C[0], 0 - C[1], Z - C[2]];
    const x = dot(camX, p);
    const y = dot(camY, p);
    const z = dot(camZ, p);
    const fy = H / 2 / Math.tan((fovDeg * Math.PI) / 360);
    return [cx + (fy * x) / -z, cy - (fy * y) / -z];
}
const err = plane.map((pt, i) => {
    const [px, py] = project(pt);
    return Math.hypot(px - pageQuad[i][0], py - pageQuad[i][1]);
});

manifest.camera = camera;
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

console.log(`focal ${f.toFixed(1)} px, vertical fov ${fovDeg.toFixed(2)} deg`);
console.log(`camera at (${camera.position.join(", ")}) cm, ${Math.hypot(...C).toFixed(1)} cm from the spine`);
console.log(`reprojection error per corner (px): ${err.map((e) => e.toFixed(2)).join(", ")}`);
