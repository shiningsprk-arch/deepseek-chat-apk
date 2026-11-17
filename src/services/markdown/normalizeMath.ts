/**
 * micromark-extension-llm-math 的反斜杠定界符会被 markdown 的转义先吃掉，
 * 这里把单反斜杠的 \(...\) / \[...\] 转成 $ / $$ 形式。
 * - 多行或独占一行的 \[...\] 转成块级 $$，并保证定界符独占一行
 * - 行内 \[...\] / \(...\) 转成行内 $
 * - 相邻的两个行内公式之间插入零宽空格，避免拼成 $$
 * - 跳过 fenced code 与行内 code
 */

const MATH = /(?<!\\)\\\[([\s\S]*?)\\\]|(?<!\\)\\\(([\s\S]*?)\\\)/g
const FENCED_CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g
const INLINE_CODE = /(`+[^`]*`+)/g

const normalizeChunk = (chunk: string): string => {
  let lastEnd = -1
  let lastInline = false
  return chunk.replace(
    MATH,
    (
      match,
      bracketBody: string | undefined,
      parenBody: string | undefined,
      offset: number,
      whole: string
    ) => {
      const body = (parenBody ?? bracketBody ?? '').trim()
      const before = offset === 0 ? '\n' : whole[offset - 1]
      const afterIndex = offset + match.length
      const after = afterIndex >= whole.length ? '\n' : whole[afterIndex]
      const standalone =
        (before === '\n' || before === '\r') && (after === '\n' || after === '\r')
      const block =
        parenBody === undefined && (standalone || (bracketBody ?? '').includes('\n'))
      const inline = !block
      const adjacent = inline && lastInline && offset === lastEnd
      lastEnd = offset + match.length
      lastInline = inline
      const text = block ? `\n$$\n${body}\n$$\n` : `$${body}$`
      return `${adjacent ? '\u200B' : ''}${text}`
    }
  )
}

export const normalizeMath = (input: string): string =>
  input
    .split(FENCED_CODE)
    .map((part, index) => {
      if (index % 2 === 1) {
        return part
      }
      return part
        .split(INLINE_CODE)
        .map((piece, pieceIndex) => (pieceIndex % 2 === 1 ? piece : normalizeChunk(piece)))
        .join('')
    })
    .join('')
