import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ensureKatex, type Katex } from '../../services/markdown/katex.js'

/** renderToString 外层包裹的标签，组件自己渲染外层，这里切掉 */
const KATEX_WRAPPER = {
  inline: ['<span class="katex">', '</span>'],
  display: ['<span class="katex-display"><span class="katex">', '</span></span>'],
} as const

type MathHtmlResult = {
  html: string
  renderMode: 'katex' | 'fallback'
}

const noop = () => {}

/** 清掉可能残留的 \[ \] / \( \) 定界符。 */
const cleanMath = (input: string): string => {
  let value = input.trim()
  if (value.endsWith('\\]')) {
    value = value.slice(0, -2).trim()
  } else if (value.endsWith('\\)')) {
    value = value.slice(0, -2).trim()
  }
  return value
}

/** KaTeX 渲染公式；出错时保留上次成功的结果（流式中公式未写完），没有则展示原文 */
const useMathHtml = (input: string, isInline: boolean): MathHtmlResult => {
  const previousResultRef = useRef<MathHtmlResult | null>(null)
  const katexRef = useRef(ensureKatex())
  const [katex, setKatex] = useState<Katex | null>(
    katexRef.current instanceof Promise ? null : katexRef.current
  )

  useEffect(() => {
    if (katexRef.current instanceof Promise) {
      katexRef.current.then(setKatex, noop)
    }
  }, [])

  return useMemo((): MathHtmlResult => {
    const value = cleanMath(input)
    if (!katex) {
      return { html: value, renderMode: 'fallback' }
    }
    try {
      const [prefix, suffix] = KATEX_WRAPPER[isInline ? 'inline' : 'display']
      const html = katex
        .renderToString(value, { throwOnError: true, strict: false, displayMode: !isInline })
        .slice(prefix.length, -suffix.length)
      const result = { html, renderMode: 'katex' } as const
      previousResultRef.current = result
      return result
    } catch {
      return previousResultRef.current ?? { html: value, renderMode: 'fallback' }
    }
  }, [input, isInline, katex])
}

export const MathBlock = memo(function MathBlock({ value }: { value: string }) {
  const { html, renderMode } = useMathHtml(value, false)
  if (renderMode === 'fallback') {
    return (
      <pre className="ds-markdown-math-fallback">
        <code>{html}</code>
      </pre>
    )
  }
  return (
    <span className="katex-display ds-markdown-math">
      <span className="katex" dangerouslySetInnerHTML={{ __html: html }}></span>
    </span>
  )
})

export const InlineMath = memo(function InlineMath({ value }: { value: string }) {
  const { html, renderMode } = useMathHtml(value, true)
  if (renderMode === 'fallback') {
    return <code className="ds-markdown-inline-math-fallback">{html}</code>
  }
  return <span className="katex" dangerouslySetInnerHTML={{ __html: html }}></span>
})
