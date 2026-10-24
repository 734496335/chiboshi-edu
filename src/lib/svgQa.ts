/**
 * SVG 质检流水线
 *
 * 灵感来自 Claude Skill `premium-vector-icon-designer`：当 AI（MiMo）输出
 * SVG 简笔画时，跑一道**结构性 + 视觉性**的检查，过不了的提示问题让模型重画。
 *
 * 检查项（可在代码里调阈值）：
 *   structure  – 必须有 <svg> 根，含 viewBox，width/height 合理
 *   purity     – 不允许 <text>/<image>/<foreignObject>/<style>/style 属性
 *   stroke     – 所有可见图元必须有 stroke，没有就是隐形（白板上看不到）
 *   no-fill    – fill 必须为 none 或干脆不写（避免出现实心方块）
 *   path-count – path/line/rect/circle/ellipse 总数应在 [1, 20]
 *   path-len   – 单个 d 字符串不要太长（>800 字符通常意味着把所有线连成一条）
 *   compactness– 整张 SVG 字节数 ≤ 4 KB（简笔画不应庞大）
 *
 * 返回 issues 数组，长度 0 即通过。
 */

export interface SvgIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface SvgQaResult {
  pass: boolean;
  issues: SvgIssue[];
  /** 调试用：解析到的关键统计信息 */
  stats: {
    bytes: number;
    pathCount: number;
    maxPathLen: number;
    hasViewBox: boolean;
    hasFill: boolean;
    hasStroke: boolean;
  };
}

const MAX_BYTES = 4096;
const MAX_PATH_COUNT = 20;
const MIN_PATH_COUNT = 1;
const MAX_SINGLE_PATH_LEN = 800;
const FORBIDDEN_TAGS = [
  "text",
  "image",
  "foreignObject",
  "style",
  "tspan",
  "symbol",
  "use",
];

export function validateSvg(svg: string): SvgQaResult {
  const issues: SvgIssue[] = [];
  const stats = {
    bytes: svg.length,
    pathCount: 0,
    maxPathLen: 0,
    hasViewBox: false,
    hasStroke: false,
    hasFill: false,
  };

  // 1) structure
  const rootMatch = svg.match(/<svg\b([^>]*)>/i);
  if (!rootMatch) {
    issues.push({
      code: "structure",
      message: "找不到 <svg> 根元素",
      severity: "error",
    });
    return { pass: false, issues, stats };
  }
  const rootAttrs = rootMatch[1] ?? "";
  stats.hasViewBox = /\bviewBox=/i.test(rootAttrs);
  if (!stats.hasViewBox) {
    issues.push({
      code: "structure-viewbox",
      message: "<svg> 缺 viewBox 属性，将无法等比缩放",
      severity: "error",
    });
  }
  stats.hasStroke = /\bstroke=(?!"none")/i.test(rootAttrs) || /\bstroke=/i.test(svg);
  if (!stats.hasStroke) {
    issues.push({
      code: "stroke-missing",
      message: "整张图找不到任何 stroke——白板上看不见",
      severity: "error",
    });
  }

  // 2) purity：禁止 <text>、<image> 等
  for (const tag of FORBIDDEN_TAGS) {
    const re = new RegExp(`<\\s*${tag}\\b`, "i");
    if (re.test(svg)) {
      issues.push({
        code: `forbidden-tag-${tag}`,
        message: `禁止出现 <${tag}> 标签`,
        severity: "error",
      });
    }
  }

  // 3) no-fill：除了 fill="none" 或不写，其他实心填充都拒
  // 允许 fill="none"、fill="transparent"、不写 fill；其他都标 warning
  const fillMatches = svg.match(/\bfill="([^"]*)"/gi) || [];
  const badFill = fillMatches.find((m) => {
    const v = m.slice(6, -1).toLowerCase();
    return v && v !== "none" && v !== "transparent" && v !== "currentcolor";
  });
  if (badFill) {
    stats.hasFill = true;
    issues.push({
      code: "fill-not-none",
      message: `检测到实心填充 ${badFill}，简笔画应该 fill="none"`,
      severity: "warning",
    });
  }

  // 4) path-count + path-len
  const pathDs: string[] = [];
  const pathRe = /<path\b[^>]*\bd="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(svg)) !== null) pathDs.push(m[1]);

  const lineCount = (svg.match(/<line\b/gi) || []).length;
  const rectCount = (svg.match(/<rect\b/gi) || []).length;
  const circleCount = (svg.match(/<circle\b/gi) || []).length;
  const ellipseCount = (svg.match(/<ellipse\b/gi) || []).length;
  const polyCount = (svg.match(/<(polyline|polygon)\b/gi) || []).length;

  stats.pathCount =
    pathDs.length + lineCount + rectCount + circleCount + ellipseCount + polyCount;
  stats.maxPathLen = pathDs.reduce((a, b) => Math.max(a, b.length), 0);

  if (stats.pathCount < MIN_PATH_COUNT) {
    issues.push({
      code: "path-too-few",
      message: "图元数为 0，没画东西",
      severity: "error",
    });
  } else if (stats.pathCount > MAX_PATH_COUNT) {
    issues.push({
      code: "path-too-many",
      message: `图元 ${stats.pathCount} 个，超过 ${MAX_PATH_COUNT}（线条太碎，画面会糊）`,
      severity: "warning",
    });
  }
  if (stats.maxPathLen > MAX_SINGLE_PATH_LEN) {
    issues.push({
      code: "path-too-long",
      message: `单条 path 长度 ${stats.maxPathLen} 字符，超过 ${MAX_SINGLE_PATH_LEN}（多条线被压成一串，无法二次编辑）`,
      severity: "warning",
    });
  }

  // 5) compactness
  if (stats.bytes > MAX_BYTES) {
    issues.push({
      code: "too-large",
      message: `SVG 体积 ${stats.bytes} 字节，超过 ${MAX_BYTES}`,
      severity: "warning",
    });
  }

  // pass = 无 error
  const hasError = issues.some((i) => i.severity === "error");
  return { pass: !hasError, issues, stats };
}

/**
 * 把 issues 转成给 LLM 的"修订指令"——下一次重画时贴在 user prompt 里。
 */
export function issuesToFeedback(issues: SvgIssue[]): string {
  if (issues.length === 0) return "";
  return [
    "上一次输出有这些问题，请修正后重画：",
    ...issues.map((i) => `- [${i.severity}] ${i.message}`),
  ].join("\n");
}
