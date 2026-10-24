"use client";
/* ════════════════════════════════════════════════════════════════════════
   时间维度可视化：秒表 / 时钟 / 日历 三段式
   ──────────────────────────────────────────────────────────────────────
   分桶（按物品时长 seconds）：
     < 60 秒      → 秒表（codepen Kaitlyn Stahl 的 SVG）
     60 秒 ~ 1 天 → 时钟（暖色卡通 SVG，时针+分针）
     ≥ 1 天       → 日历（TODO 占位）

   动画速度：**最长项**以 SLOWEST_DUR 秒走完一轮（loopDur = 8s），
   其它项严格按 size 比例线性缩短：duration = SLOWEST_DUR × (size / maxSize)；
   极短项保底 MIN_DUR 防止"几乎不动"。所有项共享 rAF 时钟，到 loopDur 统一复位重播。

   布局：每个 item 占一列（vizSize 宽）
     上半行：名字 pill + 数值
     下半行：对应的可视化
   ════════════════════════════════════════════════════════════════════════ */
import * as React from "react";

export interface TimeVizItem {
  key: string;
  label: string;
  size: number; // seconds
  sizeDisplay: string;
  isTarget: boolean;
}

function bucketForSeconds(s: number): "stopwatch" | "clock" | "calendar" {
  if (s < 60) return "stopwatch";
  if (s < 86400) return "clock";
  return "calendar";
}

// ───────────────────────── 秒表 ─────────────────────────
// SVG 模板：__UID__ 占位符在每个实例运行时替换为唯一前缀，避免 defs ID 冲突。
const STOPWATCH_SVG_TEMPLATE = `<svg viewBox="0 0 155 208" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:100%;display:block;overflow:visible">
  <defs>
    <path d="M9.4,14.6666667 L28.8333333,14.6666667 C29.9379028,14.6666667 30.8333333,15.5620972 30.8333333,16.6666667 L30.8333333,31 C30.8333333,32.1045695 29.9379028,33 28.8333333,33 L9.4,33 C8.2954305,33 7.4,32.1045695 7.4,31 L7.4,16.6666667 C7.4,15.5620972 8.2954305,14.6666667 9.4,14.6666667 Z" id="__UID__-p1"></path>
    <filter x="-19.2%" y="-24.5%" width="138.4%" height="149.1%" filterUnits="objectBoundingBox" id="__UID__-f2"><feOffset dx="-6" dy="-9" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.812 0 0 0 0 0.812 0 0 0 0 0.812 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <rect id="__UID__-p3" x="0" y="0" width="37" height="18.3333333" rx="2"></rect>
    <filter x="-12.2%" y="-24.5%" width="124.3%" height="149.1%" filterUnits="objectBoundingBox" id="__UID__-f4"><feOffset dx="-6" dy="-9" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.812 0 0 0 0 0.812 0 0 0 0 0.812 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <path d="M9.42325581,2.12560386 L28.9302326,2.12560386 C30.0348021,2.12560386 30.9302326,3.02103437 30.9302326,4.12560386 L30.9302326,18 C30.9302326,19.1045695 30.0348021,20 28.9302326,20 L9.42325581,20 C8.31868631,20 7.42325581,19.1045695 7.42325581,18 L7.42325581,4.12560386 C7.42325581,3.02103437 8.31868631,2.12560386 9.42325581,2.12560386 Z" id="__UID__-p5"></path>
    <filter x="-19.1%" y="-25.2%" width="138.3%" height="150.4%" filterUnits="objectBoundingBox" id="__UID__-f6"><feOffset dx="-6" dy="-9" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.812 0 0 0 0 0.812 0 0 0 0 0.812 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <path d="M6.39576918,0.747236094 L31.5120482,0.747236094 C34.8257567,0.747236094 37.5120482,3.4335276 37.5120482,6.74723609 L37.5120482,12.6216322 C37.5120482,15.9353407 34.8257567,18.6216322 31.5120482,18.6216322 L6.39576918,18.6216322 C3.08206068,18.6216322 0.39576918,15.9353407 0.39576918,12.6216322 L0.39576918,6.74723609 C0.39576918,3.4335276 3.08206068,0.747236094 6.39576918,0.747236094 Z" id="__UID__-p7"></path>
    <filter x="-12.1%" y="-25.2%" width="124.2%" height="150.4%" filterUnits="objectBoundingBox" id="__UID__-f8"><feOffset dx="-6" dy="-9" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.810 0 0 0 0 0.200 0 0 0 0 0.275 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <ellipse id="__UID__-p9" cx="75.5" cy="76" rx="75.5" ry="76"></ellipse>
    <filter x="-9.6%" y="-9.5%" width="119.2%" height="119.1%" filterUnits="objectBoundingBox" id="__UID__-f10"><feOffset dx="-26" dy="-26" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.192 0 0 0 0 0.525 0 0 0 0 0.737 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <ellipse id="__UID__-p11" cx="75.9389535" cy="76.4418605" rx="63.6482558" ry="64.0697674"></ellipse>
    <filter x="-3.9%" y="-3.9%" width="107.9%" height="107.8%" filterUnits="objectBoundingBox" id="__UID__-f12"><feOffset dx="-7" dy="-7" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.856 0 0 0 0 0.856 0 0 0 0 0.856 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <path d="M68.5721689,82.9737108 L110.707425,40.5594133" id="__UID__-p13"></path>
    <filter x="-9.0%" y="-7.4%" width="116.4%" height="116.3%" filterUnits="objectBoundingBox" id="__UID__-f14"><feOffset dx="-5" dy="-5" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.192 0 0 0 0 0.525 0 0 0 0 0.737 0 0 0 1 0" type="matrix" in="si1"/></filter>
    <ellipse id="__UID__-p15" cx="75.9389535" cy="76.4418605" rx="4.82848837" ry="4.86046512"></ellipse>
    <filter x="-36.2%" y="-36.0%" width="172.5%" height="172.0%" filterUnits="objectBoundingBox" id="__UID__-f16"><feOffset dx="-4" dy="-4" in="SourceAlpha" result="so1"/><feComposite in="so1" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="si1"/><feColorMatrix color-interpolation-filters="sRGB" values="0 0 0 0 0.192 0 0 0 0 0.525 0 0 0 0 0.737 0 0 0 1 0" type="matrix" in="si1"/></filter>
  </defs>
  <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
    <g transform="translate(2,2)" fill-rule="nonzero">
      <path d="M76.5,55 C61.3121694,55 49,42.6878306 49,27.5 C49,12.3121694 61.3121694,0 76.5,0 C91.6878306,0 104,12.3121694 104,27.5 C104,42.6878306 91.6878306,55 76.5,55 Z M76.5,48 C87.8218374,48 97,38.8218374 97,27.5 C97,16.1781626 87.8218374,7 76.5,7 C65.1781626,7 56,16.1781626 56,27.5 C56,38.8218374 65.1781626,48 76.5,48 Z" stroke="#124458" stroke-width="3" fill="#D8D8D8" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(57,28)">
        <g>
          <use fill="#E8E8E8" xlink:href="#__UID__-p1"/>
          <use fill="black" fill-opacity="1" filter="url(#__UID__-f2)" xlink:href="#__UID__-p1"/>
          <path stroke="#124458" stroke-width="3" d="M9.4,16.1666667 C9.12385763,16.1666667 8.9,16.3905243 8.9,16.6666667 L8.9,31 C8.9,31.2761424 9.12385763,31.5 9.4,31.5 L28.8333333,31.5 C29.1094757,31.5 29.3333333,31.2761424 29.3333333,31 L29.3333333,16.6666667 C29.3333333,16.3905243 29.1094757,16.1666667 28.8333333,16.1666667 L9.4,16.1666667 Z" stroke-linejoin="square"/>
        </g>
        <g>
          <use fill="#E8E8E8" xlink:href="#__UID__-p3"/>
          <use fill="black" fill-opacity="1" filter="url(#__UID__-f4)" xlink:href="#__UID__-p3"/>
          <rect stroke="#124458" stroke-width="3" stroke-linejoin="square" x="1.5" y="1.5" width="34" height="15.3333333" rx="2"/>
        </g>
        <g transform="translate(6.166667,1.783784)" stroke="#124458" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
          <path d="M1.87781955,0.624324324 L1.87781955,5.61891892"/>
          <path d="M7.76981857,0.624324324 L7.76981857,5.61891892"/>
          <path d="M15.2810968,0.624324324 L15.2810968,5.61891892"/>
          <path d="M22.792375,0.624324324 L22.792375,5.61891892"/>
        </g>
        <g transform="translate(6.166667,12.486486)" stroke="#124458" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
          <path d="M1.87781955,0.535135135 L1.87781955,4.81621622"/>
          <path d="M7.82424812,0.535135135 L7.82424812,4.81621622"/>
          <path d="M15.3355263,0.535135135 L15.3355263,4.81621622"/>
          <path d="M22.8468045,0.535135135 L22.8468045,4.81621622"/>
        </g>
      </g>
      <g class="button">
        <g transform="translate(133,72) rotate(44) translate(-133,-72) translate(114,62)">
          <g>
            <use fill="#E8E8E8" xlink:href="#__UID__-p5"/>
            <use fill="black" fill-opacity="1" filter="url(#__UID__-f6)" xlink:href="#__UID__-p5"/>
            <path stroke="#124458" stroke-width="3" d="M9.42325581,3.62560386 C9.14711344,3.62560386 8.92325581,3.84946149 8.92325581,4.12560386 L8.92325581,18 C8.92325581,18.2761424 9.14711344,18.5 9.42325581,18.5 L28.9302326,18.5 C29.2063749,18.5 29.4302326,18.2761424 29.4302326,18 L29.4302326,4.12560386 C29.4302326,3.84946149 29.2063749,3.62560386 28.9302326,3.62560386 L9.42325581,3.62560386 Z" stroke-linejoin="square"/>
          </g>
          <g>
            <use fill="#FF5963" xlink:href="#__UID__-p7"/>
            <use fill="black" fill-opacity="1" filter="url(#__UID__-f8)" xlink:href="#__UID__-p7"/>
            <path stroke="#124458" stroke-width="3" d="M6.39576918,2.24723609 C3.91048781,2.24723609 1.89576918,4.26195472 1.89576918,6.74723609 L1.89576918,12.6216322 C1.89576918,15.1069136 3.91048781,17.1216322 6.39576918,17.1216322 L31.5120482,17.1216322 C33.9973296,17.1216322 36.0120482,15.1069136 36.0120482,12.6216322 L36.0120482,6.74723609 C36.0120482,4.26195472 33.9973296,2.24723609 31.5120482,2.24723609 L6.39576918,2.24723609 Z" stroke-linejoin="square"/>
          </g>
        </g>
      </g>
      <g transform="translate(0,52)">
        <g>
          <use fill="#45ADEE" xlink:href="#__UID__-p9"/>
          <use fill="black" fill-opacity="1" filter="url(#__UID__-f10)" xlink:href="#__UID__-p9"/>
          <use stroke="#124458" stroke-width="3" xlink:href="#__UID__-p9"/>
          <use fill="#F6F6F6" xlink:href="#__UID__-p11"/>
          <use fill="black" fill-opacity="1" filter="url(#__UID__-f12)" xlink:href="#__UID__-p11"/>
          <use stroke="#124458" stroke-width="3" xlink:href="#__UID__-p11"/>
          <ellipse fill="#FFFFFF" transform="translate(54.837645,47.762128) rotate(-40) translate(-54.837645,-47.762128)" cx="54.8376446" cy="47.7621279" rx="25.4593023" ry="15.4651163"/>
          <ellipse fill="#FFFFFF" transform="translate(37.311047,86.263018) rotate(-40) translate(-37.311047,-86.263018)" cx="37.3110465" cy="86.2630178" rx="11.7827655" ry="12.6739538"/>
          <path d="M74.622093,20.1649049 L74.622093,13.4164905 M103.661734,27.6663352 L107.035941,21.8220369 M123.496456,47.640592 L129.340754,44.2663848 M130.94556,76.8837209 L137.693975,76.8837209 M123.496456,104.359408 L129.340754,107.733615 M103.661734,125.217386 L107.035941,131.061684 M74.622093,132.718816 L74.622093,139.46723 M47.3382664,125.217386 L43.9640592,131.061684 M27.5035445,104.359408 L21.6592462,107.733615 M20.0544397,76.8837209 L13.3060254,76.8837209 M27.5035445,47.640592 L21.6592462,44.2663848 M47.3382664,27.6663352 L43.9640592,21.8220369" stroke="#124458" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g class="timer">
          <g stroke-linecap="round" stroke-linejoin="round">
            <use fill="#45ADEE" xlink:href="#__UID__-p13"/>
            <use fill="black" fill-opacity="1" filter="url(#__UID__-f14)" xlink:href="#__UID__-p13"/>
            <use stroke="#124458" stroke-width="5" xlink:href="#__UID__-p13"/>
          </g>
          <g stroke-linecap="round" stroke-linejoin="round">
            <use fill="#45ADEE" xlink:href="#__UID__-p15"/>
            <use fill="black" fill-opacity="1" filter="url(#__UID__-f16)" xlink:href="#__UID__-p15"/>
            <use stroke="#124458" stroke-width="3" xlink:href="#__UID__-p15"/>
          </g>
        </g>
      </g>
    </g>
  </g>
</svg>`;

function Stopwatch({
  progress,
  seconds,
  size,
}: {
  progress: number;
  seconds: number;
  size: number;
}) {
  const reactId = React.useId();
  const uid = "sw" + reactId.replace(/[^a-zA-Z0-9]/g, "");
  const html = React.useMemo(
    () => STOPWATCH_SVG_TEMPLATE.replace(/__UID__/g, uid),
    [uid],
  );
  // 1) 原 SVG 中指针默认指向"1:30 方向"（向上 45° 偏右），先偏置 -45° 把它扳到 12 点位置
  // 2) 总扫角用 **立方根映射**：sweep = ∛(seconds/60) × 360°
  //    线性映射下 0.1s = 0.6°（几乎不动）。立方根让短时长也有显眼角度：
  //      0.1s → 42°、0.5s → 73°、1s → 92°、5s → 157°、30s → 285°、60s → 360°
  //    单调递增 → 仍保留"时间越长指针走越远"的直觉；放弃了"30s=半圈"的字面对应
  //    （数字精确性靠上方 pill 显示，视觉传达的是"相对长短"）。
  const r = Math.min(1, Math.max(0, seconds / 60));
  const sweepDeg = Math.cbrt(r) * 360;
  const rotDeg = -45 + progress * sweepDeg;
  return (
    <div
      className="lg-swatch"
      style={{
        width: size,
        height: size,
        ["--swatch-rot" as string]: `${rotDeg}deg`,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ───────────────────────── 时钟 ─────────────────────────
function Clock({
  progress,
  seconds,
  size,
}: {
  progress: number;
  seconds: number;
  size: number;
}) {
  // 一轮动画对应「item.size 秒过去」：
  //   分针总角度 = seconds/60 * 6° = seconds/10
  //   时针总角度 = seconds/3600 * 30° = seconds/120
  const minuteAngle = progress * (seconds / 10);
  const hourAngle = progress * (seconds / 120);

  const R = size / 2;
  const cx = R;
  const cy = R;
  const cream = "#F5E8C8";
  const brown = "#5A3E22";
  const handDark = "#3A2A18";
  const center = "#C84A4A";

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const ang = (i * 30 * Math.PI) / 180;
    const major = i % 3 === 0;
    const inner = R - 4;
    const len = major ? R * 0.16 : R * 0.08;
    const x1 = cx + Math.sin(ang) * inner;
    const y1 = cy - Math.cos(ang) * inner;
    const x2 = cx + Math.sin(ang) * (inner - len);
    const y2 = cy - Math.cos(ang) * (inner - len);
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={brown}
        strokeWidth={major ? 3 : 1.5}
        strokeLinecap="round"
      />
    );
  });

  const fs = R * 0.24;
  const cardinals = [
    { n: 12, x: cx, y: cy - R * 0.6 + fs * 0.35 },
    { n: 3, x: cx + R * 0.62, y: cy + fs * 0.35 },
    { n: 6, x: cx, y: cy + R * 0.62 + fs * 0.35 },
    { n: 9, x: cx - R * 0.62, y: cy + fs * 0.35 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={R - 2}
        fill={cream}
        stroke={brown}
        strokeWidth={3}
      />
      <circle
        cx={cx}
        cy={cy}
        r={R - 10}
        fill="none"
        stroke="rgba(90,62,34,0.18)"
        strokeWidth={1.5}
      />
      {ticks}
      {cardinals.map((c) => (
        <text
          key={c.n}
          x={c.x}
          y={c.y}
          fill={brown}
          fontSize={fs}
          textAnchor="middle"
          fontWeight={700}
          fontFamily="ui-rounded, system-ui, sans-serif"
        >
          {c.n}
        </text>
      ))}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - R * 0.45}
        stroke={handDark}
        strokeWidth={Math.max(3, R * 0.08)}
        strokeLinecap="round"
        transform={`rotate(${hourAngle} ${cx} ${cy})`}
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - R * 0.72}
        stroke={handDark}
        strokeWidth={Math.max(2, R * 0.05)}
        strokeLinecap="round"
        transform={`rotate(${minuteAngle} ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(3, R * 0.08)}
        fill={center}
        stroke={brown}
        strokeWidth={1.5}
      />
    </svg>
  );
}

// ───────────────────────── 日历（翻页卡片） ─────────────────────────
/**
 * FlipCard：单张翻页卡片。
 *
 * 渲染策略：
 *   - 不翻页时（pair.from === pair.to）：只渲染一张静态卡片，干净不占 GPU。
 *   - 正在翻页时：底层 active 卡（新值）+ 上层 before 卡（旧值）；
 *     上层 .up 旋转 -90° 翻出去 → 露出新值的上半 → 然后底层 .down 从 90° 翻回 0° 覆盖旧的下半。
 *
 * 频率守卫：value 在 200ms 内连续变化时跳过动画直接换数字，避免动画堆积。
 */
function FlipCard({
  value,
  width,
  height,
}: {
  value: string | number;
  width: number;
  height: number;
}) {
  const valueStr = String(value);
  const [pair, setPair] = React.useState({ from: valueStr, to: valueStr });
  // 每次启动新动画递增；用作 React key 强制重挂载 .up/.down，
  // 否则连续翻页时 .is-flipping class 不变，CSS 动画不会重新触发。
  const [flipNonce, setFlipNonce] = React.useState(0);
  const lastFlipRef = React.useRef(0);
  // 动画时长 = up-out 0.12s + down-in 0.12s（含 0.12s 延迟），CSS 必须一致
  const FLIP_DURATION = 250;
  // 比这更快的连续变化就跳过动画（避免堆叠）。设得比 FLIP_DURATION 稍小一点。
  const MIN_INTERVAL = 100;

  // ⚠️ 只依赖 valueStr：把 pair.to 加进 deps 会因为自己 setPair 触发自己→
  // 立刻 cleanup 清掉 setTimeout，结果卡在 flipping 状态（上下两层永远叠着）。
  React.useEffect(() => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - lastFlipRef.current;

    if (elapsed < MIN_INTERVAL) {
      // 快速变化：跳过动画直接换
      // ⚠️ 不更新 lastFlipRef！否则只要值持续高频变化，ref 一直跟到现在 →
      // elapsed 永远 < MIN_INTERVAL → 永远 snap，再也不会翻页。
      // 只在真正"启动动画"时记录时间，让 MIN_INTERVAL 成为"动画之间的最小间隔"。
      setPair({ from: valueStr, to: valueStr });
      return;
    }

    lastFlipRef.current = now;

    // 用 functional updater 读最新 prev.to，避免闭包陷阱
    setPair((prev) => {
      if (prev.to === valueStr) return prev;
      return { from: prev.to, to: valueStr };
    });
    setFlipNonce((n) => n + 1);

    const tid = setTimeout(() => {
      setPair({ from: valueStr, to: valueStr });
    }, FLIP_DURATION);
    return () => clearTimeout(tid);
  }, [valueStr]);

  const flipping = pair.from !== pair.to;
  // 字号同时受高度和宽度约束（2 位数字时，宽度往往是瓶颈）
  // 每个字符宽 ≈ 0.6 × 字号；为留呼吸缝隙取系数 0.85
  const digits = Math.max(1, valueStr.length);
  const fontSize = Math.floor(
    Math.min(height * 0.62, (width * 0.85) / (digits * 0.6)),
  );

  if (!flipping) {
    // 静态：一张完整卡片
    return (
      <div className="lg-flip" style={{ width, height, fontSize }}>
        <div className="lg-flip-card lg-flip-static">
          <div className="up">
            <div className="inn">{valueStr}</div>
          </div>
          <div className="down">
            <div className="inn">{valueStr}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg-flip is-flipping" style={{ width, height, fontSize }}>
      {/* key={flipNonce}：每次新翻页 nonce++ → React 视为不同元素 → 重挂载 →
          CSS 动画从头跑。否则连续翻时 class 不变，浏览器不重启动画。 */}
      <div key={`a-${flipNonce}`} className="lg-flip-card lg-flip-active">
        <div className="up">
          <div className="inn">{pair.to}</div>
        </div>
        <div className="down">
          <div className="inn">{pair.to}</div>
        </div>
      </div>
      <div key={`b-${flipNonce}`} className="lg-flip-card lg-flip-before">
        <div className="up">
          <div className="inn">{pair.from}</div>
        </div>
        <div className="down">
          <div className="inn">{pair.from}</div>
        </div>
      </div>
    </div>
  );
}

function CalendarFlip({
  progress,
  seconds,
  size,
}: {
  progress: number;
  seconds: number;
  size: number;
}) {
  // 简化日历：365 天/年、30 天/月（教学可视化，不做真实日期）
  const totalDays = Math.floor((progress * seconds) / 86400);
  const years = Math.floor(totalDays / 365);
  const rem = totalDays - years * 365;
  const months = Math.floor(rem / 30);
  const days = rem - months * 30;

  // 三张卡 + "年/月/日" 标签
  // 年 1 位（一般 0~9，长项才多位），月/日 固定两位（"01"~"12"、"01"~"30"）
  // 因此年卡窄、月卡和日卡更宽，避免双位数挤压
  const cardGap = 4;
  const labelFs = Math.max(10, Math.floor(size * 0.075));
  const cardAreaW = size - 2 * cardGap;
  // 宽度分配比例：年 0.75 · 月 1.1 · 日 1.15（总 3 等分）
  const unitW = cardAreaW / 3;
  const yearW = Math.floor(unitW * 0.75);
  const monthW = Math.floor(unitW * 1.1);
  const dayW = Math.floor(unitW * 1.15);
  const cardH = Math.floor(unitW * 1.35);
  const labelGap = 2;

  const pad2 = (n: number) => n.toString().padStart(2, "0");

  const renderUnit = (display: string, label: string, w: number) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: labelGap,
      }}
    >
      <FlipCard value={display} width={w} height={cardH} />
      <div
        style={{
          fontSize: labelFs,
          color: "var(--foreground)",
          opacity: 0.75,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", gap: cardGap, alignItems: "flex-start" }}>
        {renderUnit(String(years), "年", yearW)}
        {renderUnit(pad2(months), "月", monthW)}
        {renderUnit(pad2(days), "天", dayW)}
      </div>
    </div>
  );
}

// ───────────────────────── 主组件 ─────────────────────────
export function TimeVisualRow({
  items,
  whiteboard,
  stageW,
  renderNamePill,
}: {
  items: TimeVizItem[];
  whiteboard: boolean;
  stageW: number;
  renderNamePill: (item: TimeVizItem) => React.ReactNode;
}) {
  // 最长的项跑 SLOWEST_DUR 秒，其它项严格按 size 比例线性缩短。
  // 极短项保底 MIN_DUR 防止"几乎不动"。
  const SLOWEST_DUR = 8;
  const MIN_DUR = 0.6;
  const N = items.length;
  const gap = whiteboard ? 38 : 28;
  const VIZ_MAX = whiteboard ? 220 : 180;
  const VIZ_MIN = 96;
  const vizSize = Math.max(
    VIZ_MIN,
    Math.min(VIZ_MAX, Math.floor((stageW - (N - 1) * gap - 24) / N)),
  );

  // 时长映射：
  //   - 时钟 / 日历：按 size 线性 → 最长项 = SLOWEST_DUR，其它项 = SLOWEST_DUR × (size/maxSize)
  //   - 秒表：组内"指针恒速"——所有秒表项以同一 °/sec 转动，duration 按 **sweep 角度**
  //     缩放：duration = SLOWEST_DUR × (mySweep / maxStopwatchSweep)
  //     这样组内最长秒表项跑完 SLOWEST_DUR，其它秒表按角度比例提前停下，针的瞬时速度一致。
  const maxSize = Math.max(1e-6, ...items.map((it) => it.size));
  const stopwatchSweep = (s: number) =>
    Math.cbrt(Math.min(1, Math.max(0, s / 60))) * 360;
  const maxStopwatchSweep = Math.max(
    0,
    ...items
      .filter((it) => bucketForSeconds(it.size) === "stopwatch")
      .map((it) => stopwatchSweep(it.size)),
  );
  const durations = React.useMemo(
    () =>
      items.map((it) => {
        if (
          bucketForSeconds(it.size) === "stopwatch" &&
          maxStopwatchSweep > 0
        ) {
          const sweep = stopwatchSweep(it.size);
          return Math.max(
            MIN_DUR,
            SLOWEST_DUR * (sweep / maxStopwatchSweep),
          );
        }
        return Math.max(MIN_DUR, SLOWEST_DUR * (it.size / maxSize));
      }),
    [items, maxSize, maxStopwatchSweep],
  );
  const loopDur = SLOWEST_DUR;

  const [t, setT] = React.useState(0);
  const itemsKey = items.map((it) => it.key).join("|");
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [itemsKey]);

  const phase = t % loopDur;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: whiteboard ? 14 : 10,
      }}
    >
      {/* Row 1: 名字 + 数值 */}
      <div
        style={{
          display: "flex",
          gap,
          justifyContent: "center",
          alignItems: "flex-end",
        }}
      >
        {items.map((item) => {
          const isTarget = item.isTarget;
          return (
            <div
              key={`hdr-${item.key}`}
              style={{
                width: vizSize,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              {renderNamePill(item)}
              <div
                className="font-display font-bold"
                style={{
                  marginTop: 4,
                  fontSize: isTarget
                    ? whiteboard
                      ? 24
                      : 20
                    : whiteboard
                      ? 24
                      : 20,
                  color: isTarget
                    ? "var(--primary-dark)"
                    : "var(--foreground)",
                  lineHeight: 1,
                }}
              >
                {item.sizeDisplay}
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: 秒表 / 时钟 / 日历 */}
      <div
        style={{
          display: "flex",
          gap,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {items.map((item, idx) => {
          const p = Math.min(1, phase / durations[idx]);
          const bucket = bucketForSeconds(item.size);
          return (
            <div
              key={`viz-${item.key}`}
              style={{
                width: vizSize,
                height: vizSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {bucket === "stopwatch" && (
                <Stopwatch progress={p} seconds={item.size} size={vizSize} />
              )}
              {bucket === "clock" && (
                <Clock progress={p} seconds={item.size} size={vizSize} />
              )}
              {bucket === "calendar" && (
                <CalendarFlip progress={p} seconds={item.size} size={vizSize} />
              )}
            </div>
          );
        })}
      </div>

      {/* 秒表指针旋转 + 日历翻页卡片样式 */}
      <style>{`
        .lg-swatch .timer {
          transform-origin: 16.5% 84%;
          transform-box: fill-box;
          /* 由 JS 计算的角度（含 -45° 偏置 + progress×sweep）；默认 -45° = 12 点 */
          transform: rotate(var(--swatch-rot, -45deg));
        }
        /* ─── 翻页卡片 ─── */
        .lg-flip {
          position: relative;
          display: inline-block;
          border-radius: 6px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-weight: 700;
          line-height: 1;
          user-select: none;
          /* 卡片底色：翻页中点 before.down 隐藏、active.down 还在 90° 时
             下半瞬间无内容会露出父容器的浅色 → 在底层垫一层卡片色避免闪白 */
          background: #2a2a2a;
        }
        .lg-flip-card {
          position: absolute;
          inset: 0;
          /* 透视必须在 .up/.down 的直接父级，旋转才能产生 3D 厚度，
             否则旋转中的"翻页"被压平看不到上面的旧数字。 */
          perspective: 220px;
          transform-style: preserve-3d;
        }
        .lg-flip-static { z-index: 1; }
        .lg-flip.is-flipping .lg-flip-active { z-index: 1; }
        .lg-flip.is-flipping .lg-flip-before { z-index: 2; }
        .lg-flip-card .up,
        .lg-flip-card .down {
          position: absolute;
          left: 0;
          width: 100%;
          height: 50%;
          overflow: hidden;
          backface-visibility: hidden;
        }
        .lg-flip-card .up {
          top: 0;
          transform-origin: 50% 100%;
        }
        .lg-flip-card .down {
          bottom: 0;
          transform-origin: 50% 0%;
        }
        /* 中线阴影：让上下两半看起来确实是两片卡 */
        .lg-flip-card .up::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: rgba(0, 0, 0, 0.4);
          z-index: 5;
        }
        .lg-flip-card .inn {
          position: absolute;
          left: 0;
          width: 100%;
          height: 200%;
          color: #eaeaea;
          text-align: center;
          background: linear-gradient(to bottom, #3a3a3a, #2a2a2a);
          border-radius: 6px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lg-flip-card .up .inn { top: 0; }
        .lg-flip-card .down .inn { bottom: 0; }
        /* 翻页动画
           - 前半 0~0.25s：before.up 向下翻出（rotateX 0 → -90°）
           - 中点 0.25s：before.down 立刻隐藏（用 step-end 的 opacity 关键帧切换），
             否则它会盖住正在翻入的 active.down → 看到旧底数字
           - 后半 0.25s~0.5s：active.down 从上往下翻入（rotateX 90 → 0°）
        */
        .lg-flip.is-flipping .lg-flip-before .up {
          animation: lgflip-up-out 0.12s linear both;
        }
        .lg-flip.is-flipping .lg-flip-before .down {
          animation: lgflip-before-down-hide 0.25s linear both;
        }
        .lg-flip.is-flipping .lg-flip-active .down {
          animation: lgflip-down-in 0.12s 0.12s linear both;
        }
        @keyframes lgflip-up-out {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(-90deg); }
        }
        @keyframes lgflip-down-in {
          0% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
        @keyframes lgflip-before-down-hide {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
