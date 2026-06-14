/**
 * Minimal dependency-free XML parser — enough for Gating-ML 2.0 / FlowJo wsp
 * import (elements, namespaced attributes, nesting, self-closing tags). Not a
 * general/streaming XML engine: attribute values must not contain `>` and there
 * is no entity expansion beyond the basics. For untrusted/complex XML, swap in a
 * real parser behind the same XmlNode shape.
 */
export interface XmlNode {
  /** Tag name including any namespace prefix, e.g. "gating:RectangleGate". */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
};
function decode(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.\-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    attrs[m[1]] = decode(m[3] ?? m[4] ?? "");
  }
  return attrs;
}

export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const tagRe = /<([^>]+)>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(src)) !== null) {
    // Text between the previous tag and this one.
    const text = src.slice(lastIndex, m.index).trim();
    if (text) stack[stack.length - 1].text += decode(text);
    lastIndex = tagRe.lastIndex;

    let tag = m[1].trim();
    if (tag.startsWith("?") || tag.startsWith("!")) continue; // <?xml?>, <!-- -->, <!DOCTYPE>

    if (tag.startsWith("/")) {
      stack.pop(); // close
      continue;
    }
    const selfClosing = tag.endsWith("/");
    if (selfClosing) tag = tag.slice(0, -1).trim();

    const sp = tag.search(/\s/);
    const name = sp === -1 ? tag : tag.slice(0, sp);
    const attrs = sp === -1 ? {} : parseAttrs(tag.slice(sp + 1));
    const node: XmlNode = { name, attrs, children: [], text: "" };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

/** Local name without namespace prefix. */
export function localName(name: string): string {
  const i = name.indexOf(":");
  return i === -1 ? name : name.slice(i + 1);
}

/** First attribute whose local name matches (namespace-prefix agnostic). */
export function attrLocal(node: XmlNode, local: string): string | undefined {
  for (const k of Object.keys(node.attrs)) {
    if (localName(k) === local) return node.attrs[k];
  }
  return undefined;
}

/** Direct children with the given local element name. */
export function childrenLocal(node: XmlNode, local: string): XmlNode[] {
  return node.children.filter((c) => localName(c.name) === local);
}
