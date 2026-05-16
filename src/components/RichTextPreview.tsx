import sanitizeHtml from "sanitize-html";

// Erlaubte Tags und Attribute entsprechen dem, was der Rich-Text-Editor (@uiw/react-md-editor)
// produzieren kann. Skripte, Event-Handler und gefährliche Attribute sind ausgeschlossen.
const ALLOWED_TAGS = [
  // Struktur
  "p", "div", "span", "br", "hr",
  // Überschriften
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Listen
  "ul", "ol", "li",
  // Typografie
  "strong", "b", "em", "i", "u", "s", "del", "mark",
  // Code
  "code", "pre", "kbd",
  // Zitate & Blöcke
  "blockquote",
  // Links (ohne javascript:)
  "a",
  // Tabellen
  "table", "thead", "tbody", "tr", "th", "td",
  // Bilder (src nur https oder data:image)
  "img",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["class"],
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

// Zusätzliche Absicherung: a[href] darf kein javascript: enthalten
function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: {
      img: ["https", "data"],
    },
    transformTags: {
      // Externe Links immer in neuem Tab öffnen und rel="noopener noreferrer" setzen
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.href?.startsWith("http") && {
            target: "_blank",
            rel: "noopener noreferrer",
          }),
        },
      }),
    },
  });
}

type Props = { html: string; className?: string };

export function RichTextPreview({ html, className }: Props) {
  const safe = sanitize(html);
  return (
    <div
      className={["rich-content", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
