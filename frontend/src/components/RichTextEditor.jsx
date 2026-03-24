import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect, useRef } from 'react';

const MenuButton = ({ active, onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`px-1.5 py-1 rounded text-xs font-medium transition-colors ${
      active ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

export default function RichTextEditor({ value, onChange, label }) {
  const suppressUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-accent underline' } }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      if (suppressUpdate.current) return;
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. AI rewrite)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (value !== current) {
      suppressUpdate.current = true;
      editor.commands.setContent(value || '', false);
      suppressUpdate.current = false;
    }
  }, [value, editor]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('URL du lien :', editor.getAttributes('link').href || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div>
      {label && <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>}
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-accent/30">
        <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 border-b border-gray-200">
          <MenuButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
            <strong>B</strong>
          </MenuButton>
          <MenuButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
            <em>I</em>
          </MenuButton>
          <MenuButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
            <s>S</s>
          </MenuButton>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <MenuButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste">
            &bull;
          </MenuButton>
          <MenuButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
            1.
          </MenuButton>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <MenuButton active={editor.isActive('link')} onClick={addLink} title="Lien">
            🔗
          </MenuButton>
        </div>
        <EditorContent editor={editor} className="tiptap-editor prose prose-sm max-w-none px-2.5 py-1.5 text-xs min-h-[3rem]" />
      </div>
    </div>
  );
}
