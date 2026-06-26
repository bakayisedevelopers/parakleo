import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eraser,
  MousePointer2,
  Palette,
  Pencil,
  Trash2,
  Undo2,
  Minus,
  Plus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { debugError, debugLog } from '../../utils/devLogger';

const STORAGE_PREFIX = 'parakleo-tutoring-canvas-';
const LEGACY_STORAGE_PREFIX = 'parakleo-excalidraw-';
const TOOL_MODES = {
  SELECT: 'select',
  PEN: 'pen',
  ERASER: 'eraser',
};
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.6;
const BOARD_PADDING = 240;
const MIN_BOARD_WIDTH = 2200;
const MIN_BOARD_HEIGHT = 1600;
const GRID_SIZE = 56;
const DEFAULT_PEN_COLOR = '#0f172a';
const DEFAULT_PEN_SIZE = 4;
const DEFAULT_ERASER_SIZE = 28;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeTextValue(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}

function normalizeSceneElement(element, index = 0) {
  if (!element || typeof element !== 'object') return null;

  const type = String(element.type || '').toLowerCase();
  const id = String(element.id || `${type || 'block'}-${index + 1}`);
  const x = toNumber(element.x ?? element.position?.x, 0);
  const y = toNumber(element.y ?? element.position?.y, 0);
  const width = Math.max(40, toNumber(element.width, type === 'image' ? 320 : 600));
  const height = Math.max(32, toNumber(element.height, type === 'image' ? 220 : 120));

  if (type === 'text') {
    return {
      id,
      type: 'text',
      x,
      y,
      width,
      height,
      text: normalizeTextValue(element.text ?? element.content ?? ''),
      questionId: element.questionId ? String(element.questionId) : '',
      pageNumber: Number.isFinite(Number(element.pageNumber)) ? Number(element.pageNumber) : null,
    };
  }

  if (type === 'image') {
    const src = String(element.src || element.dataURL || element.dataUrl || element.storageUrl || '').trim();
    if (!src) return null;

    return {
      id,
      type: 'image',
      x,
      y,
      width,
      height,
      src,
      fileName: String(element.fileName || ''),
      mimeType: String(element.mimeType || 'image/png'),
      questionId: element.questionId ? String(element.questionId) : '',
      pageNumber: Number.isFinite(Number(element.pageNumber)) ? Number(element.pageNumber) : null,
    };
  }

  return null;
}

function normalizeStroke(stroke, index = 0) {
  if (!stroke || typeof stroke !== 'object') return null;

  const points = Array.isArray(stroke.points)
    ? stroke.points
        .map((point) => ({
          x: toNumber(point?.x, NaN),
          y: toNumber(point?.y, NaN),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];

  if (points.length < 2) return null;

  return {
    id: String(stroke.id || `stroke-${index + 1}`),
    tool: stroke.tool === 'highlighter' ? 'highlighter' : 'pen',
    color: String(stroke.color || DEFAULT_PEN_COLOR),
    size: Math.max(1, toNumber(stroke.size, DEFAULT_PEN_SIZE)),
    points,
  };
}

function sanitizeCanvasState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return { elements: [], strokes: [], viewport: { scale: DEFAULT_SCALE } };
  }

  const elements = Array.isArray(rawState.elements)
    ? rawState.elements.map(normalizeSceneElement).filter(Boolean)
    : [];
  const strokes = Array.isArray(rawState.strokes)
    ? rawState.strokes.map(normalizeStroke).filter(Boolean)
    : [];
  const viewport = rawState.viewport && typeof rawState.viewport === 'object'
    ? {
        scale: clamp(toNumber(rawState.viewport.scale, DEFAULT_SCALE), MIN_SCALE, MAX_SCALE),
      }
    : { scale: DEFAULT_SCALE };

  return { elements, strokes, viewport };
}

function readPersistedCanvasState(roomId) {
  if (typeof window === 'undefined') {
    return { elements: [], strokes: [], viewport: { scale: DEFAULT_SCALE } };
  }

  const currentKey = `${STORAGE_PREFIX}${roomId || 'session-board'}`;
  const legacyKey = `${LEGACY_STORAGE_PREFIX}${roomId || 'session-board'}`;

  for (const key of [currentKey, legacyKey]) {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) continue;

    const parsed = parseJson(rawValue);
    if (!parsed) continue;

    const next = sanitizeCanvasState(parsed);
    return next;
  }

  return { elements: [], strokes: [], viewport: { scale: DEFAULT_SCALE } };
}

function persistCanvasState(roomId, state) {
  if (typeof window === 'undefined') return;

  const currentKey = `${STORAGE_PREFIX}${roomId || 'session-board'}`;
  const payload = JSON.stringify({
    elements: state.elements,
    strokes: state.strokes,
    viewport: state.viewport,
    updatedAt: new Date().toISOString(),
  });

  try {
    window.localStorage.setItem(currentKey, payload);
  } catch (error) {
    debugError('tutoringCanvas', 'Failed to persist canvas state.', { message: error?.message });
  }
}

function distanceToSegment(point, start, end) {
  const segmentLengthSquared = ((end.x - start.x) ** 2) + ((end.y - start.y) ** 2);
  if (!segmentLengthSquared) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = clamp(
    (((point.x - start.x) * (end.x - start.x)) + ((point.y - start.y) * (end.y - start.y))) / segmentLengthSquared,
    0,
    1,
  );
  const projectedPoint = {
    x: start.x + (projection * (end.x - start.x)),
    y: start.y + (projection * (end.y - start.y)),
  };

  return Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y);
}

function strokeHitTest(stroke, point, radius) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return false;
  const effectiveRadius = Math.max(1, radius);
  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    if (distanceToSegment(point, stroke.points[index], stroke.points[index + 1]) <= effectiveRadius) {
      return true;
    }
  }
  return false;
}

function buildStrokePath(points = []) {
  if (!Array.isArray(points) || points.length < 2) return '';
  const [firstPoint, ...rest] = points;
  return `M ${firstPoint.x} ${firstPoint.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
}

function estimateTextHeight(text, width) {
  const normalized = normalizeTextValue(text);
  const lines = normalized.split('\n');
  const lineCount = Math.max(1, lines.length);
  const approximateCharsPerLine = Math.max(24, Math.floor(width / 14));
  const wrappedLineCount = lines.reduce((count, line) => count + Math.max(1, Math.ceil(Math.max(1, line.length) / approximateCharsPerLine)), 0);
  return Math.max(96, (Math.max(lineCount, wrappedLineCount) * 26) + 32);
}

function renderBoardTextContent(text) {
  // Future KaTeX/MathJax rendering can live here without changing the board model.
  const lines = normalizeTextValue(text).split('\n');
  return lines.length ? lines : [''];
}

function BoardItem({
  element,
  selected,
  editing,
  mode,
  onSelect,
  onStartDrag,
  onStartEdit,
  onChangeElement,
  onImageError,
  failedImage,
}) {
  const editableRef = useRef(null);
  const isSelectMode = mode === TOOL_MODES.SELECT;
  const isText = element.type === 'text';
  const isImage = element.type === 'image';

  useEffect(() => {
    if (!editing || !isText) return;
    const node = editableRef.current;
    if (!node) return;

    queueMicrotask(() => {
      try {
        node.focus();
        const selection = window.getSelection?.();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch {
        // no-op
      }
    });
  }, [editing, isText]);

  const handlePointerDown = (event) => {
    if (!isSelectMode) return;
    if (editing && isText) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    onSelect(element.id);
    onStartDrag(element.id, event);
  };

  const handleDoubleClick = (event) => {
    if (!isSelectMode || !isText) return;
    event.stopPropagation();
    onStartEdit(element.id);
  };

  return (
    <div
      className={`absolute rounded-2xl border bg-white shadow-sm transition ${
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-zinc-200'
      } ${isSelectMode ? 'cursor-grab' : 'cursor-default'} ${editing ? 'ring-2 ring-sky-400/40' : ''}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        userSelect: mode === TOOL_MODES.SELECT ? 'none' : 'none',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      data-board-item-id={element.id}
    >
      {isText ? (
        <div className="h-full w-full p-4">
          {editing ? (
            <div
              contentEditable
              suppressContentEditableWarning
              className="h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-xl outline-none"
              style={{
                fontSize: 18,
                lineHeight: '1.45',
                color: '#0f172a',
                minHeight: '100%',
                caretColor: '#0f172a',
                userSelect: 'text',
              }}
              onInput={(event) => {
                const nextText = event.currentTarget.innerText ?? '';
                onChangeElement(element.id, { text: nextText, height: estimateTextHeight(nextText, element.width) });
              }}
              onBlur={() => {
                onStartEdit(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onStartEdit(null);
                }
              }}
              ref={editableRef}
            >
              {element.text || ''}
            </div>
          ) : (
            (() => {
              const lines = renderBoardTextContent(element.text);
              return (
            <div
              className="h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-xl"
              style={{
                fontSize: 18,
                lineHeight: '1.45',
                color: '#0f172a',
                userSelect: 'none',
              }}
            >
              {lines.map((line, index) => (
                <span key={`${element.id}-line-${index}`}>
                  {line}
                  {index < lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </div>
              );
            })()
          )}
        </div>
      ) : null}

      {isImage ? (
        failedImage ? (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 text-center text-xs font-semibold text-zinc-500">
            Image unavailable
          </div>
        ) : (
          <img
            alt={element.fileName || 'board image'}
            className="h-full w-full rounded-2xl object-contain"
            draggable={false}
            src={element.src}
            onError={() => onImageError(element.id)}
          />
        )
      ) : null}

      {selected ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-emerald-500/50" />
      ) : null}
    </div>
  );
}

function CanvasToolbar({
  mode,
  setMode,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  eraserSize,
  setEraserSize,
  onUndoInk,
  onClearInk,
  scale,
  setScale,
}) {
  const buttonClass = (active = false) => (
    `inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
      active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
    }`
  );

  const iconClass = 'h-4 w-4 shrink-0';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-3 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass(mode === TOOL_MODES.SELECT)} onClick={() => setMode(TOOL_MODES.SELECT)}>
          <MousePointer2 className={iconClass} />
          Select
        </button>
        <button type="button" className={buttonClass(mode === TOOL_MODES.PEN)} onClick={() => setMode(TOOL_MODES.PEN)}>
          <Pencil className={iconClass} />
          Pen
        </button>
        <button type="button" className={buttonClass(mode === TOOL_MODES.ERASER)} onClick={() => setMode(TOOL_MODES.ERASER)}>
          <Eraser className={iconClass} />
          Eraser
        </button>
      </div>

      <div className="h-8 w-px bg-zinc-200" />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass(false)} onClick={onUndoInk} title="Undo last ink stroke">
          <Undo2 className={iconClass} />
          Undo
        </button>
        <button type="button" className={buttonClass(false)} onClick={onClearInk} title="Clear all ink strokes">
          <Trash2 className={iconClass} />
          Clear ink
        </button>
      </div>

      <div className="h-8 w-px bg-zinc-200" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2">
          <Palette className="h-4 w-4 text-zinc-500" />
          <input
            aria-label="Pen color"
            className="h-7 w-7 cursor-pointer rounded-full border border-zinc-200 bg-transparent p-0"
            onChange={(event) => setPenColor(event.target.value)}
            type="color"
            value={penColor}
          />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2">
          <span className="text-xs font-semibold text-zinc-500">Pen</span>
          <Minus className="h-3.5 w-3.5 text-zinc-400" />
          <input
            aria-label="Pen size"
            className="w-24 accent-emerald-600"
            max="18"
            min="2"
            onChange={(event) => setPenSize(Number(event.target.value))}
            type="range"
            value={penSize}
          />
          <Plus className="h-3.5 w-3.5 text-zinc-400" />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2">
          <span className="text-xs font-semibold text-zinc-500">Eraser</span>
          <Minus className="h-3.5 w-3.5 text-zinc-400" />
          <input
            aria-label="Eraser size"
            className="w-24 accent-emerald-600"
            max="72"
            min="8"
            onChange={(event) => setEraserSize(Number(event.target.value))}
            type="range"
            value={eraserSize}
          />
          <Plus className="h-3.5 w-3.5 text-zinc-400" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2">
        <ZoomOut className="h-4 w-4 text-zinc-500" />
        <input
          aria-label="Canvas zoom"
          className="w-28 accent-emerald-600"
          max={MAX_SCALE}
          min={MIN_SCALE}
          onChange={(event) => setScale(Number(event.target.value))}
          step="0.05"
          type="range"
          value={scale}
        />
        <ZoomIn className="h-4 w-4 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-500">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  );
}

export default function TldrawSdkEmbed({ roomId, onMount }) {
  const [elements, setElements] = useState([]);
  const [strokes, setStrokes] = useState([]);
  const [viewport, setViewport] = useState({ scale: DEFAULT_SCALE });
  const [tool, setTool] = useState(TOOL_MODES.SELECT);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [failedImageIds, setFailedImageIds] = useState(() => new Set());
  const [revision, setRevision] = useState(0);
  const [activeStroke, setActiveStroke] = useState(null);
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penSize, setPenSize] = useState(DEFAULT_PEN_SIZE);
  const [eraserSize, setEraserSize] = useState(DEFAULT_ERASER_SIZE);

  const viewportRef = useRef(null);
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);
  const activeStrokeRef = useRef(null);
  const debounceRef = useRef(null);
  const elementsRef = useRef(elements);
  const strokesRef = useRef(strokes);
  const viewportStateRef = useRef(viewport);
  const selectedIdRef = useRef(selectedId);
  const toolRef = useRef(tool);
  const editingIdRef = useRef(editingId);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    viewportStateRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  useEffect(() => {
    const nextState = readPersistedCanvasState(roomId);
    setElements(nextState.elements);
    setStrokes(nextState.strokes);
    setViewport(nextState.viewport);
    setSelectedId(null);
    setEditingId(null);
    setActiveStroke(null);
    activeStrokeRef.current = null;
    setFailedImageIds(new Set());
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return undefined;
    if (typeof window === 'undefined') return undefined;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      persistCanvasState(roomId, {
        elements: elementsRef.current,
        strokes: strokesRef.current,
        viewport: viewportStateRef.current,
      });
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [elements, strokes, viewport, roomId]);

  useEffect(() => {
    if (!onMount) return undefined;

    const api = {
      setSceneElements: (nextElements = []) => {
        const sanitized = Array.isArray(nextElements)
          ? nextElements.map(normalizeSceneElement).filter(Boolean)
          : [];
        setElements(sanitized);
        setSelectedId(null);
        setEditingId(null);
      },
      getSceneElements: () => elementsRef.current,
      clearInk: () => {
        setStrokes([]);
        activeStrokeRef.current = null;
        setActiveStroke(null);
      },
      refresh: () => {
        setRevision((value) => value + 1);
      },
      setSceneContent: ({ elements: nextElements = [], strokes: nextStrokes = [], viewport: nextViewport = null } = {}) => {
        const sanitizedElements = Array.isArray(nextElements)
          ? nextElements.map(normalizeSceneElement).filter(Boolean)
          : [];
        const sanitizedStrokes = Array.isArray(nextStrokes)
          ? nextStrokes.map(normalizeStroke).filter(Boolean)
          : [];
        setElements(sanitizedElements);
        setStrokes(sanitizedStrokes);
        if (nextViewport && typeof nextViewport === 'object') {
          setViewport({
            scale: clamp(toNumber(nextViewport.scale, DEFAULT_SCALE), MIN_SCALE, MAX_SCALE),
          });
        }
        setSelectedId(null);
        setEditingId(null);
      },
      resetScene: () => {
        setElements([]);
        setStrokes([]);
        setSelectedId(null);
        setEditingId(null);
        activeStrokeRef.current = null;
        setActiveStroke(null);
      },
      addFiles: () => {
        // Future support for imported whiteboard attachments can hook in here.
      },
    };

    onMount(api);
    return undefined;
  }, [onMount, roomId]);

  const boardMetrics = useMemo(() => {
    const points = [
      ...elements.flatMap((element) => [
        { x: element.x + element.width, y: element.y + element.height },
      ]),
      ...strokes.flatMap((stroke) => stroke.points),
      ...(activeStroke?.points || []),
    ];

    const maxX = points.reduce((value, point) => Math.max(value, toNumber(point?.x, 0)), MIN_BOARD_WIDTH);
    const maxY = points.reduce((value, point) => Math.max(value, toNumber(point?.y, 0)), MIN_BOARD_HEIGHT);

    return {
      width: Math.ceil(Math.max(MIN_BOARD_WIDTH, maxX + BOARD_PADDING)),
      height: Math.ceil(Math.max(MIN_BOARD_HEIGHT, maxY + BOARD_PADDING)),
    };
  }, [activeStroke?.points, elements, strokes]);

  const stageWidth = Math.max(boardMetrics.width * viewport.scale, 800);
  const stageHeight = Math.max(boardMetrics.height * viewport.scale, 600);

  const getBoardPoint = useCallback((event) => {
    const surface = surfaceRef.current;
    const viewportNode = viewportRef.current;
    if (!surface || !viewportNode) return { x: 0, y: 0 };

    const rect = surface.getBoundingClientRect();
    const scrollLeft = viewportNode.scrollLeft || 0;
    const scrollTop = viewportNode.scrollTop || 0;

    return {
      x: ((event.clientX - rect.left) + scrollLeft) / viewport.scale,
      y: ((event.clientY - rect.top) + scrollTop) / viewport.scale,
    };
  }, [viewport.scale]);

  const updateElement = useCallback((id, patch) => {
    setElements((current) => current.map((element) => {
      if (element.id !== id) return element;
      const nextElement = { ...element, ...patch };
      if (nextElement.type === 'text') {
        nextElement.height = Math.max(96, toNumber(nextElement.height, estimateTextHeight(nextElement.text, nextElement.width)));
      }
      return nextElement;
    }));
  }, []);

  const startDrag = useCallback((elementId, event) => {
    if (toolRef.current !== TOOL_MODES.SELECT) return;
    const element = elementsRef.current.find((item) => item.id === elementId);
    if (!element || editingIdRef.current === elementId) return;

    dragRef.current = {
      id: elementId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: element.x,
      originY: element.y,
    };

    const target = event.currentTarget;
    if (target?.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    }
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const applyEraser = useCallback((point) => {
    const radius = Math.max(1, eraserSize / viewport.scale);
    setStrokes((current) => current.filter((stroke) => !strokeHitTest(stroke, point, radius)));
  }, [eraserSize, viewport.scale]);

  const appendStrokePoint = useCallback((point) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) return;

    const previousPoint = stroke.points[stroke.points.length - 1];
    if (previousPoint && Math.hypot(previousPoint.x - point.x, previousPoint.y - point.y) < 1) {
      return;
    }

    stroke.points = [...stroke.points, point];
    setActiveStroke({ ...stroke });
  }, []);

  const startStroke = useCallback((point) => {
    const nextStroke = {
      id: makeId('stroke'),
      tool: 'pen',
      color: penColor,
      size: Math.max(1, penSize),
      points: [point],
    };

    activeStrokeRef.current = nextStroke;
    setActiveStroke(nextStroke);
  }, [penColor, penSize]);

  const finishStroke = useCallback(() => {
    const stroke = activeStrokeRef.current;
    if (stroke && stroke.points.length > 1) {
      setStrokes((current) => [...current, stroke]);
    }
    activeStrokeRef.current = null;
    setActiveStroke(null);
  }, []);

  const handleCanvasPointerDown = useCallback((event) => {
    if (event.button !== 0) return;

    const point = getBoardPoint(event);
    if (toolRef.current === TOOL_MODES.PEN) {
      event.preventDefault();
      startStroke(point);
      return;
    }

    if (toolRef.current === TOOL_MODES.ERASER) {
      event.preventDefault();
      applyEraser(point);
      return;
    }

    if (event.target === event.currentTarget) {
      setSelectedId(null);
      setEditingId(null);
    }
  }, [applyEraser, getBoardPoint, startStroke]);

  const handleCanvasPointerMove = useCallback((event) => {
    if (dragRef.current) {
      const drag = dragRef.current;
      const deltaX = (event.clientX - drag.startClientX) / viewport.scale;
      const deltaY = (event.clientY - drag.startClientY) / viewport.scale;
      const nextX = Math.max(0, drag.originX + deltaX);
      const nextY = Math.max(0, drag.originY + deltaY);

      setElements((current) => current.map((element) => (
        element.id === drag.id
          ? { ...element, x: nextX, y: nextY }
          : element
      )));
    }

    if (!activeStrokeRef.current) return;

    const point = getBoardPoint(event);
    if (toolRef.current === TOOL_MODES.PEN) {
      appendStrokePoint(point);
    } else if (toolRef.current === TOOL_MODES.ERASER) {
      applyEraser(point);
    }
  }, [appendStrokePoint, applyEraser, getBoardPoint, viewport.scale]);

  const handleCanvasPointerUp = useCallback(() => {
    if (dragRef.current) {
      stopDrag();
    }
    if (activeStrokeRef.current) {
      finishStroke();
    }
  }, [finishStroke, stopDrag]);

  const handleClearInk = useCallback(() => {
    setStrokes([]);
    activeStrokeRef.current = null;
    setActiveStroke(null);
  }, []);

  const handleUndoInk = useCallback(() => {
    if (activeStrokeRef.current) {
      activeStrokeRef.current = null;
      setActiveStroke(null);
    }
    setStrokes((current) => current.slice(0, -1));
  }, []);

  const selectedElement = elements.find((element) => element.id === selectedId) || null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-50" data-revision={revision}>
      <CanvasToolbar
        mode={tool}
        setMode={setTool}
        penColor={penColor}
        setPenColor={setPenColor}
        penSize={penSize}
        setPenSize={setPenSize}
        eraserSize={eraserSize}
        setEraserSize={setEraserSize}
        onUndoInk={handleUndoInk}
        onClearInk={handleClearInk}
        scale={viewport.scale}
        setScale={(scale) => setViewport({ scale: clamp(scale, MIN_SCALE, MAX_SCALE) })}
      />

      <div
        ref={viewportRef}
        className="relative flex-1 overflow-auto bg-[#f7f8fb]"
      >
        <div
          style={{
            width: stageWidth,
            height: stageHeight,
          }}
          className="relative"
        >
          <div
            ref={surfaceRef}
            className="absolute left-0 top-0 origin-top-left rounded-[28px] border border-zinc-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
            style={{
              width: boardMetrics.width,
              height: boardMetrics.height,
              transform: `scale(${viewport.scale})`,
              transformOrigin: 'top left',
              backgroundImage: 'none',
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          >
            <div
              className={tool === TOOL_MODES.SELECT ? 'absolute inset-0 pointer-events-auto' : 'pointer-events-none absolute inset-0'}
              style={{ zIndex: 10 }}
            >
              {elements.map((element) => (
                <BoardItem
                  key={element.id}
                  element={element}
                  selected={selectedId === element.id}
                  editing={editingId === element.id}
                  mode={tool}
                  onSelect={setSelectedId}
                  onStartDrag={startDrag}
                  onStartEdit={setEditingId}
                  onChangeElement={updateElement}
                  onImageError={(id) => setFailedImageIds((current) => new Set([...current, id]))}
                  failedImage={failedImageIds.has(element.id)}
                />
              ))}
            </div>

            <svg
              className="pointer-events-none absolute inset-0"
              width={boardMetrics.width}
              height={boardMetrics.height}
              style={{ zIndex: 20 }}
            >
              {strokes.map((stroke) => (
                <path
                  key={stroke.id}
                  d={buildStrokePath(stroke.points)}
                  fill="none"
                  stroke={stroke.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={stroke.tool === 'highlighter' ? 0.35 : 1}
                  strokeWidth={stroke.size}
                />
              ))}
              {activeStroke ? (
                <path
                  d={buildStrokePath(activeStroke.points)}
                  fill="none"
                  stroke={activeStroke.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.95}
                  strokeWidth={activeStroke.size}
                />
              ) : null}
            </svg>

            {selectedElement ? (
              <div
                className="pointer-events-none absolute rounded-2xl border border-emerald-400/70"
                style={{
                  zIndex: 15,
                  left: selectedElement.x - 4,
                  top: selectedElement.y - 4,
                  width: selectedElement.width + 8,
                  height: selectedElement.height + 8,
                }}
              />
            ) : null}

            {!elements.length && !strokes.length ? (
              <div className="pointer-events-none absolute left-6 top-6 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 text-xs font-semibold text-zinc-500 shadow-sm">
                Tutor canvas ready. Use the toolbar to add ink or text.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
