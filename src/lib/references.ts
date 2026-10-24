/**
 * 参考物目录 (Reference Object Catalog)
 *
 * 每个参考物都有一个**真实世界规范尺寸**（SI 基础单位）。
 * AI 解析教师/学生输入后，会从这个池子里挑 3-5 个最适合做对比的参考物。
 *
 * 添加海南本地元素以贴合主办方诉求：椰子树、海口湾大桥、海南岛宽度等。
 *
 * 当前版本：长度维度 25 个。后续扩 weight / volume / area / time。
 */

export type DimensionKey =
  | "length"
  | "weight"
  | "volume"
  | "area"
  | "cubic"
  | "time";

export interface ReferenceObject {
  /** 唯一 ID，AI 返回时引用这个 */
  id: string;
  /** 中文显示名 */
  label: string;
  /** Emoji 占位图（后续替换为 SVG） */
  emoji: string;
  /** 维度 */
  dimension: DimensionKey;
  /** 规范尺寸（length 用 m, weight 用 kg, time 用 s, volume 用 L, area 用 m²） */
  size: number;
  /** 规范单位 */
  unit: string;
  /** 给用户看的尺寸文案 */
  sizeDisplay: string;
  /** 类别（用于 AI 挑选时去重） */
  category:
    | "tiny"
    | "stationery"
    | "body"
    | "furniture"
    | "vehicle"
    | "animal"
    | "building"
    | "nature"
    | "hainan"
    | "world"
    | "astronomy"
    | "food"
    | "school"
    | "entertainment";
  /** 海南本地标记 */
  hainan?: boolean;
  /** 备注 */
  notes?: string;
  /**
   * 长度的"轴向"——核心：长度跟长度比，不要拿"高度"参考物对比"长度"。
   *
   * - "horizontal"：物体水平方向的长度（车、桥、铅笔、跑道、蚂蚁身体长度…）
   * - "vertical"：物体竖直方向的高度（人身高、楼高、树高、山高…）
   * - "either"：水平和竖直差别不大或两可（绳子之类）
   *
   * 默认 "horizontal"。AI 在为用户输入挑参考物时，应该选轴向一致的。
   */
  axis?: "horizontal" | "vertical" | "either";
}

/**
 * 长度维度参考物（按 size 升序）
 * 注意：log 刻度上从 1mm (0.001m) 到 150km (150000m) 跨越 8 个数量级
 */
export const LENGTH_REFERENCES: ReferenceObject[] = [
  // —— 极小（毫米级） ——
  {
    id: "sesame",
    label: "芝麻",
    emoji: "•",
    dimension: "length",
    size: 0.002,
    unit: "m",
    sizeDisplay: "约 2 毫米",
    category: "tiny",
  },
  {
    id: "ant",
    label: "蚂蚁",
    emoji: "🐜",
    dimension: "length",
    size: 0.005,
    unit: "m",
    sizeDisplay: "约 5 毫米",
    category: "animal",
  },
  {
    id: "coin",
    label: "1 元硬币",
    emoji: "🪙",
    dimension: "length",
    size: 0.025,
    unit: "m",
    sizeDisplay: "直径约 2.5 厘米",
    category: "tiny",
  },

  // —— 文具 / 身体 / 家具（厘米—米级）——
  {
    id: "thumb_width",
    label: "大拇指宽",
    emoji: "👍",
    dimension: "length",
    size: 0.02,
    unit: "m",
    sizeDisplay: "约 2 厘米",
    category: "body",
  },
  {
    id: "pencil",
    label: "铅笔",
    emoji: "✏️",
    dimension: "length",
    size: 0.18,
    unit: "m",
    sizeDisplay: "约 18 厘米",
    category: "stationery",
  },
  {
    id: "chopstick",
    label: "筷子",
    emoji: "🥢",
    dimension: "length",
    size: 0.24,
    unit: "m",
    sizeDisplay: "约 24 厘米",
    category: "stationery",
  },
  {
    id: "ruler_30cm",
    label: "30 厘米直尺",
    emoji: "📏",
    dimension: "length",
    size: 0.30,
    unit: "m",
    sizeDisplay: "30 厘米",
    category: "stationery",
  },
  {
    id: "school_desk",
    label: "课桌",
    emoji: "🪑",
    dimension: "length",
    size: 0.60,
    unit: "m",
    sizeDisplay: "宽约 60 厘米",
    category: "furniture",
  },
  {
    id: "arm_span_child",
    label: "小朋友双臂",
    emoji: "🙌",
    dimension: "length",
    size: 1.0,
    unit: "m",
    sizeDisplay: "张开约 1 米",
    category: "body",
    notes: "经典量感锚点：双臂张开 ≈ 身高 ≈ 1 米",
  },
  {
    id: "child_height",
    label: "一年级小朋友",
    emoji: "🧒",
    dimension: "length",
    size: 1.2,
    unit: "m",
    sizeDisplay: "身高约 1.2 米",
    category: "body",
    axis: "vertical",
  },
  {
    id: "adult_height",
    label: "成年人",
    emoji: "🧑",
    dimension: "length",
    size: 1.7,
    unit: "m",
    sizeDisplay: "身高约 1.7 米",
    category: "body",
    axis: "vertical",
  },
  {
    id: "bed",
    label: "床",
    emoji: "🛏️",
    dimension: "length",
    size: 2.0,
    unit: "m",
    sizeDisplay: "约 2 米长",
    category: "furniture",
  },

  // —— 车辆 / 动物 / 树木（米级）——
  {
    id: "car",
    label: "小汽车",
    emoji: "🚗",
    dimension: "length",
    size: 4.5,
    unit: "m",
    sizeDisplay: "约 4.5 米长",
    category: "vehicle",
  },
  {
    id: "school_bus",
    label: "校车",
    emoji: "🚌",
    dimension: "length",
    size: 11,
    unit: "m",
    sizeDisplay: "约 11 米长",
    category: "vehicle",
  },
  // ── 填袅10m附近竖向间隔 ──
  {
    id: "street_lamp",
    label: "路灯",
    emoji: "💡",
    dimension: "length",
    size: 6,
    unit: "m",
    sizeDisplay: "高约 6 米",
    category: "building",
    axis: "vertical",
  },
  {
    id: "flagpole",
    label: "旗杆",
    emoji: "🚩",
    dimension: "length",
    size: 8,
    unit: "m",
    sizeDisplay: "高约 8 米",
    category: "school",
    axis: "vertical",
  },
  {
    id: "utility_pole",
    label: "电线杆",
    emoji: "🗼",
    dimension: "length",
    size: 12,
    unit: "m",
    sizeDisplay: "高约 12 米",
    category: "building",
    axis: "vertical",
  },
  {
    id: "haikou_arcade",
    label: "海口骡楼",
    emoji: "🏫",
    dimension: "length",
    size: 12,
    unit: "m",
    sizeDisplay: "高约 12 米（3层）",
    category: "hainan",
    hainan: true,
    notes: "海口老街中常见的中西合璧骡楼",
    axis: "vertical",
  },
  {
    id: "five_story_building",
    label: "5 层楼",
    emoji: "🏢",
    dimension: "length",
    size: 15,
    unit: "m",
    sizeDisplay: "高约 15 米",
    category: "building",
    axis: "vertical",
  },
  {
    id: "lighthouse",
    label: "灯塔",
    emoji: "🕯️",
    dimension: "length",
    size: 20,
    unit: "m",
    sizeDisplay: "高约 20 米",
    category: "building",
    axis: "vertical",
  },
  {
    id: "coconut_tree",
    label: "椰子树",
    emoji: "🌴",
    dimension: "length",
    size: 25,
    unit: "m",
    sizeDisplay: "高约 25 米",
    category: "hainan",
    hainan: true,
    notes: "海南随处可见的高椰子树",
    axis: "vertical",
  },
  {
    id: "blue_whale",
    label: "蓝鲸",
    emoji: "🐋",
    dimension: "length",
    size: 30,
    unit: "m",
    sizeDisplay: "约 30 米长",
    category: "animal",
  },

  // —— 建筑物（十米—百米级）——
  {
    id: "basketball_court",
    label: "篮球场",
    emoji: "🏀",
    dimension: "length",
    size: 28,
    unit: "m",
    sizeDisplay: "长 28 米",
    category: "building",
  },
  {
    id: "school_building",
    label: "教学楼",
    emoji: "🏫",
    dimension: "length",
    size: 30,
    unit: "m",
    sizeDisplay: "高约 30 米（约 10 层）",
    category: "building",
    axis: "vertical",
  },
  {
    id: "tower_crane",
    label: "塔吊",
    emoji: "🏗️",
    dimension: "length",
    size: 50,
    unit: "m",
    sizeDisplay: "高约 50 米",
    category: "building",
    axis: "vertical",
  },
  {
    id: "soccer_field",
    label: "足球场",
    emoji: "⚽",
    dimension: "length",
    size: 100,
    unit: "m",
    sizeDisplay: "长 100 米",
    category: "building",
  },
  {
    id: "haikou_dayuecheng",
    label: "海口大悦城",
    emoji: "🏬",
    dimension: "length",
    size: 168,
    unit: "m",
    sizeDisplay: "高约 168 米",
    category: "hainan",
    hainan: true,
    notes: "海口市标志性高楼之一",
    axis: "vertical",
  },
  {
    id: "burj_khalifa",
    label: "迪拜哈利法塔",
    emoji: "🗼",
    dimension: "length",
    size: 828,
    unit: "m",
    sizeDisplay: "高 828 米",
    category: "world",
    axis: "vertical",
  },
  {
    id: "wuzhi_mountain",
    label: "五指山",
    emoji: "⛰️",
    dimension: "length",
    size: 1867,
    unit: "m",
    sizeDisplay: "主峰 1867 米",
    category: "hainan",
    hainan: true,
    notes: "海南第一高峰",
    axis: "vertical",
  },

  // —— 千米—百千米级 ——
  {
    id: "running_track",
    label: "操场跑道一圈",
    emoji: "🏃",
    dimension: "length",
    size: 400,
    unit: "m",
    sizeDisplay: "1 圈 400 米",
    category: "building",
  },
  {
    id: "haikou_bay_bridge",
    label: "海口湾跨海大桥",
    emoji: "🌉",
    dimension: "length",
    size: 5000,
    unit: "m",
    sizeDisplay: "长约 5 千米",
    category: "hainan",
    hainan: true,
  },
  {
    id: "mount_everest",
    label: "珠穆朗玛峰",
    emoji: "🏔️",
    dimension: "length",
    size: 8848,
    unit: "m",
    sizeDisplay: "高 8848 米",
    category: "nature",
    axis: "vertical",
  },
  {
    id: "hainan_island_width",
    label: "海南岛宽度",
    emoji: "🏝️",
    dimension: "length",
    size: 150_000,
    unit: "m",
    sizeDisplay: "约 150 千米",
    category: "hainan",
    hainan: true,
  },
  {
    id: "hzmb_bridge",
    label: "港珠澳大桥",
    emoji: "🌉",
    dimension: "length",
    size: 55_000,
    unit: "m",
    sizeDisplay: "全长约 55 千米",
    category: "world",
  },
];

/**
 * 面积维度参考物（按 size 升序，单位均为 m²）
 * 覆盖：邮票级（4 cm²）→ 课桌（0.5 m²）→ 教室（56 m²）→ 篮球场（420 m²）→ 鸟巢（25 万 m²）→ 故宫（72 万 m²）→ 海南岛（约 35,000 km²）
 */
export const AREA_REFERENCES: ReferenceObject[] = [
  {
    id: "stamp",
    label: "邮票",
    emoji: "📮",
    dimension: "area",
    size: 0.0004, // 4 cm²
    unit: "m²",
    sizeDisplay: "约 4 平方厘米",
    category: "stationery",
  },
  {
    id: "business_card",
    label: "名片",
    emoji: "🪪",
    dimension: "area",
    size: 0.0055, // 55 cm²
    unit: "m²",
    sizeDisplay: "约 55 平方厘米",
    category: "stationery",
  },
  {
    id: "phone_screen",
    label: "手机屏幕",
    emoji: "📱",
    dimension: "area",
    size: 0.012, // 120 cm²（≈ 6.5 寸）
    unit: "m²",
    sizeDisplay: "约 120 平方厘米",
    category: "stationery",
  },
  {
    id: "math_textbook",
    label: "数学课本",
    emoji: "📕",
    dimension: "area",
    size: 0.038, // 19×26cm ≈ 494 cm²，封面面积
    unit: "m²",
    sizeDisplay: "约 380 平方厘米",
    category: "stationery",
  },
  {
    id: "a4_paper",
    label: "一张 A4 纸",
    emoji: "📄",
    dimension: "area",
    size: 0.0624,
    unit: "m²",
    sizeDisplay: "约 624 平方厘米",
    category: "stationery",
  },
  {
    id: "newspaper_open",
    label: "一张报纸（摊开）",
    emoji: "📰",
    dimension: "area",
    size: 0.36,
    unit: "m²",
    sizeDisplay: "约 0.36 平方米",
    category: "stationery",
  },
  {
    id: "school_desk_top",
    label: "课桌桌面",
    emoji: "🪑",
    dimension: "area",
    size: 0.4, // 0.6m × 0.66m
    unit: "m²",
    sizeDisplay: "约 0.4 平方米",
    category: "furniture",
  },
  {
    id: "double_bed",
    label: "双人床",
    emoji: "🛏️",
    dimension: "area",
    size: 3.0, // 1.5m × 2m
    unit: "m²",
    sizeDisplay: "约 3 平方米",
    category: "furniture",
  },
  {
    id: "ping_pong_table",
    label: "乒乓球台",
    emoji: "🏓",
    dimension: "area",
    size: 4.18, // 1.525m × 2.74m
    unit: "m²",
    sizeDisplay: "约 4.2 平方米",
    category: "furniture",
  },
  {
    id: "parking_spot",
    label: "停车位",
    emoji: "🅿️",
    dimension: "area",
    size: 12.5, // 2.5m × 5m
    unit: "m²",
    sizeDisplay: "约 12.5 平方米",
    category: "vehicle",
  },
  {
    id: "classroom_floor",
    label: "教室地面",
    emoji: "🏫",
    dimension: "area",
    size: 56, // 8m × 7m
    unit: "m²",
    sizeDisplay: "约 56 平方米",
    category: "building",
  },
  {
    id: "small_apartment",
    label: "一居室",
    emoji: "🏠",
    dimension: "area",
    size: 50,
    unit: "m²",
    sizeDisplay: "约 50 平方米",
    category: "building",
  },
  {
    id: "basketball_half_court",
    label: "篮球半场",
    emoji: "🏀",
    dimension: "area",
    size: 210, // 14m × 15m
    unit: "m²",
    sizeDisplay: "约 210 平方米",
    category: "building",
  },
  {
    id: "basketball_full_court",
    label: "篮球场",
    emoji: "🏀",
    dimension: "area",
    size: 420, // 28m × 15m
    unit: "m²",
    sizeDisplay: "约 420 平方米",
    category: "building",
  },
  {
    id: "tennis_court",
    label: "网球场",
    emoji: "🎾",
    dimension: "area",
    size: 261, // 单打场地 23.77 × 8.23 + 缓冲约 261
    unit: "m²",
    sizeDisplay: "约 261 平方米",
    category: "building",
  },
  {
    id: "running_track_inner",
    label: "操场跑道围出的空地",
    emoji: "🏟️",
    dimension: "area",
    size: 7140, // 标准田径场内场约 7140 m²
    unit: "m²",
    sizeDisplay: "约 7140 平方米",
    category: "building",
  },
  {
    id: "soccer_field_area",
    label: "标准足球场",
    emoji: "⚽",
    dimension: "area",
    size: 7140, // 105m × 68m
    unit: "m²",
    sizeDisplay: "约 7140 平方米",
    category: "building",
  },
  {
    id: "tiananmen_square",
    label: "天安门广场",
    emoji: "🏛️",
    dimension: "area",
    size: 440000, // 约 44 公顷
    unit: "m²",
    sizeDisplay: "约 44 公顷",
    category: "world",
  },
  {
    id: "birds_nest",
    label: "鸟巢（外轮廓）",
    emoji: "🏟️",
    dimension: "area",
    size: 250000,
    unit: "m²",
    sizeDisplay: "约 25 公顷",
    category: "world",
  },
  {
    id: "forbidden_city",
    label: "故宫",
    emoji: "🏯",
    dimension: "area",
    size: 720000,
    unit: "m²",
    sizeDisplay: "约 72 公顷",
    category: "world",
  },
  {
    id: "central_park_ny",
    label: "纽约中央公园",
    emoji: "🌳",
    dimension: "area",
    size: 3.41e6,
    unit: "m²",
    sizeDisplay: "约 3.41 平方千米",
    category: "world",
  },
  {
    id: "haikou_meilan_airport",
    label: "海口美兰机场",
    emoji: "🛬",
    dimension: "area",
    size: 6.7e6,
    unit: "m²",
    sizeDisplay: "约 6.7 平方千米",
    category: "hainan",
    hainan: true,
  },
];

/**
 * 容积维度参考物（按 size 升序，单位均为升 L）
 * 覆盖：滴管 1 mL → 茶杯 0.2 L → 矿泉水瓶 0.55 L → 桶 18 L → 浴缸 200 L → 水罐车 5000 L
 */
export const VOLUME_REFERENCES: ReferenceObject[] = [
  {
    id: "eyedropper_drop",
    label: "一滴水",
    emoji: "💧",
    dimension: "volume",
    size: 0.00005, // 0.05 mL
    unit: "L",
    sizeDisplay: "约 0.05 毫升",
    category: "tiny",
  },
  {
    id: "spoon_teaspoon",
    label: "一茶匙",
    emoji: "🥄",
    dimension: "volume",
    size: 0.005, // 5 mL
    unit: "L",
    sizeDisplay: "约 5 毫升",
    category: "stationery",
  },
  {
    id: "soup_spoon",
    label: "一汤勺",
    emoji: "🥄",
    dimension: "volume",
    size: 0.015,
    unit: "L",
    sizeDisplay: "约 15 毫升",
    category: "stationery",
  },
  {
    id: "yogurt_cup",
    label: "酸奶杯",
    emoji: "🥛",
    dimension: "volume",
    size: 0.15,
    unit: "L",
    sizeDisplay: "约 150 毫升",
    category: "stationery",
  },
  {
    id: "tea_cup",
    label: "茶杯",
    emoji: "☕",
    dimension: "volume",
    size: 0.2,
    unit: "L",
    sizeDisplay: "约 200 毫升",
    category: "stationery",
  },
  {
    id: "soda_can",
    label: "易拉罐",
    emoji: "🥫",
    dimension: "volume",
    size: 0.33,
    unit: "L",
    sizeDisplay: "约 330 毫升",
    category: "stationery",
  },
  {
    id: "mineral_water_bottle",
    label: "矿泉水瓶",
    emoji: "💧",
    dimension: "volume",
    size: 0.55,
    unit: "L",
    sizeDisplay: "约 550 毫升",
    category: "stationery",
  },
  {
    id: "milk_carton",
    label: "牛奶盒",
    emoji: "🧴",
    dimension: "volume",
    size: 1,
    unit: "L",
    sizeDisplay: "1 升",
    category: "stationery",
  },
  {
    id: "kettle",
    label: "热水壶",
    emoji: "🫖",
    dimension: "volume",
    size: 1.5,
    unit: "L",
    sizeDisplay: "约 1.5 升",
    category: "stationery",
  },
  {
    id: "rice_cooker",
    label: "电饭煲",
    emoji: "🍚",
    dimension: "volume",
    size: 5,
    unit: "L",
    sizeDisplay: "约 5 升",
    category: "stationery",
  },
  {
    id: "bucket_household",
    label: "家用水桶",
    emoji: "🪣",
    dimension: "volume",
    size: 18,
    unit: "L",
    sizeDisplay: "约 18 升",
    category: "stationery",
  },
  {
    id: "bathtub",
    label: "浴缸",
    emoji: "🛁",
    dimension: "volume",
    size: 200,
    unit: "L",
    sizeDisplay: "约 200 升",
    category: "furniture",
  },
  {
    id: "fish_tank_home",
    label: "家用鱼缸",
    emoji: "🐠",
    dimension: "volume",
    size: 100,
    unit: "L",
    sizeDisplay: "约 100 升",
    category: "furniture",
  },
  {
    id: "water_tanker_truck",
    label: "洒水车水罐",
    emoji: "🚛",
    dimension: "volume",
    size: 5000,
    unit: "L",
    sizeDisplay: "约 5 立方米",
    category: "vehicle",
  },
  {
    id: "swimming_pool_kid",
    label: "儿童游泳池",
    emoji: "🏊",
    dimension: "volume",
    size: 800,
    unit: "L",
    sizeDisplay: "约 800 升",
    category: "building",
  },
];

/**
 * 体积维度参考物（按 size 升序，单位均为立方米 m³）
 * 覆盖：芝麻 1 mm³ → 骰子 1 cm³ → 魔方 216 cm³ → 鞋盒 6 dm³ → 微波炉 0.03 m³ → 冰箱 0.5 m³ → 集装箱 33 m³ → 教室 280 m³ → 体育馆
 */
export const CUBIC_REFERENCES: ReferenceObject[] = [
  {
    id: "sesame_cubic",
    label: "一粒芝麻",
    emoji: "•",
    dimension: "cubic",
    size: 1e-9, // 约 1 mm³
    unit: "m³",
    sizeDisplay: "约 1 立方毫米",
    category: "tiny",
  },
  {
    id: "rice_grain",
    label: "一粒大米",
    emoji: "🌾",
    dimension: "cubic",
    size: 2e-8, // 约 20 mm³
    unit: "m³",
    sizeDisplay: "约 20 立方毫米",
    category: "tiny",
  },
  {
    id: "dice",
    label: "骰子",
    emoji: "🎲",
    dimension: "cubic",
    size: 1e-6, // 1 cm³
    unit: "m³",
    sizeDisplay: "1 立方厘米",
    category: "tiny",
  },
  {
    id: "ping_pong_ball",
    label: "乒乓球",
    emoji: "🏓",
    dimension: "cubic",
    size: 3.4e-5, // 直径 4cm 球
    unit: "m³",
    sizeDisplay: "约 34 立方厘米",
    category: "stationery",
  },
  {
    id: "rubiks_cube",
    label: "魔方（3 阶）",
    emoji: "🧊",
    dimension: "cubic",
    size: 2.16e-4, // 6cm 魔方 = 216 cm³
    unit: "m³",
    sizeDisplay: "约 216 立方厘米",
    category: "stationery",
  },
  {
    id: "tennis_ball",
    label: "网球",
    emoji: "🎾",
    dimension: "cubic",
    size: 1.4e-4, // 直径 6.7cm
    unit: "m³",
    sizeDisplay: "约 140 立方厘米",
    category: "stationery",
  },
  {
    id: "shoe_box",
    label: "鞋盒",
    emoji: "👟",
    dimension: "cubic",
    size: 0.006, // 30×20×10cm
    unit: "m³",
    sizeDisplay: "约 6 立方分米",
    category: "stationery",
  },
  {
    id: "basketball",
    label: "篮球",
    emoji: "🏀",
    dimension: "cubic",
    size: 0.0072, // 直径 24cm
    unit: "m³",
    sizeDisplay: "约 7.2 立方分米",
    category: "stationery",
  },
  {
    id: "microwave",
    label: "微波炉",
    emoji: "📦",
    dimension: "cubic",
    size: 0.03, // 30L
    unit: "m³",
    sizeDisplay: "约 30 立方分米",
    category: "furniture",
  },
  {
    id: "school_bag_volume",
    label: "书包",
    emoji: "🎒",
    dimension: "cubic",
    size: 0.025,
    unit: "m³",
    sizeDisplay: "约 25 立方分米",
    category: "stationery",
  },
  {
    id: "fridge_household",
    label: "家用冰箱",
    emoji: "🧊",
    dimension: "cubic",
    size: 0.5, // 500L
    unit: "m³",
    sizeDisplay: "约 0.5 立方米",
    category: "furniture",
  },
  {
    id: "washing_machine",
    label: "洗衣机",
    emoji: "🧺",
    dimension: "cubic",
    size: 0.3,
    unit: "m³",
    sizeDisplay: "约 0.3 立方米",
    category: "furniture",
  },
  {
    id: "small_car_volume",
    label: "小汽车（占体）",
    emoji: "🚗",
    dimension: "cubic",
    size: 12, // 4.5×1.8×1.5
    unit: "m³",
    sizeDisplay: "约 12 立方米",
    category: "vehicle",
  },
  {
    id: "shipping_container",
    label: "标准集装箱",
    emoji: "📦",
    dimension: "cubic",
    size: 33, // 20-foot container ≈ 33 m³
    unit: "m³",
    sizeDisplay: "约 33 立方米",
    category: "vehicle",
  },
  {
    id: "classroom_volume",
    label: "教室空间",
    emoji: "🏫",
    dimension: "cubic",
    size: 280, // 8×7×5
    unit: "m³",
    sizeDisplay: "约 280 立方米",
    category: "building",
  },
  {
    id: "school_pool",
    label: "学校游泳池",
    emoji: "🏊",
    dimension: "cubic",
    size: 1250, // 25×10×5
    unit: "m³",
    sizeDisplay: "约 1250 立方米",
    category: "building",
  },
  {
    id: "ten_floor_building_volume",
    label: "十层楼空间",
    emoji: "🏢",
    dimension: "cubic",
    size: 18000, // 30×20×30
    unit: "m³",
    sizeDisplay: "约 18000 立方米",
    category: "building",
  },
];

/**
 * 重量维度参考物（按 size 升序，单位均为千克 kg）
 * 覆盖：羽毛 → 鸡蛋 → 矿泉水瓶 → 书包 → 西瓜 → 小学生 → 大狗 → 海豚 → 小车 → 大象 → 鲸鱼
 */
export const WEIGHT_REFERENCES: ReferenceObject[] = [
  {
    id: "feather",
    label: "一根羽毛",
    emoji: "🪶",
    dimension: "weight",
    size: 0.0005, // 0.5 g
    unit: "kg",
    sizeDisplay: "约 0.5 克",
    category: "tiny",
  },
  {
    id: "paperclip",
    label: "一枚回形针",
    emoji: "📎",
    dimension: "weight",
    size: 0.001,
    unit: "kg",
    sizeDisplay: "约 1 克",
    category: "stationery",
  },
  {
    id: "coin_1yuan",
    label: "一元硬币",
    emoji: "🪙",
    dimension: "weight",
    size: 0.006,
    unit: "kg",
    sizeDisplay: "约 6 克",
    category: "stationery",
  },
  {
    id: "egg_weight",
    label: "一个鸡蛋",
    emoji: "🥚",
    dimension: "weight",
    size: 0.055,
    unit: "kg",
    sizeDisplay: "约 55 克",
    category: "food",
  },
  {
    id: "apple_weight",
    label: "一个苹果",
    emoji: "🍎",
    dimension: "weight",
    size: 0.2,
    unit: "kg",
    sizeDisplay: "约 200 克",
    category: "food",
  },
  {
    id: "textbook_weight",
    label: "一本课本",
    emoji: "📕",
    dimension: "weight",
    size: 0.4,
    unit: "kg",
    sizeDisplay: "约 400 克",
    category: "stationery",
  },
  {
    id: "mineral_bottle_full",
    label: "一瓶矿泉水",
    emoji: "💧",
    dimension: "weight",
    size: 0.55,
    unit: "kg",
    sizeDisplay: "约 0.55 千克",
    category: "stationery",
  },
  {
    id: "schoolbag_weight",
    label: "一个书包",
    emoji: "🎒",
    dimension: "weight",
    size: 3,
    unit: "kg",
    sizeDisplay: "约 3 千克",
    category: "stationery",
  },
  {
    id: "watermelon",
    label: "一个西瓜",
    emoji: "🍉",
    dimension: "weight",
    size: 5,
    unit: "kg",
    sizeDisplay: "约 5 千克",
    category: "food",
  },
  {
    id: "cat_weight",
    label: "一只家猫",
    emoji: "🐱",
    dimension: "weight",
    size: 4,
    unit: "kg",
    sizeDisplay: "约 4 千克",
    category: "animal",
  },
  {
    id: "dog_big_weight",
    label: "一条大狗",
    emoji: "🐕",
    dimension: "weight",
    size: 25,
    unit: "kg",
    sizeDisplay: "约 25 千克",
    category: "animal",
  },
  {
    id: "primary_kid_weight",
    label: "一名小学生",
    emoji: "🧒",
    dimension: "weight",
    size: 30,
    unit: "kg",
    sizeDisplay: "约 30 千克",
    category: "body",
  },
  {
    id: "adult_weight",
    label: "一个成年人",
    emoji: "🧑",
    dimension: "weight",
    size: 65,
    unit: "kg",
    sizeDisplay: "约 65 千克",
    category: "body",
  },
  {
    id: "dolphin_weight",
    label: "一只海豚",
    emoji: "🐬",
    dimension: "weight",
    size: 200,
    unit: "kg",
    sizeDisplay: "约 200 千克",
    category: "animal",
  },
  {
    id: "panda_adult",
    label: "成年大熊猫",
    emoji: "🐼",
    dimension: "weight",
    size: 110,
    unit: "kg",
    sizeDisplay: "约 110 千克",
    category: "animal",
  },
  {
    id: "small_car_weight",
    label: "一辆小汽车",
    emoji: "🚗",
    dimension: "weight",
    size: 1500,
    unit: "kg",
    sizeDisplay: "约 1.5 吨",
    category: "vehicle",
  },
  {
    id: "elephant_weight",
    label: "一头亚洲象",
    emoji: "🐘",
    dimension: "weight",
    size: 4000,
    unit: "kg",
    sizeDisplay: "约 4 吨",
    category: "animal",
  },
  {
    id: "blue_whale_weight",
    label: "一头蓝鲸",
    emoji: "🐋",
    dimension: "weight",
    size: 150000,
    unit: "kg",
    sizeDisplay: "约 150 吨",
    category: "animal",
  },
];

/**
 * 时间维度参考物（按 size 升序，单位均为秒 s）
 * 覆盖：眨眼 → 心跳 → 跳绳一下 → 课间十分钟 → 一节课 → 一觉 → 一周 → 一年
 */
export const TIME_REFERENCES: ReferenceObject[] = [
  {
    id: "blink_eye",
    label: "眨一下眼",
    emoji: "👁️",
    dimension: "time",
    size: 0.3,
    unit: "s",
    sizeDisplay: "约 0.3 秒",
    category: "body",
  },
  {
    id: "snap_finger",
    label: "打一个响指",
    emoji: "👌",
    dimension: "time",
    size: 0.5,
    unit: "s",
    sizeDisplay: "约 0.5 秒",
    category: "body",
  },
  {
    id: "heartbeat",
    label: "心跳一次",
    emoji: "❤️",
    dimension: "time",
    size: 0.85,
    unit: "s",
    sizeDisplay: "约 0.85 秒",
    category: "body",
  },
  {
    id: "deep_breath",
    label: "深呼吸一次",
    emoji: "💨",
    dimension: "time",
    size: 4,
    unit: "s",
    sizeDisplay: "约 4 秒",
    category: "body",
  },
  {
    id: "brush_teeth",
    label: "刷一次牙",
    emoji: "🪥",
    dimension: "time",
    size: 180,
    unit: "s",
    sizeDisplay: "约 3 分钟",
    category: "body",
  },
  {
    id: "boil_egg",
    label: "煮一个鸡蛋",
    emoji: "🥚",
    dimension: "time",
    size: 480,
    unit: "s",
    sizeDisplay: "约 8 分钟",
    category: "food",
  },
  {
    id: "recess_break",
    label: "课间休息",
    emoji: "🏃",
    dimension: "time",
    size: 600,
    unit: "s",
    sizeDisplay: "10 分钟",
    category: "school",
  },
  {
    id: "school_lesson",
    label: "一节课",
    emoji: "🏫",
    dimension: "time",
    size: 2400, // 40 分钟
    unit: "s",
    sizeDisplay: "40 分钟",
    category: "school",
  },
  {
    id: "cartoon_movie",
    label: "一部动画电影",
    emoji: "🎬",
    dimension: "time",
    size: 5400, // 90 分钟
    unit: "s",
    sizeDisplay: "约 1.5 小时",
    category: "entertainment",
  },
  {
    id: "school_morning",
    label: "上午的课",
    emoji: "🌅",
    dimension: "time",
    size: 14400, // 4 小时
    unit: "s",
    sizeDisplay: "约 4 小时",
    category: "school",
  },
  {
    id: "night_sleep",
    label: "一觉睡到天亮",
    emoji: "😴",
    dimension: "time",
    size: 32400, // 9 小时
    unit: "s",
    sizeDisplay: "约 9 小时",
    category: "body",
  },
  {
    id: "one_day",
    label: "一天",
    emoji: "🌞",
    dimension: "time",
    size: 86400,
    unit: "s",
    sizeDisplay: "24 小时",
    category: "world",
  },
  {
    id: "one_week",
    label: "一个星期",
    emoji: "📅",
    dimension: "time",
    size: 86400 * 7,
    unit: "s",
    sizeDisplay: "7 天",
    category: "world",
  },
  {
    id: "winter_holiday",
    label: "寒假",
    emoji: "❄️",
    dimension: "time",
    size: 86400 * 30,
    unit: "s",
    sizeDisplay: "约 1 个月",
    category: "school",
  },
  {
    id: "summer_holiday",
    label: "暑假",
    emoji: "🏖️",
    dimension: "time",
    size: 86400 * 60,
    unit: "s",
    sizeDisplay: "约 2 个月",
    category: "school",
  },
  {
    id: "one_school_year",
    label: "一学年",
    emoji: "📚",
    dimension: "time",
    size: 86400 * 280,
    unit: "s",
    sizeDisplay: "约 280 天",
    category: "school",
  },
  {
    id: "one_year",
    label: "一年",
    emoji: "🗓️",
    dimension: "time",
    size: 86400 * 365,
    unit: "s",
    sizeDisplay: "365 天",
    category: "world",
  },
];

/** 全部参考物 */
export const ALL_REFERENCES: ReferenceObject[] = [
  ...LENGTH_REFERENCES,
  ...AREA_REFERENCES,
  ...VOLUME_REFERENCES,
  ...CUBIC_REFERENCES,
  ...WEIGHT_REFERENCES,
  ...TIME_REFERENCES,
];

/** 按 ID 查 */
export const REFERENCE_MAP = Object.fromEntries(
  ALL_REFERENCES.map((r) => [r.id, r]),
) as Record<string, ReferenceObject>;

/** 给 AI 的极简列表（id + label + size + hainan + axis） */
export function getReferencesForAI(
  dimension: DimensionKey,
): Array<
  Pick<ReferenceObject, "id" | "label" | "size" | "unit" | "hainan" | "axis">
> {
  return ALL_REFERENCES.filter((r) => r.dimension === dimension).map((r) => ({
    id: r.id,
    label: r.label,
    size: r.size,
    unit: r.unit,
    hainan: r.hainan,
    axis: r.axis ?? "horizontal",
  }));
}
