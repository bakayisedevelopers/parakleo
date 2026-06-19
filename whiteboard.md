Please implement the replacement of the current Excalidraw whiteboard with a custom React tutoring canvas.

Important:

- Do not change the session/request lifecycle.
- Do not change the student screen-share flow.
- Do not change how `boardPreparationSource` is created.
- Preserve the current tutor-only whiteboard behavior.
- Replace Excalidraw only.
- Keep the implementation simple, stable, and MVP-focused.

Current implementation summary:

- Excalidraw is currently in `web/src/components/app/TldrawSdkEmbed.jsx`.
- It is rendered in `web/src/pages/app/SessionRoomPage.jsx` using:
``
- The current board content comes from `boardPreparationSource` on session/request.
- Questions/images are parsed and laid out in `SessionRoomPage.jsx` and `whiteboardPreparationService.js`.
- Current persistence is localStorage only with key:
`parakleo-excalidraw-${roomId}`
- Students do not directly access the board. They only see the tutor’s screen share.
- There is no real-time Firestore whiteboard sync yet.

Goal:
Replace Excalidraw with a custom React tutoring canvas built from:

1. Normal React-rendered content layer
2. SVG drawing layer
3. Simple toolbar
4. localStorage persistence

The new canvas should support:

- React-rendered question text
- React-rendered images
- Future math rendering with KaTeX/MathJax
- Pen tool
- Eraser tool
- Pen color
- Pen size
- Eraser size
- Select/move mode for content blocks
- Editable text blocks if practical for MVP
- Clear ink button
- Undo for ink strokes if practical
- Existing `roomId` prop
- Existing `onMount` callback pattern

Implementation requirements:

## 1. Replace `TldrawSdkEmbed.jsx`
Replace the contents of:

`web/src/components/app/TldrawSdkEmbed.jsx`

with a custom React component, but keep the same exported component name so `SessionRoomPage.jsx` does not need a full route rewrite.

The component should accept:

```

```
Internally, build:

```
TutorCanvas
 ├─ toolbar
 ├─ scrollable/zoomable canvas area
 ├─ React content layer
 ├─ SVG ink layer
 └─ optional selection layer
```

## 2. Expose a simple board API through `onMount`
When mounted, call `onMount(api)` with an API object like:

```
{
  setSceneElements(elements) {},
  getSceneElements() {},
  clearInk() {},
  refresh() {},
}
```
This preserves the current pattern where `SessionRoomPage.jsx` injects prepared board content.

`setSceneElements(elements)` should accept the prepared layout elements from `SessionRoomPage.jsx`.

If existing code still calls `editor.setSceneElements(...)`, support that method name.

## 3. Element model
Create a simple internal element model that supports:

```
{
  id: string,
  type: "text" | "image",
  x: number,
  y: number,
  width: number,
  height: number,
  text?: string,
  src?: string,
  fileName?: string,
  mimeType?: string,
  questionId?: string,
  pageNumber?: number,
}
```
Render:

- `type: "text"` as a movable React block.
- `type: "image"` as a movable React image block.

For text blocks:

- Use normal React rendering.
- Preserve line breaks.
- Make text not selectable while pen/eraser is active.
- Make text selectable/editable only in select mode if practical.
- Do not render math yet unless KaTeX is already available. Add a clean placeholder/helper where KaTeX can be added later.

For image blocks:

- Render with normal ``.
- Use `object-fit: contain`.
- Respect width/height.
- Show a fallback box if image fails.

## 4. SVG ink layer
Implement drawing using SVG paths.

Ink stroke model:

```
{
  id: string,
  tool: "pen" | "highlighter",
  color: string,
  size: number,
  points: [{ x: number, y: number }],
}
```
Use pointer events:

- pointerdown starts stroke
- pointermove appends points
- pointerup ends stroke

Render strokes as SVG ``.

Use:

- `strokeLinecap="round"`
- `strokeLinejoin="round"`
- `fill="none"`

## 5. Eraser
For MVP, implement eraser by stroke hit-testing:

- When eraser is active and pointer moves, remove any stroke whose path points are within eraser radius.
- Do not try to partially erase strokes yet.
- Eraser size should be configurable.

## 6. Toolbar
Add a simple toolbar inside `TldrawSdkEmbed.jsx` with:

- Select
- Pen
- Eraser
- Text
- Clear ink
- Color input
- Pen size input/range
- Eraser size input/range

Keep styling lightweight and consistent with the current app.

## 7. Select/move mode
When select mode is active:

- Content blocks can be dragged.
- Pen drawing should be disabled.
- Text and image blocks should be movable.
- Save updated positions to localStorage.

When pen/eraser mode is active:

- Content blocks should not intercept drawing.
- Drawing should work on top of text/images.

## 8. Text tool
If practical, implement a simple text tool:

- Click on canvas creates a new editable text block.
- Text block can be edited in select mode.
- Text block is saved with other elements.

If this creates risk, add a clear TODO and keep the implementation stable.

## 9. localStorage persistence
Use a new key:

```
parakleo-tutoring-canvas-${roomId}
```
Persist:

```
{
  elements,
  strokes,
  viewport,
  updatedAt
}
```
Also attempt to read old Excalidraw key only for safety:

```
parakleo-excalidraw-${roomId}
```
Do not try to fully migrate Excalidraw data. Just avoid crashing if it exists.

Save changes with debounce, not on every pointer move if possible.

## 10. Update `SessionRoomPage.jsx`
Update only what is necessary.

Replace Excalidraw-specific mapping with a custom canvas mapping.

Current functions to inspect/adapt:

- `createExcalidrawTextElement`
- `mapLayoutToExcalidrawElements`
- `handleBoardMount`
- `injectPreparedBoardContent`

Create or replace with functions like:

```
createTutoringCanvasTextElement(...)
createTutoringCanvasImageElement(...)
mapLayoutToTutoringCanvasElements(...)
```
The output should match the custom element model.

Keep:

- `getSessionBoardSeedContent()`
- `parseQuestionsFromGptExtraction()`
- `parseQuestionsFromExtraction()`
- `prepareWhiteboardLayout()`
- PDF/image extraction flow
- session/request data loading

## 11. Update `whiteboardPreparationService.js`
Keep the existing layout logic as much as possible.

Only change it if needed so it returns neutral layout elements like:

- text blocks
- image blocks
- x/y/width/height
- question metadata

Avoid Excalidraw-specific fields.

## 12. Package cleanup
Remove Excalidraw only if the app compiles successfully without it.

From `web/package.json`, remove:

- `@excalidraw/excalidraw`

Do not add heavy dependencies yet.

Do not add KaTeX yet unless already installed.

## 13. Testing checklist
After implementation, verify:

1. App compiles.
2. `/app/sessions/:id` loads.
3. Tutor sees custom tutoring canvas.
4. Student view is unchanged.
5. Existing questions render as React text blocks.
6. Existing images render as normal images.
7. Pen draws on top of text/images.
8. Eraser removes full strokes.
9. Select mode moves text/image blocks.
10. Refreshing page restores content and strokes from localStorage.
11. No crash when old `parakleo-excalidraw-${roomId}` data exists.
12. No changes to request/session creation.
13. No changes to screen sharing.

## 14. Very important constraints

- Keep the MVP simple.
- Avoid overengineering.
- Do not build real-time collaboration yet.
- Do not change Firestore schema yet.
- Do not change backend functions unless absolutely necessary.
- Do not change student-facing session behavior.
- Prefer one stable component over many abstractions.
- Add comments where future Firestore sync, KaTeX, image upload, and crop/paste support can be added.

Please implement the replacement and then give me:

1. Files changed
2. What was removed
3. What was added
4. Any known limitations
5. Manual test steps