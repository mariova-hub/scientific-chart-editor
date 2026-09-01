import { describe, expect, it } from 'vitest'
import { parseCell, parseTsv, TsvParseError } from '../src/data/tsv/parseTsv'
import { sequentialIds } from './helpers'

describe('TSV parser', () => {
  it('parses a normal table and treats the first row as headers', () => {
    const dataset = parseTsv('X\tY\n1\t2\n3\t4', sequentialIds())
    expect(dataset.columns.map((column) => column.name)).toEqual(['X', 'Y'])
    expect(dataset.rows).toHaveLength(2)
  })

  it('parses complete finite numeric cells as numbers', () => {
    expect(parseCell('  -1.25e2 ')).toBe(-125)
    expect(parseCell('.5')).toBe(0.5)
    expect(parseCell('+3.')).toBe(3)
  })

  it('keeps nonnumeric cells as strings without trimming their content', () => {
    expect(parseCell(' sample ')).toBe(' sample ')
    expect(parseCell('2026-09-01')).toBe('2026-09-01')
  })

  it('stores empty and whitespace-only cells as null', () => {
    expect(parseCell('')).toBeNull()
    expect(parseCell('   ')).toBeNull()
  })

  it('normalizes CRLF line endings', () => {
    const dataset = parseTsv('X\tY\r\n1\t2\r\n3\t4\r\n', sequentialIds())
    expect(dataset.rows).toHaveLength(2)
  })

  it('keeps an interior empty row as null cells', () => {
    const dataset = parseTsv('X\tY\n1\t2\n\n3\t4', sequentialIds())
    expect(dataset.rows).toHaveLength(3)
    expect(Object.values(dataset.rows[1].cells)).toEqual([null, null])
  })

  it('ignores trailing empty lines added by clipboard text', () => {
    const dataset = parseTsv('X\tY\n1\t2\n\n', sequentialIds())
    expect(dataset.rows).toHaveLength(1)
  })

  it('keeps NaN, Infinity, hexadecimal, and partial numbers as strings', () => {
    expect(parseCell('NaN')).toBe('NaN')
    expect(parseCell('Infinity')).toBe('Infinity')
    expect(parseCell('0x10')).toBe('0x10')
    expect(parseCell('12px')).toBe('12px')
  })

  it('pads short rows and rejects rows wider than the header', () => {
    const dataset = parseTsv('X\tY\n1', sequentialIds())
    expect(Object.values(dataset.rows[0].cells)).toEqual([1, null])
    expect(() => parseTsv('X\n1\t2', sequentialIds())).toThrow(TsvParseError)
  })
})
