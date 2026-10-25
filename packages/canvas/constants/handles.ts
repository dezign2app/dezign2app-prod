// ─── Canvas Handle Sizing & Styling Control Panel ─────────────────────────────
//
// This file is your central control panel for all node handles on the canvas.
// Handles are categorized by their UI role and hierarchy so you have complete
// control over their sizes, offsets, and active connection styles.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO CUSTOMIZE SIZES:
// ─────────────────────────────────────────────────────────────────────────────
// 1. Primary Node-Level / Header Handles (WebPage, WebApp, Auth, Database headers):
//    -> Edit SECTION 1 (CANVAS_NODE_HANDLE_*)
//
// 2. Row-Level / Sub-Item Handles (Actions, Endpoints, State Variables, DB operations):
//    -> Edit SECTION 2 (CANVAS_ROW_HANDLE_*)
//
// 3. Compact / Micro Handles (High-density lists, small badges, inline chips):
//    -> Edit SECTION 3 (CANVAS_COMPACT_HANDLE_*)
//
// 4. Connected State Transforms (Enlargement & Ring glow when an edge is wired):
//    -> Edit SECTION 4 (CANVAS_HANDLE_CONNECTED_*)
//
// ⚠️ RULE FOR BORDER CENTERING OFFSETS:
// The centering offset must always equal -(SIZE / 2) in pixels:
// - 14px size  -->  -7px offset  -->  "-left-[7px]" / "-right-[7px]"
// - 12px size  -->  -6px offset  -->  "-left-[6px]" / "-right-[6px]"
// - 10px size  -->  -5px offset  -->  "-left-[5px]" / "-right-[5px]"
// -  8px size  -->  -4px offset  -->  "-left-[4px]" / "-right-[4px]"
// ─────────────────────────────────────────────────────────────────────────────

// =============================================================================
// SECTION 1: Node-Level / Header Handles (Primary Connection Ports)
// =============================================================================
// Used for primary node entry/exit points that represent the entire container:
// e.g. WebPage "page-in", WebApp "auth-in", AuthNode "auth-out", AppStore "store-in",
// DatabaseNode top/bottom handles, Redis top/bottom handles, LangGraph main output.

/** Numeric size in pixels for node header handles (default: 14) */
export const CANVAS_NODE_HANDLE_SIZE = 14;
export const CANVAS_NODE_HANDLE_SIZE_PX = 14;

/** Border centering offset in pixels: -(CANVAS_NODE_HANDLE_SIZE / 2) */
export const CANVAS_NODE_HANDLE_OFFSET = -7;
export const CANVAS_NODE_HANDLE_OFFSET_PX = -7;

/** Tailwind class for node header handle dimensions (14px = 3.5rem / 4) */
export const CANVAS_NODE_HANDLE_CLASS = "w-3.5 h-3.5";

/** Tailwind positioning offset classes to center 14px handles over card borders */
export const CANVAS_NODE_HANDLE_LEFT_OFFSET_CLASS = "-left-[7px]";
export const CANVAS_NODE_HANDLE_RIGHT_OFFSET_CLASS = "-right-[7px]";
export const CANVAS_NODE_HANDLE_TOP_OFFSET_CLASS = "-top-[7px]";
export const CANVAS_NODE_HANDLE_BOTTOM_OFFSET_CLASS = "-bottom-[7px]";

/** Base classes recommended for node header handles */
export const CANVAS_NODE_HANDLE_BASE_CLASS =
  "w-3.5 h-3.5 border-2 border-background transition-all hover:scale-125 z-10";


// =============================================================================
// SECTION 2: Row-Level / Sub-Item Handles (Actions, Endpoints, Fields, Operations)
// =============================================================================
// Used for repeating items inside node lists and tables:
// e.g. WebPage actions ("send message", "pageLoad"), API endpoints,
// StateStore variables ("value", "cart"), Database table operations (query, insert),
// Queue/Worker task routes, Realtime connection channels.

/** Numeric size in pixels for sub-item row handles (default: 14) */
export const CANVAS_ROW_HANDLE_SIZE = 14;
export const CANVAS_ROW_HANDLE_SIZE_PX = 14;

/** Border centering offset in pixels: -(CANVAS_ROW_HANDLE_SIZE / 2) */
export const CANVAS_ROW_HANDLE_OFFSET = -7;
export const CANVAS_ROW_HANDLE_OFFSET_PX = -7;

/** Tailwind class for row-level handle dimensions (14px = 3.5rem / 4) */
export const CANVAS_ROW_HANDLE_CLASS = "w-3.5 h-3.5";

/** Tailwind positioning offset classes to center 14px handles over card borders */
export const CANVAS_ROW_HANDLE_LEFT_OFFSET_CLASS = "-left-[7px]";
export const CANVAS_ROW_HANDLE_RIGHT_OFFSET_CLASS = "-right-[7px]";
export const CANVAS_ROW_HANDLE_TOP_OFFSET_CLASS = "-top-[7px]";
export const CANVAS_ROW_HANDLE_BOTTOM_OFFSET_CLASS = "-bottom-[7px]";

/** Base classes recommended for row-level handles */
export const CANVAS_ROW_HANDLE_BASE_CLASS =
  "w-3.5 h-3.5 border-2 border-background transition-all hover:scale-125 z-10";


// =============================================================================
// SECTION 3: Compact / Micro Handles (High-Density Lists & Secondary Ports)
// =============================================================================
// Used when rows are very narrow or lists are compact:
// e.g. Dense column definitions, secondary tool ports, micro chips.

/** Numeric size in pixels for compact handles (default: 12) */
export const CANVAS_COMPACT_HANDLE_SIZE = 12;
export const CANVAS_COMPACT_HANDLE_SIZE_PX = 12;

/** Border centering offset in pixels: -(CANVAS_COMPACT_HANDLE_SIZE / 2) */
export const CANVAS_COMPACT_HANDLE_OFFSET = -6;
export const CANVAS_COMPACT_HANDLE_OFFSET_PX = -6;

/** Tailwind class for compact handle dimensions (12px = 3rem / 4) */
export const CANVAS_COMPACT_HANDLE_CLASS = "w-3 h-3";

/** Tailwind positioning offset classes to center 12px handles over card borders */
export const CANVAS_COMPACT_HANDLE_LEFT_OFFSET_CLASS = "-left-[6px]";
export const CANVAS_COMPACT_HANDLE_RIGHT_OFFSET_CLASS = "-right-[6px]";
export const CANVAS_COMPACT_HANDLE_TOP_OFFSET_CLASS = "-top-[6px]";
export const CANVAS_COMPACT_HANDLE_BOTTOM_OFFSET_CLASS = "-bottom-[6px]";

/** Base classes recommended for compact handles */
export const CANVAS_COMPACT_HANDLE_BASE_CLASS =
  "w-3 h-3 border-2 border-background transition-all hover:scale-125 z-10";


// =============================================================================
// SECTION 4: Active / Connected State Styling
// =============================================================================
// When an edge is connected to a handle, these classes give visual feedback.
// TIP: If you want connected handles to remain the EXACT same size as idle handles
// without enlarging, leave CANVAS_HANDLE_CONNECTED_SCALE_CLASS as "" (empty string).

/** Scale transform when connected (set to "" for clean, uniform sizing without inflation) */
export const CANVAS_HANDLE_CONNECTED_SCALE_CLASS = "";

/** Outer glow ring class when connected */
export const CANVAS_HANDLE_CONNECTED_RING_CLASS = "ring-2 ring-primary/50";

/** Pre-composed connected modifier class (ring only, no scale ballooning) */
export const CANVAS_HANDLE_CONNECTED_CLASS = "ring-2 ring-primary/50";


// =============================================================================
// SECTION 5: Default Fallbacks & Compatibility Aliases
// =============================================================================
// Ensures full backwards compatibility across any components importing
// CANVAS_HANDLE_SIZE, CANVAS_HANDLE_CLASS, etc.

export const CANVAS_HANDLE_SIZE = CANVAS_NODE_HANDLE_SIZE;
export const CANVAS_HANDLE_SIZE_PX = CANVAS_NODE_HANDLE_SIZE_PX;
export const DEFAULT_HANDLE_SIZE = CANVAS_NODE_HANDLE_SIZE;
export const HANDLE_SIZE = CANVAS_NODE_HANDLE_SIZE;
export const CANVAS_HANDLE_OFFSET = CANVAS_NODE_HANDLE_OFFSET;
export const CANVAS_HANDLE_OFFSET_PX = CANVAS_NODE_HANDLE_OFFSET_PX;

export const CANVAS_HANDLE_SIZE_CLASS = CANVAS_NODE_HANDLE_CLASS;
export const CANVAS_HANDLE_CLASS = CANVAS_NODE_HANDLE_CLASS;
export const CANVAS_HANDLE_LEFT_OFFSET_CLASS = CANVAS_NODE_HANDLE_LEFT_OFFSET_CLASS;
export const CANVAS_HANDLE_RIGHT_OFFSET_CLASS = CANVAS_NODE_HANDLE_RIGHT_OFFSET_CLASS;
export const CANVAS_HANDLE_TOP_OFFSET_CLASS = CANVAS_NODE_HANDLE_TOP_OFFSET_CLASS;
export const CANVAS_HANDLE_BOTTOM_OFFSET_CLASS = CANVAS_NODE_HANDLE_BOTTOM_OFFSET_CLASS;
export const CANVAS_HANDLE_BASE_CLASS = CANVAS_NODE_HANDLE_BASE_CLASS;

export const CANVAS_HANDLE_SIZE_COMPACT = CANVAS_COMPACT_HANDLE_SIZE;
export const CANVAS_HANDLE_SIZE_COMPACT_PX = CANVAS_COMPACT_HANDLE_SIZE_PX;
export const CANVAS_HANDLE_OFFSET_COMPACT = CANVAS_COMPACT_HANDLE_OFFSET;
export const CANVAS_HANDLE_COMPACT_LEFT_OFFSET_CLASS = CANVAS_COMPACT_HANDLE_LEFT_OFFSET_CLASS;
export const CANVAS_HANDLE_COMPACT_RIGHT_OFFSET_CLASS = CANVAS_COMPACT_HANDLE_RIGHT_OFFSET_CLASS;
export const CANVAS_HANDLE_COMPACT_TOP_OFFSET_CLASS = CANVAS_COMPACT_HANDLE_TOP_OFFSET_CLASS;
export const CANVAS_HANDLE_COMPACT_BOTTOM_OFFSET_CLASS = CANVAS_COMPACT_HANDLE_BOTTOM_OFFSET_CLASS;
