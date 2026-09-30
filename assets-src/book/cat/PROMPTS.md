# The cat: what to generate

Everything here goes back into this folder (`assets-src/book/cat/`) under the file name given. Then run `node scripts/book-cat.mjs` (and, for the reveal, `node scripts/book-frames.mjs --only reveal`).

**The frames to upload** are all in `inputs/`:
- `rest-overhead.png`: the open book, seen from above.
- `rest-closed.png`: the closed book, seen from above.
- `pose-reference.png`: your photo of the curled cat.

**For every video:**
- 1280×720 or larger, 24 fps.
- The camera stays locked unless the prompt says it moves.
- No text, no logo, and no watermark if the tool lets you turn it off.
- "Both ends" means the image is given as the first frame **and** the last frame.

## 1. The cat herself (image, GPT-6 Astra)
`cat-reference.png`: a character sheet, used as the reference for everything else so she is always the same cat.

> Character reference sheet of one adult seal-point Siamese cat: slim, cream-coloured body, dark chocolate-brown points on the face mask, ears, paws and tail, bright blue almond eyes. Shown from the side, from the front and from directly above, on a plain warm-grey background. Photographic, soft even light.

## 2. The last scene's still (image, GPT-6 Astra)
`K-end.png`, 2560×1440. Upload `rest-closed.png`, `pose-reference.png` and `cat-reference.png`.

> The same linen-covered table and the same closed clothbound book (linen cover, dark brown leather spine and corners, a debossed label panel) as in the first image, now photographed from a low side angle like the cat photo: the camera a little above table height, looking across the table. The book lies flat on the table, left of centre and a little behind the cat. The Siamese cat from the reference sheet lies curled on the table to the right of the book, in the pose of the cat photo (body curled, front paws tucked forward, tail wrapped along its body), but awake: neck upright, head raised, eyes open, looking toward the camera. The whole cat is in frame. A strip of empty tablecloth runs across the foreground, and there is plain, uncluttered space at the upper left. Beyond the table, a softly out-of-focus warm room. Soft warm window light from the upper left. Photographic, shallow depth of field, no text.

## 3. The camera coming down (video, Omni Flash 1.1)
`V4.mp4`, 5–6 s. First frame `rest-closed.png`, last frame `K-end.png`.

> The camera moves smoothly down from directly above the closed book to a low side angle across the table. As it comes down, the Siamese cat lying curled on the table beside the book comes into view. Nothing in the scene moves except the camera; the cat stays still, looking at the camera.

## 4. The walk-by (video, Omni Flash 1.1)
`cat-walk.mp4`, 5 s. Both ends `rest-overhead.png`.

> Seen from directly above, camera locked. The Siamese cat walks into the frame at the top-right corner, walks calmly down along the tablecloth to the right of the open book, close to the right edge of the frame, and walks out at the bottom-right corner. The book, the ribbon and the tablecloth do not move. The frame is empty again at the end.

## 5. The peek (video, Omni Flash 1.1)
`cat-peek.mp4`, 5 s. Both ends `rest-overhead.png`.

> Seen from directly above, camera locked. The Siamese cat's head and front paws rise into view over the top-right corner of the frame, just beyond the open book. She looks down at the right-hand page curiously, tilts her head, then slowly withdraws back out of frame. Nothing else moves. The frame is empty again at the end.

## 6. Waiting (videos, Omni Flash 1.1)
Both ends `K-end.png`, 6 s each. Paste this first:

> Static locked camera, low side angle, identical framing to the first frame. A seal-point Siamese cat lies curled on a linen-covered table beside a closed clothbound book, head raised, awake. It stays lying curled the entire time and never stands up. Nothing else in the scene moves; no hand or person is visible. The clip ends in exactly the pose it began in.

| File | Then add |
|---|---|
| `cat-idle.mp4` | The cat breathes calmly and blinks slowly twice. |
| `cat-idle-look.mp4` | The cat breathes calmly, glances once to the side and back, and blinks. |

## 7. Reactions to petting (videos, Omni Flash 1.1)
Both ends `K-end.png`, 3–4 s each. Paste the paragraph from §6 first, then:

| File | Length | Clicked on | Then add |
|---|---|---|---|
| `react-pet-head.mp4` | 3.5 s | head | As if being stroked on the top of the head, the cat pushes its head gently upward and forward, eyes closing contentedly. It holds for a moment, then lowers its head back and opens its eyes. |
| `react-chin.mp4` | 3.5 s | cheek or chin | As if scratched under the chin, the cat lifts its chin and tilts its head back slightly, eyes half closed in pleasure, then brings its head back down and opens its eyes. |
| `react-ear.mp4` | 3 s | ear | The cat's nearer ear flicks twice quickly, then it gives a small quick shake of the head and settles, ears upright again. |
| `react-back.mp4` | 3.5 s | back | As if stroked along the back, the fur and skin along its back ripple in a wave from shoulders to hips. The cat shifts its body slightly on the table, then settles back into the same curl. |
| `react-tail.mp4` | 3 s | tail | The tail, wrapped along its body, lifts off the table, its tip wiggles and flicks back and forth playfully, then it lays the tail back down exactly where it was. |
| `react-paws.mp4` | 4 s | front paws | The cat stretches both front paws forward along the table, toes spreading wide, kneads the tablecloth twice, then draws its paws back and tucks them in as before. |
| `react-scratch.mp4` | 4 s | neck or shoulder | Still lying down, the cat brings a hind leg up and scratches the side of its neck with quick strokes, head tilted into it, then lowers the leg and tucks it back into the curl. |
| `react-yawn.mp4` | 3.5 s | face or muzzle | The cat opens its mouth in a wide, slow yawn, showing its pink tongue, eyes squeezing shut. It closes its mouth, gives one slow blink, and looks back at the camera. |
| `react-watch.mp4` | 3.5 s | plays by itself when the buttons land | The cat's attention is caught by something landing on the table just in front of it: it lowers its head a little and looks down toward the front of the table, ears forward, then looks back up at the camera. |

**If you make fewer:** the essential four are `react-pet-head`, `react-tail`, `react-scratch` and `react-yawn`.

## Check every clip before keeping it
- The first and last frames match the still: same pose, same place, eyes open.
- The camera doesn't drift or shake. The book and the tablecloth don't move.
- The cat never stands up, and stays roughly where she is in the still (a paw stretch or a tail lift going a little beyond is fine).
- There's no hand, no second cat, and no text.
- If it ends in a different pose, generate it again. A mismatch shows as a jump when it hands back to the waiting loop.
