import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Pilcrow,
  Quote,
  Minus,
  Highlighter,
  ImagePlus,
  Smile,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/config/apiConfig';

// Émojis, symboles et formes prêts à insérer
const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Réactions', items: ['😀', '🙂', '😉', '😍', '🤔', '😅', '👍', '👏', '🙏', '💪', '🎉', '💡', '⭐', '❤️', '🔥'] },
  { label: 'Paie & travail', items: ['💶', '💰', '🪙', '💳', '🧾', '📅', '🏢', '🧮', '📊', '📈', '📉', '⏰', '📌', '🔒', '⚖️', '👷', '🧑‍💼'] },
  { label: 'Repères', items: ['✅', '❌', '❗', '❓', '➡️', '⬅️', '⬆️', '⬇️', '▶️', '➕', '➖'] },
  { label: 'Formes', items: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🔶', '🔷', '🟥', '🟦', '🟩', '★', '●', '■', '▲', '◆'] },
];

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bold: {},
        italic: {},
        bulletList: {},
        orderedList: {},
        listItem: {},
        hardBreak: {},
        horizontalRule: {},
        paragraph: {},
        strike: {},
        blockquote: {},
        code: false,
        codeBlock: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TiptapImage.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'rich-editor-content min-h-[160px] px-3 py-2 text-sm focus:outline-none',
      },
    },
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    },
  });

  // Only sync when content changes externally (e.g. opening EditDialog with different item).
  // Skip if the editor itself produced this HTML (avoids cursor reset on every keystroke).
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  if (!editor) return null;

  const handleImageUpload = async (file: File) => {
    setUploadingImg(true);
    try {
      const { imageUrl } = await uploadImage(file);
      if (imageUrl) editor.chain().focus().setImage({ src: imageUrl }).run();
    } catch {
      // L'upload a échoué (auth/serveur) — on ignore silencieusement côté éditeur
    } finally {
      setUploadingImg(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const ToolBtn = ({
    active,
    onClick,
    title,
    children,
    className: extraClass,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center justify-center rounded h-7 w-7 transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        extraClass,
      )}
    >
      {children}
    </button>
  );

  const Separator = () => <div className="w-px h-5 bg-border mx-1 shrink-0" />;

  const currentColor: string =
    (editor.getAttributes('textStyle').color as string) || '';

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 px-1.5 py-1">

        {/* Bold */}
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>

        {/* Italic */}
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>

        {/* Underline */}
        <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>

        {/* Strikethrough */}
        <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>

        <Separator />

        {/* Color picker */}
        <div className="relative">
          <ToolBtn onClick={() => colorInputRef.current?.click()} title="Couleur du texte">
            <div className="flex flex-col items-center gap-px">
              <Palette className="h-3.5 w-3.5" />
              <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: currentColor || 'currentColor' }} />
            </div>
          </ToolBtn>
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            defaultValue="#000000"
            onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
          />
        </div>

        {/* Reset color */}
        <ToolBtn onClick={() => editor.chain().focus().unsetColor().run()} title="Couleur par défaut" className="w-auto px-1.5 text-xs font-semibold">
          A
        </ToolBtn>

        {/* Highlight */}
        <div className="relative">
          <ToolBtn
            active={editor.isActive('highlight')}
            onClick={() => {
              if (editor.isActive('highlight')) {
                editor.chain().focus().unsetHighlight().run();
              } else {
                highlightInputRef.current?.click();
              }
            }}
            title="Surligner"
          >
            <Highlighter className="h-3.5 w-3.5" />
          </ToolBtn>
          <input
            ref={highlightInputRef}
            type="color"
            className="sr-only"
            defaultValue="#fde68a"
            onInput={(e) => editor.chain().focus().setHighlight({ color: (e.target as HTMLInputElement).value }).run()}
          />
        </div>

        <Separator />

        {/* Headings */}
        <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titre 1">
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre 2">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titre 3">
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraphe">
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolBtn>

        <Separator />

        {/* Alignment */}
        <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Aligner à gauche">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrer">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Aligner à droite">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justifier">
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolBtn>

        <Separator />

        {/* Lists */}
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>

        {/* Blockquote */}
        <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation">
          <Quote className="h-3.5 w-3.5" />
        </ToolBtn>

        {/* Horizontal rule */}
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
          <Minus className="h-3.5 w-3.5" />
        </ToolBtn>

        <Separator />

        {/* Image upload (photos, schémas) */}
        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Insérer une image / un schéma">
          {uploadingImg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        </ToolBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
        />

        {/* Emoji / symbols / shapes */}
        <div className="relative">
          <ToolBtn active={emojiOpen} onClick={() => setEmojiOpen((o) => !o)} title="Émojis & formes">
            <Smile className="h-3.5 w-3.5" />
          </ToolBtn>
          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
              <div className="absolute z-50 mt-1 right-0 w-72 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg p-2">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.label} className="mb-2 last:mb-0">
                    <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-1">{group.label}</p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {group.items.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          className="h-7 w-7 rounded hover:bg-muted text-lg leading-none flex items-center justify-center"
                          onClick={() => {
                            editor.chain().focus().insertContent(emo).run();
                            setEmojiOpen(false);
                          }}
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative">
        {placeholder && !editor.getText() && !editor.isActive('image') && (
          <p className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
