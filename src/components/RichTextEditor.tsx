import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Node, mergeAttributes } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import {
  Bold,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Custom node for dashed horizontal rule
const DashedHorizontalRule = Node.create({
  name: 'dashedHorizontalRule',
  group: 'block',
  parseHTML() {
    return [{ tag: 'hr[data-type="dashed"]' }];
  },
  renderHTML() {
    return ['hr', mergeAttributes({ 'data-type': 'dashed', class: 'dashed' })];
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: {},
        italic: {},
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['paragraph'] }),
      DashedHorizontalRule,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'rich-editor-content min-h-[140px] px-3 py-2 text-sm focus:outline-none',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sync when opening a different item in EditDialog
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  const toolbarBtn = (active: boolean) =>
    cn(
      'h-7 w-7 p-0 rounded',
      active
        ? 'bg-foreground text-background'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    );

  const currentColor: string = editor.getAttributes('textStyle').color ?? '#6b7280';

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 px-2 py-1.5">

        {/* Bold */}
        <Button
          type="button"
          variant="ghost"
          className={toolbarBtn(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>

        {/* Underline */}
        <Button
          type="button"
          variant="ghost"
          className={toolbarBtn(editor.isActive('underline'))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text color */}
        <div className="relative" title="Couleur du texte">
          <Button
            type="button"
            variant="ghost"
            className={toolbarBtn(false)}
            onClick={() => colorInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-px">
              <Palette className="h-3.5 w-3.5" />
              <span
                className="h-1 w-4 rounded-full"
                style={{ backgroundColor: currentColor }}
              />
            </div>
          </Button>
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            defaultValue="#000000"
            onInput={(e) => {
              editor.chain().focus().setColor((e.target as HTMLInputElement).value).run();
            }}
          />
        </div>

        {/* Reset color */}
        <Button
          type="button"
          variant="ghost"
          className={cn(toolbarBtn(false), 'w-auto px-1.5 text-xs font-semibold')}
          onClick={() => editor.chain().focus().unsetColor().run()}
          title="Couleur par défaut"
        >
          A
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Align left */}
        <Button
          type="button"
          variant="ghost"
          className={toolbarBtn(editor.isActive({ textAlign: 'left' }))}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Aligner à gauche"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Align center */}
        <Button
          type="button"
          variant="ghost"
          className={toolbarBtn(editor.isActive({ textAlign: 'center' }))}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Centrer"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>

        {/* Align right */}
        <Button
          type="button"
          variant="ghost"
          className={toolbarBtn(editor.isActive({ textAlign: 'right' }))}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Aligner à droite"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Solid separator */}
        <Button
          type="button"
          variant="ghost"
          className={cn(toolbarBtn(false), 'w-auto px-2 gap-1 text-xs')}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Ligne pleine"
        >
          <Minus className="h-3.5 w-3.5" />
          <span className="font-medium">—</span>
        </Button>

        {/* Dashed separator */}
        <Button
          type="button"
          variant="ghost"
          className={cn(toolbarBtn(false), 'w-auto px-2 gap-1 text-xs')}
          onClick={() =>
            editor.chain().focus().insertContent({ type: 'dashedHorizontalRule' }).run()
          }
          title="Ligne pointillée"
        >
          <Minus className="h-3.5 w-3.5" />
          <span className="font-medium tracking-widest">···</span>
        </Button>
      </div>

      {/* Editor area */}
      <div className="relative bg-background">
        {placeholder && !editor.getText() && (
          <p className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
