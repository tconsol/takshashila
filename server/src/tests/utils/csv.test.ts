import { toCsv } from '../../utils/csv';

describe('toCsv', () => {
  const columns = [
    { key: 'name' as const, header: 'Name' },
    { key: 'note' as const, header: 'Note' },
  ];

  const BOM = String.fromCharCode(0xfeff);

  function bodyOf(csv: string): string[] {
    // Drop the UTF-8 BOM and the header row.
    return csv.slice(csv.startsWith(BOM) ? 1 : 0).split('\r\n').slice(1);
  }

  it('emits a BOM and CRLF line endings', () => {
    const csv = toCsv([{ name: 'Ada', note: 'ok' }], columns);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain('\r\n');
  });

  it('quotes fields containing a comma, quote or newline', () => {
    const csv = toCsv(
      [
        { name: 'Doe, Jane', note: 'said "hi"' },
        { name: 'multi', note: 'line\nbreak' },
      ],
      columns,
    );
    const body = bodyOf(csv);
    expect(body[0]).toBe('"Doe, Jane","said ""hi"""');
    expect(body[1]).toContain('"line\nbreak"');
  });

  it('neutralises formula injection by prefixing risky leading characters', () => {
    const rows = [
      { name: '=1+1', note: 'x' },
      { name: '+cmd', note: 'x' },
      { name: '-cmd', note: 'x' },
      { name: '@SUM(A1)', note: 'x' },
    ];
    const body = bodyOf(toCsv(rows, columns));

    expect(body[0]).toMatch(/^'=1\+1/);
    expect(body[1]).toMatch(/^'\+cmd/);
    expect(body[2]).toMatch(/^'-cmd/);
    expect(body[3]).toMatch(/^'@SUM\(A1\)/);
  });

  it('renders null and undefined as empty cells', () => {
    const body = bodyOf(
      toCsv([{ name: null as unknown as string, note: undefined as unknown as string }], columns),
    );
    expect(body[0]).toBe(',');
  });

  it('serialises dates as ISO strings and objects as JSON', () => {
    const when = new Date('2026-01-02T03:04:05.000Z');
    const body = bodyOf(
      toCsv(
        [{ name: when as unknown as string, note: { a: 1 } as unknown as string }],
        columns,
      ),
    );
    expect(body[0]).toContain('2026-01-02T03:04:05.000Z');
    expect(body[0]).toContain('{""a"":1}');
  });

  it('applies a column formatter when given', () => {
    const csv = toCsv([{ cents: 12_34 }], [
      { key: 'cents' as const, header: 'Amount', format: (v) => `$${(Number(v) / 100).toFixed(2)}` },
    ]);
    expect(bodyOf(csv)[0]).toBe('$12.34');
  });
});
