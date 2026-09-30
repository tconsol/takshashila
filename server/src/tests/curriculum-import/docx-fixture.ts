import { deflateRawSync } from 'zlib';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildDocx(paras: { style?: string; text: string }[]): Buffer {
  const body = paras
    .map((p) => `<w:p>${p.style ? `<w:pPr><w:pStyle w:val="${p.style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${esc(p.text)}</w:t></w:r></w:p>`)
    .join('');
  const xml = Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`, 'utf8');
  const data = deflateRawSync(xml);
  const name = Buffer.from('word/document.xml');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);

  const centralStart = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(centralStart, 16);

  return Buffer.concat([local, name, data, central, name, end]);
}
