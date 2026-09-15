"use client";

import { useEffect, useRef, useState } from "react";
import { Block, BLOCK_LABEL, BlockType } from "@/lib/types";

/**
 * The reflection editor.
 *
 * Each block is its own textarea rather than one contenteditable surface.
 * That is the whole design: contenteditable means owning selection, paste,
 * undo and every browser's private opinion about what Enter does inside a
 * list. A textarea per block gives all of that away to the platform, and the
 * only thing left to implement is what happens at the seams — Enter at the
 * end, Backspace at the start, arrows across the boundary.
 *
 * Typing is local to the block being edited and lifted on change, so a long
 * entry does not re-render every sibling on every keystroke.
 */
export function BlockEditor({
  blocks,
  onChange,
  placeholder = "Write something, or press / for a block",
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  placeholder?: string;
}) {
  // Which block to put the caret in after the next render, and where in it.
  const focusNext = useRef<{ id: string; at: "start" | "end" } | null>(null);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const el = refs.current.get(target.id);
    if (!el) return;
    el.focus();
    const at = target.at === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  }, [blocks]);

  const list = blocks.length > 0 ? blocks : [empty()];

  const replace = (id: string, patch: Partial<Block>) =>
    onChange(list.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const insertAfter = (id: string, block: Block) => {
    const i = list.findIndex((b) => b.id === id);
    onChange([...list.slice(0, i + 1), block, ...list.slice(i + 1)]);
    focusNext.current = { id: block.id, at: "start" };
  };

  const append = () => {
    const last = list[list.length - 1];
    // Landing in the trailing empty block rather than stacking another one
    // on top of it — clicking + twice should not leave a blank behind.
    if (last && last.text === "" && last.type === "text") {
      focusNext.current = null;
      refs.current.get(last.id)?.focus();
      return;
    }
    const block = empty();
    onChange([...list, block]);
    focusNext.current = { id: block.id, at: "start" };
  };

  const remove = (id: string) => {
    const i = list.findIndex((b) => b.id === id);
    if (list.length === 1) {
      onChange([]);
      return;
    }
    const before = list[i - 1];
    onChange(list.filter((b) => b.id !== id));
    if (before) focusNext.current = { id: before.id, at: "end" };
  };

  const move = (id: string, delta: number) => {
    const i = list.findIndex((b) => b.id === id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    focusNext.current = { id, at: "end" };
  };

  const focusSibling = (id: string, delta: number) => {
    const i = list.findIndex((b) => b.id === id);
    const sibling = list[i + delta];
    if (!sibling) return false;
    focusNext.current = { id: sibling.id, at: delta > 0 ? "start" : "end" };
    // Nothing changed, so the effect will not run: move the caret now.
    const el = refs.current.get(sibling.id);
    if (el) {
      focusNext.current = null;
      el.focus();
      const at = delta > 0 ? 0 : el.value.length;
      el.setSelectionRange(at, at);
    }
    return true;
  };

  return (
    <div className="flex flex-col">
      {list.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          placeholder={index === 0 ? placeholder : ""}
          menuOpen={menuFor === block.id}
          setMenuOpen={(open) => setMenuFor(open ? block.id : null)}
          register={(el) => {
            if (el) refs.current.set(block.id, el);
            else refs.current.delete(block.id);
          }}
          onText={(text) => {
            // Markdown-style shortcuts, applied the moment the prefix is
            // complete. Typing "- " turning into a bullet is the single
            // behaviour that makes this feel like a document rather than a
            // box, and it costs one lookup per keystroke.
            const shortcut = SHORTCUTS.find((s) => text.startsWith(s.prefix));
            if (shortcut && block.type !== shortcut.type) {
              replace(block.id, {
                type: shortcut.type,
                text: text.slice(shortcut.prefix.length),
              });
              focusNext.current = { id: block.id, at: "start" };
              return;
            }
            replace(block.id, { text });
          }}
          onEnter={() => {
            // Enter on an empty list item leaves the list rather than making
            // another empty one, which is what every editor does.
            if (block.text === "" && block.type !== "text") {
              replace(block.id, { type: "text" });
              return;
            }
            insertAfter(
              block.id,
              empty(block.type === "todo" || block.type === "bullet" ? block.type : "text"),
            );
          }}
          onBackspaceAtStart={() => {
            if (block.type !== "text") {
              replace(block.id, { type: "text" });
              return;
            }
            if (block.text === "") remove(block.id);
          }}
          onArrow={(delta) => focusSibling(block.id, delta)}
          onMove={(delta) => move(block.id, delta)}
          onType={(type) => {
            // One update, not a clear followed by a retype: both would be
            // computed from this render's list, so the second would discard
            // the first and leave the slash that opened the menu behind.
            replace(block.id, { type, text: block.text === "/" ? "" : block.text });
            setMenuFor(null);
            focusNext.current = { id: block.id, at: "end" };
          }}
          onToggle={() => replace(block.id, { done: !block.done })}
          onDelete={() => remove(block.id)}
          onInsertBelow={() => insertAfter(block.id, empty())}
        />
      ))}

      {/*
        The gutter + only appears on hover, which is fine once you know it is
        there and useless before. This one is always visible, and the padded
        area under it means clicking the empty space below the last line does
        what clicking empty space in a document should.
      */}
      <button
        type="button"
        onClick={append}
        className="mt-1 flex items-center gap-1.5 rounded-lg py-2 pl-7 pr-3 text-left text-sm text-ink-3 transition-colors hover:text-ink"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
          <path
            d="M8 3.5v9M3.5 8h9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        Add a block
      </button>
    </div>
  );
}

const SHORTCUTS: { prefix: string; type: BlockType }[] = [
  { prefix: "# ", type: "h2" },
  { prefix: "## ", type: "h3" },
  { prefix: "- ", type: "bullet" },
  { prefix: "* ", type: "bullet" },
  { prefix: "[] ", type: "todo" },
  { prefix: "[ ] ", type: "todo" },
  { prefix: "> ", type: "quote" },
];

const MENU_TYPES: BlockType[] = ["text", "h2", "h3", "bullet", "todo", "quote", "divider"];

function BlockRow({
  block,
  placeholder,
  menuOpen,
  setMenuOpen,
  register,
  onText,
  onEnter,
  onBackspaceAtStart,
  onArrow,
  onMove,
  onType,
  onToggle,
  onDelete,
  onInsertBelow,
}: {
  block: Block;
  placeholder: string;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  register: (el: HTMLTextAreaElement | null) => void;
  onText: (text: string) => void;
  onEnter: () => void;
  onBackspaceAtStart: () => void;
  onArrow: (delta: number) => boolean;
  onMove: (delta: number) => void;
  onType: (type: BlockType) => void;
  onToggle: () => void;
  onDelete: () => void;
  onInsertBelow: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Textareas do not grow on their own; measuring the scroll height each time
  // the text changes is what keeps a paragraph from becoming a scrollbox.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text, block.type]);

  if (block.type === "divider") {
    return (
      <div className="group relative flex items-center gap-1 py-2 pl-14">
        <Handle
          onDelete={onDelete}
          onMove={onMove}
          onMenu={() => setMenuOpen(!menuOpen)}
          onInsertBelow={onInsertBelow}
        />
        <hr className="w-full border-t border-line" />
        {menuOpen && (
          <TypeMenu current={block.type} onPick={onType} onClose={() => setMenuOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="group relative flex items-start gap-1.5 pl-14">
      <Handle
        onDelete={onDelete}
        onMove={onMove}
        onMenu={() => setMenuOpen(!menuOpen)}
        onInsertBelow={onInsertBelow}
      />

      {block.type === "todo" && (
        <button
          type="button"
          role="checkbox"
          aria-checked={block.done}
          aria-label={block.text || "To-do"}
          onClick={onToggle}
          className={`mt-[7px] grid size-[15px] shrink-0 place-items-center rounded border transition-colors ${
            block.done
              ? "border-accent bg-accent text-white"
              : "border-line-strong hover:border-accent"
          }`}
        >
          {block.done && (
            <svg viewBox="0 0 16 16" aria-hidden className="size-2.5">
              <path
                d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      {block.type === "bullet" && (
        <span aria-hidden className="mt-[11px] size-1.5 shrink-0 rounded-full bg-ink-3" />
      )}

      <textarea
        ref={(el) => {
          ref.current = el;
          register(el);
        }}
        rows={1}
        value={block.text}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
          const atEnd =
            el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          } else if (e.key === "Backspace" && atStart) {
            // Only intercept when there is nothing to delete inside the
            // block; otherwise Backspace has to stay Backspace.
            if (block.text === "" || block.type !== "text") {
              e.preventDefault();
              onBackspaceAtStart();
            }
          } else if (
            (e.altKey || e.metaKey) &&
            (e.key === "ArrowUp" || e.key === "ArrowDown")
          ) {
            e.preventDefault();
            onMove(e.key === "ArrowUp" ? -1 : 1);
          } else if (e.key === "ArrowUp" && atStart) {
            if (onArrow(-1)) e.preventDefault();
          } else if (e.key === "ArrowDown" && atEnd) {
            if (onArrow(1)) e.preventDefault();
          } else if (e.key === "/" && block.text === "") {
            // Deliberately not preventing default: the slash is typed, and
            // picking a type or pressing Escape clears it. Swallowing it
            // would strand anyone who meant to write "/".
            setMenuOpen(true);
          } else if (e.key === "Escape" && menuOpen) {
            e.stopPropagation();
            setMenuOpen(false);
          }
        }}
        className={`w-full resize-none border-0 bg-transparent py-1 text-ink placeholder:text-ink-3 focus:outline-none ${
          STYLE[block.type]
        } ${block.type === "todo" && block.done ? "text-ink-3 line-through" : ""}`}
      />

      {menuOpen && (
        <TypeMenu current={block.type} onPick={onType} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}

const STYLE: Record<BlockType, string> = {
  text: "text-sm leading-relaxed",
  h2: "text-lg font-semibold tracking-tight",
  h3: "text-[15px] font-semibold tracking-tight",
  bullet: "text-sm leading-relaxed",
  todo: "text-sm leading-relaxed",
  quote: "border-l-2 border-accent/50 pl-3 text-sm italic leading-relaxed text-ink-2",
  divider: "",
};

/**
 * The gutter controls, revealed on hover or focus.
 *
 * Two buttons, matching what each is for: + puts a block below this one, and
 * the grip opens the type menu. Both stay hidden until the row is under the
 * cursor, so a page of writing is not fringed with chrome.
 */
function Handle({
  onDelete,
  onMove,
  onMenu,
  onInsertBelow,
}: {
  onDelete: () => void;
  onMove: (delta: number) => void;
  onMenu: () => void;
  onInsertBelow: () => void;
}) {
  return (
    <span className="absolute left-0 top-1 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100">
      <button
        type="button"
        aria-label="Add a block below"
        title="Add a block below"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsertBelow}
        className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-4">
          <path
            d="M8 3.5v9M3.5 8h9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <button
        type="button"
        aria-label="Change block type"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onMenu}
        onContextMenu={(e) => {
          e.preventDefault();
          onDelete();
        }}
        onKeyDown={(e) => {
          if (e.altKey && e.key === "ArrowUp") onMove(-1);
          if (e.altKey && e.key === "ArrowDown") onMove(1);
        }}
        title="Change type — right-click to delete"
        className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
          <path
            d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

function TypeMenu({
  current,
  onPick,
  onClose,
}: {
  current: BlockType;
  onPick: (type: BlockType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // Deferred, or the pointerdown that opened this closes it again.
    const id = window.setTimeout(
      () => document.addEventListener("pointerdown", onDown, true),
      0,
    );
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fade-up absolute left-14 top-7 z-50 w-48 rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-lg),var(--edge)]"
    >
      {MENU_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(type)}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-panel-2 ${
            type === current ? "text-accent-text" : "text-ink"
          }`}
        >
          {BLOCK_LABEL[type]}
          <span className="text-[11px] text-ink-3">{HINT[type]}</span>
        </button>
      ))}
    </div>
  );
}

const HINT: Record<BlockType, string> = {
  text: "",
  h2: "#",
  h3: "##",
  bullet: "-",
  todo: "[]",
  quote: ">",
  divider: "",
};

let seq = 0;

function empty(type: BlockType = "text"): Block {
  seq += 1;
  return {
    id: `${Date.now().toString(36)}${seq.toString(36)}`,
    type,
    text: "",
    done: false,
  };
}
