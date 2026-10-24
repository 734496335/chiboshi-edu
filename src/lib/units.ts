/**
 * 单位归一化：把"楼层 200 米"中的 200 米转换为 SI 基础单位（米）。
 */

import type { DimensionKey } from "./references";

const LENGTH_TO_METERS: Record<string, number> = {
  mm: 0.001,
  毫米: 0.001,
  cm: 0.01,
  厘米: 0.01,
  公分: 0.01,
  dm: 0.1,
  分米: 0.1,
  m: 1,
  米: 1,
  公尺: 1,
  km: 1000,
  千米: 1000,
  公里: 1000,
};

const WEIGHT_TO_KG: Record<string, number> = {
  mg: 1e-6,
  毫克: 1e-6,
  g: 0.001,
  克: 0.001,
  公克: 0.001,
  kg: 1,
  千克: 1,
  公斤: 1,
  t: 1000,
  吨: 1000,
  公吨: 1000,
};

/** 面积 → 平方米 */
const AREA_TO_SQM: Record<string, number> = {
  "mm²": 1e-6,
  "mm2": 1e-6,
  "平方毫米": 1e-6,
  "cm²": 1e-4,
  "cm2": 1e-4,
  "平方厘米": 1e-4,
  "dm²": 0.01,
  "dm2": 0.01,
  "平方分米": 0.01,
  "m²": 1,
  "m2": 1,
  "平方米": 1,
  "ha": 10000,
  "公顷": 10000,
  "亩": 666.67,
  "km²": 1e6,
  "km2": 1e6,
  "平方千米": 1e6,
  "平方公里": 1e6,
};

/** 容积 → 升（L）。容积针对"能装多少液体"——杯子/桶/水缸。 */
const VOLUME_TO_LITERS: Record<string, number> = {
  ml: 0.001,
  毫升: 0.001,
  cc: 0.001,
  l: 1,
  升: 1,
  公升: 1,
  // 立方厘米 = 毫升；立方分米 = 升；立方米 = 1000 升。也接受这些以防孩子混用。
  "cm³": 0.001,
  "cm3": 0.001,
  立方厘米: 0.001,
  "dm³": 1,
  "dm3": 1,
  立方分米: 1,
};

/** 体积 → 立方米（m³）。体积针对"占多少 3D 空间"——魔方/冰箱/集装箱/楼。 */
const CUBIC_TO_M3: Record<string, number> = {
  "mm³": 1e-9,
  "mm3": 1e-9,
  立方毫米: 1e-9,
  "cm³": 1e-6,
  "cm3": 1e-6,
  立方厘米: 1e-6,
  "dm³": 0.001,
  "dm3": 0.001,
  立方分米: 0.001,
  "m³": 1,
  "m3": 1,
  立方米: 1,
  "km³": 1e9,
  "km3": 1e9,
  立方千米: 1e9,
};

const TIME_TO_SECONDS: Record<string, number> = {
  s: 1,
  秒: 1,
  min: 60,
  分: 60,
  分钟: 60,
  h: 3600,
  小时: 3600,
  时: 3600,
  天: 86400,
  日: 86400,
  星期: 86400 * 7,
  周: 86400 * 7,
  月: 86400 * 30,
  年: 86400 * 365,
};

/**
 * 把任意 (value, unit) 归一化到该维度的 SI 基础单位
 * @returns SI 数值；如果识别不出来 unit 返回 null
 */
export function toSI(
  value: number,
  unit: string,
  dimension: DimensionKey,
): number | null {
  const u = unit.trim().toLowerCase();
  let map: Record<string, number> | null = null;
  switch (dimension) {
    case "length":
      map = LENGTH_TO_METERS;
      break;
    case "weight":
      map = WEIGHT_TO_KG;
      break;
    case "area":
      map = AREA_TO_SQM;
      break;
    case "volume":
      map = VOLUME_TO_LITERS;
      break;
    case "cubic":
      map = CUBIC_TO_M3;
      break;
    case "time":
      map = TIME_TO_SECONDS;
      break;
    default:
      return null;
  }
  // 中文单位区分大小写无关
  const factor = map[u] ?? map[unit.trim()];
  if (factor == null) return null;
  return value * factor;
}

/**
 * 把 SI 数值反向转回某个目标单位的数值。
 * 例：fromSI(0.000216, "立方厘米", "cubic") → 216
 * @returns 目标单位下的数值；unit 不识别返回 null
 */
export function fromSI(
  siValue: number,
  unit: string,
  dimension: DimensionKey,
): number | null {
  const u = unit.trim().toLowerCase();
  let map: Record<string, number> | null = null;
  switch (dimension) {
    case "length":
      map = LENGTH_TO_METERS;
      break;
    case "weight":
      map = WEIGHT_TO_KG;
      break;
    case "area":
      map = AREA_TO_SQM;
      break;
    case "volume":
      map = VOLUME_TO_LITERS;
      break;
    case "cubic":
      map = CUBIC_TO_M3;
      break;
    case "time":
      map = TIME_TO_SECONDS;
      break;
    default:
      return null;
  }
  const factor = map[u] ?? map[unit.trim()];
  if (factor == null || factor === 0) return null;
  return siValue / factor;
}

/** 去尾零：1.50 → 1.5；25.00 → 25 */
function trim(n: number, digits: number): string {
  return parseFloat(n.toFixed(digits)).toString();
}

/** 给定 SI 数值，找出最合适的"人类读法"——例如 1234m → "1.23 千米" */
export function formatLength(meters: number): string {
  if (meters < 0.01) return `${trim(meters * 1000, 1)}毫米`;
  if (meters < 1) return `${trim(meters * 100, 1)}厘米`;
  if (meters < 1000) return `${trim(meters, 1)}米`;
  return `${trim(meters / 1000, 2)}千米`;
}

/** 面积 SI（平方米）→ 人类读法。例：0.0004 → "4 平方厘米"；7140 → "7140 平方米" */
export function formatArea(sqm: number): string {
  const abs = Math.abs(sqm);
  if (abs < 0.01) return `${trim(sqm * 1e4, 1)}平方厘米`;
  if (abs < 1) return `${trim(sqm * 100, 1)}平方分米`;
  if (abs < 10000) return `${trim(sqm, 1)}平方米`;
  if (abs < 1e6) return `${trim(sqm / 10000, 2)}公顷`;
  return `${trim(sqm / 1e6, 2)}平方千米`;
}

/** 容积 SI（升）→ 人类读法。例：0.05 → "50 毫升"；250 → "250 升" */
export function formatVolume(liters: number): string {
  const abs = Math.abs(liters);
  if (abs < 1) return `${trim(liters * 1000, 1)}毫升`;
  if (abs < 1000) return `${trim(liters, 1)}升`;
  return `${trim(liters / 1000, 2)}立方米`;
}

/** 体积 SI（立方米）→ 人类读法。例：0.000001 → "1 立方厘米"；1 → "1 立方米" */
export function formatCubic(m3: number): string {
  const abs = Math.abs(m3);
  if (abs < 1e-6) return `${trim(m3 * 1e9, 1)}立方毫米`;
  if (abs < 1e-3) return `${trim(m3 * 1e6, 1)}立方厘米`;
  if (abs < 1) return `${trim(m3 * 1e3, 1)}立方分米`;
  if (abs < 1e9) return `${trim(m3, 2)}立方米`;
  return `${trim(m3 / 1e9, 2)}立方千米`;
}

/** 重量 SI（千克）→ 人类读法。例：0.005 → "5 克"；3500 → "3.5 吨" */
export function formatWeight(kg: number): string {
  const abs = Math.abs(kg);
  if (abs < 0.001) return `${trim(kg * 1e6, 1)}毫克`;
  if (abs < 1) return `${trim(kg * 1000, 1)}克`;
  if (abs < 1000) return `${trim(kg, 2)}千克`;
  return `${trim(kg / 1000, 2)}吨`;
}

/** 时间 SI（秒）→ 人类读法。例：0.5 → "0.5 秒"；3600 → "1 小时"；86400 → "1 天" */
export function formatTime(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 1) return `${trim(seconds * 1000, 0)}毫秒`;
  if (abs < 60) return `${trim(seconds, 1)}秒`;
  if (abs < 3600) return `${trim(seconds / 60, 1)}分钟`;
  if (abs < 86400) return `${trim(seconds / 3600, 1)}小时`;
  if (abs < 86400 * 30) return `${trim(seconds / 86400, 1)}天`;
  if (abs < 86400 * 365) return `${trim(seconds / (86400 * 30), 1)}个月`;
  return `${trim(seconds / (86400 * 365), 2)}年`;
}

/** 通用：根据维度选择 formatter */
export function formatBySi(si: number, dimension: DimensionKey): string {
  switch (dimension) {
    case "length":
      return formatLength(si);
    case "area":
      return formatArea(si);
    case "volume":
      return formatVolume(si);
    case "cubic":
      return formatCubic(si);
    case "weight":
      return formatWeight(si);
    case "time":
      return formatTime(si);
    default:
      return `${trim(si, 2)}`; // 未知维度不加单位
  }
}
