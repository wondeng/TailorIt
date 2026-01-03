import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export type DocxTextNode = {
  start: number;
  end: number;
  text: string;
};

export type ParsedDocx = {
  files: Record<string, Uint8Array>;
  documentXmlPath: string;
  documentXml: string;
  nodes: DocxTextNode[];
  plainText: string;
};

export type ReplaceOp = {
  find: string;
  replace: string;
};

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function encodeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractTextNodes(documentXml: string): DocxTextNode[] {
  const nodes: DocxTextNode[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(documentXml))) {
    const full = m[0];
    const inner = m[1] ?? "";

    const openTagEnd = full.indexOf(">") + 1;
    const innerStart = m.index + openTagEnd;
    const innerEnd = innerStart + inner.length;

    nodes.push({
      start: innerStart,
      end: innerEnd,
      text: decodeXmlText(inner),
    });
  }
  return nodes;
}

export function parseDocx(bytes: ArrayBuffer): ParsedDocx {
  const files = unzipSync(new Uint8Array(bytes)) as Record<string, Uint8Array>;
  const documentXmlPath = "word/document.xml";

  const docFile = files[documentXmlPath];
  if (!docFile) throw new Error("Invalid .docx: missing word/document.xml");

  const documentXml = strFromU8(docFile);
  const nodes = extractTextNodes(documentXml);
  const plainText = nodes.map((n) => n.text).join("");

  return { files, documentXmlPath, documentXml, nodes, plainText };
}

export function applyReplacements(parsed: ParsedDocx, ops: ReplaceOp[]): ParsedDocx {
  let xml = parsed.documentXml;

  // copy nodes so we can update text
  const updatedNodes = parsed.nodes.map((n) => ({ ...n }));

  for (const op of ops) {
    const find = op.find?.trim();
    if (!find) continue;

    // default: case-insensitive replacement within each node
    const findLower = find.toLowerCase();

    for (const node of updatedNodes) {
      const t = node.text;
      const idx = t.toLowerCase().indexOf(findLower);
      if (idx !== -1) {
        node.text = t.slice(0, idx) + op.replace + t.slice(idx + find.length);
      }
    }
  }

  // rewrite from back -> front to preserve indices
  for (let i = updatedNodes.length - 1; i >= 0; i--) {
    const n = updatedNodes[i];
    const encoded = encodeXmlText(n.text);
    xml = xml.slice(0, n.start) + encoded + xml.slice(n.end);
  }

  return {
    ...parsed,
    documentXml: xml,
    nodes: updatedNodes,
    plainText: updatedNodes.map((n) => n.text).join(""),
  };
}

export function buildDocx(parsed: ParsedDocx): Uint8Array {
  const files = { ...parsed.files };
  files[parsed.documentXmlPath] = strToU8(parsed.documentXml);
  return zipSync(files, { level: 6 });
}
export function downloadDocx(bytes: Uint8Array, filename: string) {
  // Force a real ArrayBuffer by copying
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);

  const blob = new Blob([ab], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

