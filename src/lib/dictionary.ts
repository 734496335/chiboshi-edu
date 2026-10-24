/**
 * 量感字典数据 —— 长度维度
 *
 * 设计原则（参见对话里的儿童教育产品设计逻辑）：
 *   1. 按"数量级刻度"组织：1mm / 1cm / 10cm / 1m / 10m / 100m / 1km
 *   2. 每个刻度精选 3 个有身体经验/情感记忆的物品作为锚点
 *   3. 每张卡只承担一个"记忆钩子"（hook），不堆百科信息
 *   4. 视觉直接复用 catalog（visual-assets.json）已烤 PNG
 *
 * 注意：`sizeM` 是物品的真实尺寸，不一定恰好等于刻度值——孩子要看到
 * "蚂蚁是 5 毫米，比 1 毫米大一点"这种真实关系，而不是被强行对齐到刻度。
 */

export interface DictItem {
  /** catalog id（对应 /public/icons/pixel/<id>.png）。
   *  必须在 visual-assets.json 中，PNG 必须已烤。 */
  catalogId: string;
  /** 显示名（覆盖 catalog label，可选）。一般不传，直接用 catalog 的 label。 */
  label?: string;
  /** 真实尺寸，单位 = 米。用于排序、搜索匹配。 */
  sizeM: number;
  /** 友好尺寸文案，如 "约 2 毫米"。直接展示给孩子看。 */
  sizeText: string;
  /** 记忆锚点（hook）—— 一行短句，建立和身体/经验的连接。最多 18 字。 */
  hook: string;
}

export interface DictScale {
  /** 刻度 id，用于路由 hash 与 scrollspy。 */
  id: string;
  /** 显示标题，如 "1 毫米"。 */
  title: string;
  /** 量级数值（米），用于排序。 */
  magnitudeM: number;
  /** 给孩子的"导览语"，一行话点出这个量级的感觉。 */
  tagline: string;
  /** 强调色（与维度色相关，但按量级渐变更有节奏）。 */
  accent: string;
  /** 3 个物品锚点（严格 3 个，多了认知负担）。 */
  items: DictItem[];
}

// ─────────────────────────────────────────────────────────────
// 长度量感字典（小学一年级末 ~ 六年级覆盖）
// ─────────────────────────────────────────────────────────────
export const LENGTH_DICTIONARY: DictScale[] = [
  {
    id: "mm",
    title: "1 毫米",
    magnitudeM: 0.001,
    tagline: "用手指捏起来都怕弄丢的小东西",
    accent: "#B57BFF",
    items: [
      {
        catalogId: "sesame_seed",
        label: "芝麻",
        sizeM: 0.002,
        sizeText: "约 2 毫米",
        hook: "按每粒约 2 毫米估算，10 粒约 2 厘米",
      },
      {
        catalogId: "rice_grain",
        label: "米粒",
        sizeM: 0.005,
        sizeText: "约 5 毫米长",
        hook: "比芝麻大一点点",
      },
      {
        catalogId: "ant",
        label: "蚂蚁",
        sizeM: 0.005,
        sizeText: "约 5 毫米长",
        hook: "5 只首尾相连约 2 厘米半",
      },
    ],
  },
  {
    id: "cm",
    title: "1 厘米",
    magnitudeM: 0.01,
    tagline: "差不多就是你小拇指指甲那么宽",
    accent: "#4A90D9",
    items: [
      {
        catalogId: "dice_cube",
        label: "骰子",
        sizeM: 0.016,
        sizeText: "边长约 1.6 厘米",
        hook: "握在拳头里看不见",
      },
      {
        catalogId: "coin_1yuan",
        label: "1 元硬币",
        sizeM: 0.025,
        sizeText: "直径约 2.5 厘米",
        hook: "刚好盖住小拇指指甲",
      },
      {
        catalogId: "eraser",
        label: "橡皮",
        sizeM: 0.05,
        sizeText: "约 5 厘米长",
        hook: "比 2 个 1 元硬币长一点",
      },
    ],
  },
  {
    id: "10cm",
    title: "10 厘米",
    magnitudeM: 0.1,
    tagline: "张开手大拇指到中指的距离——一拃",
    accent: "#2EC4B6",
    items: [
      {
        catalogId: "pencil_hb",
        label: "铅笔",
        sizeM: 0.18,
        sizeText: "约 18 厘米长",
        hook: "和你的小臂差不多长",
      },
      {
        catalogId: "chopstick",
        label: "筷子",
        sizeM: 0.24,
        sizeText: "约 24 厘米长",
        hook: "比一根铅笔长一点",
      },
      {
        catalogId: "ruler_30cm",
        label: "30 厘米直尺",
        sizeM: 0.3,
        sizeText: "30 厘米",
        hook: "横放在课桌上刚好不超出",
      },
    ],
  },
  {
    id: "1m",
    title: "1 米",
    magnitudeM: 1,
    tagline: "差不多到一年级小朋友的肩膀那么高",
    accent: "#58CC02",
    items: [
      {
        catalogId: "school_desk",
        label: "课桌",
        sizeM: 0.6,
        sizeText: "宽约 60 厘米",
        hook: "趴下来手臂抱不全",
      },
      {
        catalogId: "child_height",
        label: "一年级小朋友",
        sizeM: 1.2,
        sizeText: "身高约 1.2 米",
        hook: "和你差不多哦",
      },
      {
        catalogId: "adult_height",
        label: "成年人",
        sizeM: 1.7,
        sizeText: "身高约 1.7 米",
        hook: "你要踮脚才能摸到他的头",
      },
    ],
  },
  {
    id: "10m",
    title: "10 米",
    magnitudeM: 10,
    tagline: "需要抬头才能看到顶的高度",
    accent: "#FFC93C",
    items: [
      {
        catalogId: "flagpole",
        label: "旗杆",
        sizeM: 8,
        sizeText: "高约 8 米",
        hook: "像 5 个爸爸摞起来",
      },
      {
        catalogId: "school_bus",
        label: "校车",
        sizeM: 11,
        sizeText: "长约 11 米",
        hook: "排队的话能站下 50 个小朋友",
      },
      {
        catalogId: "coconut_tree",
        label: "椰子树",
        sizeM: 25,
        sizeText: "高约 25 米",
        hook: "比 3 根旗杆还要高",
      },
    ],
  },
  {
    id: "100m",
    title: "100 米",
    magnitudeM: 100,
    tagline: "一栋大楼那么高，或一片操场那么长",
    accent: "#FF9F43",
    items: [
      {
        catalogId: "basketball_court",
        label: "篮球场",
        sizeM: 28,
        sizeText: "长约 28 米",
        hook: "运球冲过去要 10 秒",
      },
      {
        catalogId: "soccer_field",
        label: "足球场",
        sizeM: 100,
        sizeText: "长 100 米",
        hook: "你冲刺也要 20 多秒",
      },
      {
        catalogId: "thirty_story_building",
        label: "30 层大楼",
        sizeM: 90,
        sizeText: "高约 90 米（30 层）",
        hook: "从地面看顶楼像小蚂蚁",
      },
    ],
  },
  {
    id: "1km",
    title: "1 千米",
    magnitudeM: 1000,
    tagline: "走 15 分钟才能走完的距离",
    accent: "#FF5B5B",
    items: [
      {
        catalogId: "running_track",
        label: "操场跑道",
        sizeM: 400,
        sizeText: "1 圈 400 米",
        hook: "走 2 圈半就是 1 千米",
      },
      {
        catalogId: "haikou_bay_bridge",
        label: "海口湾跨海大桥",
        sizeM: 5000,
        sizeText: "长约 5 千米",
        hook: "开车要 4 分钟才过完",
      },
      {
        catalogId: "hzmb_bridge",
        label: "港珠澳大桥",
        sizeM: 55000,
        sizeText: "全长约 55 千米",
        hook: "校车要开 50 分钟",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 面积量感字典（cm² → km²，跨越 7 个数量级）
// ─────────────────────────────────────────────────────────────
export const AREA_DICTIONARY: DictScale[] = [
  {
    id: "cm2",
    title: "1 平方厘米",
    magnitudeM: 0.0001,
    tagline: "比指甲盖大一点点",
    accent: "#B57BFF",
    items: [
      {
        catalogId: "postage_stamp",
        label: "邮票",
        sizeM: 0.0004,
        sizeText: "约 4 平方厘米",
        hook: "差不多 4 个指甲盖大",
      },
      {
        catalogId: "business_card",
        label: "名片",
        sizeM: 0.0055,
        sizeText: "约 55 平方厘米",
        hook: "正好握在掌心里",
      },
      {
        catalogId: "smartphone",
        label: "手机屏幕",
        sizeM: 0.012,
        sizeText: "约 120 平方厘米",
        hook: "大概是 30 张邮票铺一起",
      },
    ],
  },
  {
    id: "page",
    title: "一页纸大小",
    magnitudeM: 0.05,
    tagline: "孩子最常碰到的「一面」",
    accent: "#4A90D9",
    items: [
      {
        catalogId: "textbook_math",
        label: "数学课本封面",
        sizeM: 0.038,
        sizeText: "约 380 平方厘米",
        hook: "和你的脸大小差不多",
      },
      {
        catalogId: "paper_a4",
        label: "一张 A4 纸",
        sizeM: 0.0624,
        sizeText: "约 624 平方厘米",
        hook: "考试卷就是 A4 纸",
      },
      {
        catalogId: "newspaper_open",
        label: "一张报纸（摊开）",
        sizeM: 0.36,
        sizeText: "约 0.36 平方米",
        hook: "等于 6 张 A4 纸拼起来",
      },
    ],
  },
  {
    id: "m2",
    title: "1 平方米",
    magnitudeM: 1,
    tagline: "差不多够 4 个小朋友站在一起",
    accent: "#2EC4B6",
    items: [
      {
        catalogId: "school_desk_top",
        label: "课桌桌面",
        sizeM: 0.4,
        sizeText: "约 0.4 平方米",
        hook: "趴在上面手都摸不到对边",
      },
      {
        catalogId: "double_bed",
        label: "双人床",
        sizeM: 3,
        sizeText: "约 3 平方米",
        hook: "一家三口能一起躺",
      },
      {
        catalogId: "ping_pong_table",
        label: "乒乓球台",
        sizeM: 4.18,
        sizeText: "约 4.2 平方米",
        hook: "差不多 10 张课桌拼起来",
      },
    ],
  },
  {
    id: "10m2",
    title: "10 平方米",
    magnitudeM: 10,
    tagline: "一个小房间那么大",
    accent: "#58CC02",
    items: [
      {
        catalogId: "parking_spot",
        label: "停车位",
        sizeM: 12.5,
        sizeText: "约 12.5 平方米",
        hook: "一辆汽车占的地",
      },
      {
        catalogId: "small_apartment",
        label: "一居室",
        sizeM: 50,
        sizeText: "约 50 平方米",
        hook: "卧室 + 客厅 + 厨房就是这么大",
      },
      {
        catalogId: "classroom",
        label: "教室地面",
        sizeM: 56,
        sizeText: "约 56 平方米",
        hook: "够装下你们整个班",
      },
    ],
  },
  {
    id: "100m2",
    title: "100 平方米",
    magnitudeM: 100,
    tagline: "一片小操场那么大",
    accent: "#FFC93C",
    items: [
      {
        catalogId: "basketball_half_court",
        label: "篮球半场",
        sizeM: 210,
        sizeText: "约 210 平方米",
        hook: "运球冲过去要 5 秒",
      },
      {
        catalogId: "tennis_court",
        label: "网球场",
        sizeM: 261,
        sizeText: "约 261 平方米",
        hook: "比 4 间教室还大",
      },
      {
        catalogId: "basketball_court",
        label: "篮球场",
        sizeM: 420,
        sizeText: "约 420 平方米",
        hook: "可以摆 1000 张课桌",
      },
    ],
  },
  {
    id: "ha",
    title: "1 公顷",
    magnitudeM: 10000,
    tagline: "差不多 1.5 个标准足球场",
    accent: "#FF9F43",
    items: [
      {
        catalogId: "soccer_field",
        label: "标准足球场",
        sizeM: 7140,
        sizeText: "约 7140 平方米",
        hook: "踢一次球能跑 3-5 千米",
      },
      {
        catalogId: "birds_nest",
        label: "鸟巢（外轮廓）",
        sizeM: 250000,
        sizeText: "约 25 公顷",
        hook: "约 35 个足球场",
      },
      {
        catalogId: "tiananmen",
        label: "天安门广场",
        sizeM: 440000,
        sizeText: "约 44 公顷",
        hook: "能站下 100 万人",
      },
    ],
  },
  {
    id: "km2",
    title: "1 平方千米",
    magnitudeM: 1000000,
    tagline: "走半天才能走遍的一片地",
    accent: "#FF5B5B",
    items: [
      {
        catalogId: "forbidden_city",
        label: "故宫",
        sizeM: 720000,
        sizeText: "约 72 公顷",
        hook: "9999 间房都装得下",
      },
      {
        catalogId: "central_park_ny",
        label: "纽约中央公园",
        sizeM: 3.41e6,
        sizeText: "约 3.41 平方千米",
        hook: "差不多 5 个故宫",
      },
      {
        catalogId: "haikou_meilan_airport",
        label: "海口美兰机场",
        sizeM: 6.7e6,
        sizeText: "约 6.7 平方千米",
        hook: "1000 架飞机一起停的地方",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 容积量感字典（mL → m³，"能装多少水"）
// ─────────────────────────────────────────────────────────────
export const VOLUME_DICTIONARY: DictScale[] = [
  {
    id: "ml-tiny",
    title: "1 毫升",
    magnitudeM: 0.001,
    tagline: "用滴管才能数清楚的一点点水",
    accent: "#B57BFF",
    items: [
      {
        catalogId: "eyedropper_drop",
        label: "一滴水",
        sizeM: 0.00005,
        sizeText: "约 0.05 毫升",
        hook: "20 滴才凑成 1 毫升",
      },
      {
        catalogId: "spoon_teaspoon",
        label: "一茶匙",
        sizeM: 0.005,
        sizeText: "约 5 毫升",
        hook: "感冒糖浆一次喝这么多",
      },
      {
        catalogId: "soup_spoon",
        label: "一汤勺",
        sizeM: 0.015,
        sizeText: "约 15 毫升",
        hook: "等于 3 茶匙",
      },
    ],
  },
  {
    id: "ml-cup",
    title: "100 毫升",
    magnitudeM: 0.1,
    tagline: "一杯小杯子的水",
    accent: "#4A90D9",
    items: [
      {
        catalogId: "yogurt_cup",
        label: "酸奶杯",
        sizeM: 0.15,
        sizeText: "约 150 毫升",
        hook: "课间喝一盒刚好",
      },
      {
        catalogId: "tea_cup",
        label: "茶杯",
        sizeM: 0.2,
        sizeText: "约 200 毫升",
        hook: "和漱口杯差不多",
      },
      {
        catalogId: "soda_can",
        label: "易拉罐",
        sizeM: 0.33,
        sizeText: "约 330 毫升",
        hook: "等于 2 杯酸奶",
      },
    ],
  },
  {
    id: "l",
    title: "1 升",
    magnitudeM: 1,
    tagline: "一大瓶矿泉水那么多",
    accent: "#2EC4B6",
    items: [
      {
        catalogId: "water_bottle",
        label: "矿泉水瓶",
        sizeM: 0.55,
        sizeText: "约 550 毫升",
        hook: "运动时一次能喝完",
      },
      {
        catalogId: "milk_carton",
        label: "牛奶盒",
        sizeM: 1,
        sizeText: "1 升",
        hook: "正好 1000 毫升",
      },
      {
        catalogId: "kettle",
        label: "热水壶",
        sizeM: 1.5,
        sizeText: "约 1.5 升",
        hook: "够泡 6 杯茶",
      },
    ],
  },
  {
    id: "10l",
    title: "10 升",
    magnitudeM: 10,
    tagline: "提起来手会酸的一桶",
    accent: "#58CC02",
    items: [
      {
        catalogId: "rice_cooker",
        label: "电饭煲",
        sizeM: 5,
        sizeText: "约 5 升",
        hook: "够做 30 碗米饭",
      },
      {
        catalogId: "bucket_household",
        label: "家用水桶",
        sizeM: 18,
        sizeText: "约 18 升",
        hook: "= 18 瓶大矿泉水",
      },
      {
        catalogId: "fish_tank",
        label: "家用鱼缸",
        sizeM: 100,
        sizeText: "约 100 升",
        hook: "= 100 盒牛奶",
      },
    ],
  },
  {
    id: "200l",
    title: "200 升",
    magnitudeM: 200,
    tagline: "一缸水的量",
    accent: "#FFC93C",
    items: [
      {
        catalogId: "bathtub",
        label: "浴缸",
        sizeM: 200,
        sizeText: "约 200 升",
        hook: "泡澡能装下 1 个大人",
      },
      {
        catalogId: "swimming_pool",
        label: "儿童游泳池",
        sizeM: 800,
        sizeText: "约 800 升",
        hook: "= 4 个浴缸",
      },
      {
        catalogId: "water_tanker_truck",
        label: "洒水车水罐",
        sizeM: 5000,
        sizeText: "约 5 立方米",
        hook: "= 25 个浴缸",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 体积量感字典（cm³ → m³，"占多大空间"）
// ─────────────────────────────────────────────────────────────
export const CUBIC_DICTIONARY: DictScale[] = [
  {
    id: "cm3",
    title: "1 立方厘米",
    magnitudeM: 1e-6,
    tagline: "用手指捏起来都嫌小的小方块",
    accent: "#B57BFF",
    items: [
      {
        catalogId: "sesame_seed",
        label: "一粒芝麻",
        sizeM: 1e-9,
        sizeText: "约 1 立方毫米",
        hook: "1 升空间能装 10 亿粒",
      },
      {
        catalogId: "rice_grain",
        label: "一粒大米",
        sizeM: 2e-8,
        sizeText: "约 20 立方毫米",
        hook: "比芝麻大 20 倍",
      },
      {
        catalogId: "dice_cube",
        label: "骰子",
        sizeM: 1e-6,
        sizeText: "1 立方厘米",
        hook: "刚好是边长 1 厘米的小方块",
      },
    ],
  },
  {
    id: "ball",
    title: "100 立方厘米",
    magnitudeM: 1e-4,
    tagline: "握在手里的一个球",
    accent: "#4A90D9",
    items: [
      {
        catalogId: "ping_pong_ball",
        label: "乒乓球",
        sizeM: 3.4e-5,
        sizeText: "约 34 立方厘米",
        hook: "中空但占的地不少",
      },
      {
        catalogId: "tennis_ball",
        label: "网球",
        sizeM: 1.4e-4,
        sizeText: "约 140 立方厘米",
        hook: "= 4 个乒乓球",
      },
      {
        catalogId: "rubiks_cube",
        label: "魔方（3 阶）",
        sizeM: 2.16e-4,
        sizeText: "约 216 立方厘米",
        hook: "边长 6 厘米的方块",
      },
    ],
  },
  {
    id: "dm3",
    title: "1 立方分米",
    magnitudeM: 1e-3,
    tagline: "= 1 升，差不多一盒牛奶大",
    accent: "#2EC4B6",
    items: [
      {
        catalogId: "shoe_box",
        label: "鞋盒",
        sizeM: 0.006,
        sizeText: "约 6 立方分米",
        hook: "一双运动鞋的家",
      },
      {
        catalogId: "basketball",
        label: "篮球",
        sizeM: 0.0072,
        sizeText: "约 7.2 立方分米",
        hook: "比鞋盒占地稍大一点",
      },
      {
        catalogId: "backpack",
        label: "书包",
        sizeM: 0.025,
        sizeText: "约 25 立方分米",
        hook: "= 25 盒牛奶塞一起",
      },
    ],
  },
  {
    id: "m3-small",
    title: "1 立方米",
    magnitudeM: 1,
    tagline: "比家里的洗衣机大一点的方块",
    accent: "#58CC02",
    items: [
      {
        catalogId: "washing_machine",
        label: "洗衣机",
        sizeM: 0.3,
        sizeText: "约 0.3 立方米",
        hook: "= 300 盒牛奶的空间",
      },
      {
        catalogId: "fridge_household",
        label: "家用冰箱",
        sizeM: 0.5,
        sizeText: "约 0.5 立方米",
        hook: "比洗衣机大",
      },
      {
        catalogId: "small_car",
        label: "小汽车（占体）",
        sizeM: 12,
        sizeText: "约 12 立方米",
        hook: "= 12 个 1 立方米方块",
      },
    ],
  },
  {
    id: "m3-big",
    title: "100 立方米",
    magnitudeM: 100,
    tagline: "一间教室那么大的空间",
    accent: "#FFC93C",
    items: [
      {
        catalogId: "shipping_container",
        label: "标准集装箱",
        sizeM: 33,
        sizeText: "约 33 立方米",
        hook: "= 3 间小卧室",
      },
      {
        catalogId: "classroom",
        label: "教室空间",
        sizeM: 280,
        sizeText: "约 280 立方米",
        hook: "= 8 个集装箱",
      },
      {
        catalogId: "swimming_pool",
        label: "学校游泳池",
        sizeM: 1250,
        sizeText: "约 1250 立方米",
        hook: "= 4 间教室",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 重量量感字典（克 → 吨，"有多沉"）
// ─────────────────────────────────────────────────────────────
export const WEIGHT_DICTIONARY: DictScale[] = [
  {
    id: "g-tiny",
    title: "1 克",
    magnitudeM: 0.001,
    tagline: "拿在手里几乎感觉不到的重量",
    accent: "#B57BFF",
    items: [
      {
        catalogId: "feather",
        label: "一根羽毛",
        sizeM: 0.0005,
        sizeText: "约 0.5 克",
        hook: "风一吹就飞走",
      },
      {
        catalogId: "paperclip",
        label: "一枚回形针",
        sizeM: 0.001,
        sizeText: "约 1 克",
        hook: "正好 1 克的小物件",
      },
      {
        catalogId: "coin_1yuan",
        label: "一元硬币",
        sizeM: 0.006,
        sizeText: "约 6 克",
        hook: "= 6 枚回形针",
      },
    ],
  },
  {
    id: "g-100",
    title: "100 克",
    magnitudeM: 0.1,
    tagline: "拿在手里有点分量了",
    accent: "#4A90D9",
    items: [
      {
        catalogId: "egg_chicken",
        label: "一个鸡蛋",
        sizeM: 0.055,
        sizeText: "约 55 克",
        hook: "= 9 枚 1 元硬币",
      },
      {
        catalogId: "apple",
        label: "一个苹果",
        sizeM: 0.2,
        sizeText: "约 200 克",
        hook: "= 4 个鸡蛋",
      },
      {
        catalogId: "textbook_math",
        label: "一本课本",
        sizeM: 0.4,
        sizeText: "约 400 克",
        hook: "= 2 个苹果",
      },
    ],
  },
  {
    id: "kg",
    title: "1 千克",
    magnitudeM: 1,
    tagline: "一只手能稳稳举起来的重量",
    accent: "#2EC4B6",
    items: [
      {
        catalogId: "water_bottle",
        label: "一瓶矿泉水",
        sizeM: 0.55,
        sizeText: "约 0.55 千克",
        hook: "550 克水正好",
      },
      {
        catalogId: "backpack",
        label: "一个书包",
        sizeM: 3,
        sizeText: "约 3 千克",
        hook: "压在背上腰会酸",
      },
      {
        catalogId: "watermelon",
        label: "一个西瓜",
        sizeM: 5,
        sizeText: "约 5 千克",
        hook: "抱起来要用两只手",
      },
    ],
  },
  {
    id: "kg-10",
    title: "10 千克",
    magnitudeM: 10,
    tagline: "需要双手抱才扛得动",
    accent: "#58CC02",
    items: [
      {
        catalogId: "cat_house",
        label: "一只家猫",
        sizeM: 4,
        sizeText: "约 4 千克",
        hook: "刚好够抱在怀里",
      },
      {
        catalogId: "dog_large",
        label: "一条大狗",
        sizeM: 25,
        sizeText: "约 25 千克",
        hook: "= 5 只家猫的重量",
      },
      {
        catalogId: "child_height",
        label: "一名小学生",
        sizeM: 30,
        sizeText: "约 30 千克",
        hook: "和你差不多哦",
      },
    ],
  },
  {
    id: "kg-100",
    title: "100 千克",
    magnitudeM: 100,
    tagline: "一只大动物的重量",
    accent: "#FFC93C",
    items: [
      {
        catalogId: "adult_height",
        label: "一个成年人",
        sizeM: 65,
        sizeText: "约 65 千克",
        hook: "你爸爸大约这么重",
      },
      {
        catalogId: "panda_giant",
        label: "成年大熊猫",
        sizeM: 110,
        sizeText: "约 110 千克",
        hook: "比 1 个爸爸还重一点",
      },
      {
        catalogId: "dolphin",
        label: "一只海豚",
        sizeM: 200,
        sizeText: "约 200 千克",
        hook: "= 3 个爸爸",
      },
    ],
  },
  {
    id: "ton",
    title: "1 吨",
    magnitudeM: 1000,
    tagline: "汽车级的重量",
    accent: "#FF9F43",
    items: [
      {
        catalogId: "small_car",
        label: "一辆小汽车",
        sizeM: 1500,
        sizeText: "约 1.5 吨",
        hook: "= 50 个小学生",
      },
      {
        catalogId: "elephant_asian",
        label: "一头亚洲象",
        sizeM: 4000,
        sizeText: "约 4 吨",
        hook: "= 3 辆小汽车",
      },
      {
        catalogId: "blue_whale",
        label: "一头蓝鲸",
        sizeM: 150000,
        sizeText: "约 150 吨",
        hook: "= 100 辆小汽车",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 时间量感字典（秒 → 年，"过得快不快"）
//
// 时间维度的 catalogId 是为时间专门设计的语义图（眨眼 / 心脏 / 闹钟 / 月亮），
// 大部分在 visual-assets.json 中是占位符；如 PNG 缺失，前端 PixelIcon 的多级
// fallback 会显示对应 emoji，依然不影响阅读。
// ─────────────────────────────────────────────────────────────
export const TIME_DICTIONARY: DictScale[] = [
  {
    id: "sec-fast",
    title: "1 秒",
    magnitudeM: 1,
    tagline: "眨眼一瞬间的事",
    accent: "#B57BFF",
    items: [
      {
        catalogId: "blink_eye",
        label: "眨一下眼",
        sizeM: 0.3,
        sizeText: "约 0.3 秒",
        hook: "比心跳还快",
      },
      {
        catalogId: "snap_finger",
        label: "打一个响指",
        sizeM: 0.5,
        sizeText: "约 0.5 秒",
        hook: "= 半秒",
      },
      {
        catalogId: "heartbeat",
        label: "心跳一次",
        sizeM: 0.85,
        sizeText: "约 0.85 秒",
        hook: "1 分钟跳 70 多次",
      },
    ],
  },
  {
    id: "min",
    title: "1 分钟",
    magnitudeM: 60,
    tagline: "数 60 个数的时间",
    accent: "#4A90D9",
    items: [
      {
        catalogId: "deep_breath",
        label: "深呼吸一次",
        sizeM: 4,
        sizeText: "约 4 秒",
        hook: "1 分钟做 15 次",
      },
      {
        catalogId: "brush_teeth",
        label: "刷一次牙",
        sizeM: 180,
        sizeText: "约 3 分钟",
        hook: "= 180 秒",
      },
      {
        catalogId: "boil_egg",
        label: "煮一个鸡蛋",
        sizeM: 480,
        sizeText: "约 8 分钟",
        hook: "够你刷 2 次牙",
      },
    ],
  },
  {
    id: "lesson",
    title: "一节课",
    magnitudeM: 2400,
    tagline: "上课到下课的时间",
    accent: "#2EC4B6",
    items: [
      {
        catalogId: "recess_break",
        label: "课间休息",
        sizeM: 600,
        sizeText: "10 分钟",
        hook: "够喝水上厕所",
      },
      {
        catalogId: "school_lesson",
        label: "一节课",
        sizeM: 2400,
        sizeText: "40 分钟",
        hook: "= 4 个课间",
      },
      {
        catalogId: "cartoon_movie",
        label: "一部动画电影",
        sizeM: 5400,
        sizeText: "约 1.5 小时",
        hook: "= 2 节课多一点",
      },
    ],
  },
  {
    id: "day",
    title: "1 天",
    magnitudeM: 86400,
    tagline: "从太阳出来到月亮升起",
    accent: "#58CC02",
    items: [
      {
        catalogId: "school_morning",
        label: "上午的课",
        sizeM: 14400,
        sizeText: "约 4 小时",
        hook: "= 6 节课",
      },
      {
        catalogId: "night_sleep",
        label: "一觉睡到天亮",
        sizeM: 32400,
        sizeText: "约 9 小时",
        hook: "占一天的三分之一",
      },
      {
        catalogId: "one_day",
        label: "一天",
        sizeM: 86400,
        sizeText: "24 小时",
        hook: "= 1440 分钟",
      },
    ],
  },
  {
    id: "week",
    title: "1 周",
    magnitudeM: 86400 * 7,
    tagline: "从周一到周日",
    accent: "#FFC93C",
    items: [
      {
        catalogId: "one_week",
        label: "一个星期",
        sizeM: 86400 * 7,
        sizeText: "7 天",
        hook: "= 168 小时",
      },
      {
        catalogId: "winter_holiday",
        label: "寒假",
        sizeM: 86400 * 30,
        sizeText: "约 1 个月",
        hook: "= 4 个星期",
      },
      {
        catalogId: "summer_holiday",
        label: "暑假",
        sizeM: 86400 * 60,
        sizeText: "约 2 个月",
        hook: "比寒假长一倍",
      },
    ],
  },
  {
    id: "year",
    title: "1 年",
    magnitudeM: 86400 * 365,
    tagline: "过完所有节日就是一年",
    accent: "#FF5B5B",
    items: [
      {
        catalogId: "one_school_year",
        label: "一学年",
        sizeM: 86400 * 280,
        sizeText: "约 280 天",
        hook: "学校陪你的 280 天",
      },
      {
        catalogId: "one_year",
        label: "一年",
        sizeM: 86400 * 365,
        sizeText: "365 天",
        hook: "= 12 个月",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 维度 → 字典 映射
//
// 6 大维度全部上线，与 DimensionTabBar 一致：
//   length / area / cubic / volume / weight / time
// ─────────────────────────────────────────────────────────────
export function getDictionaryForDimension(
  dimension: string,
): DictScale[] {
  switch (dimension) {
    case "length":
      return LENGTH_DICTIONARY;
    case "area":
      return AREA_DICTIONARY;
    case "cubic":
      return CUBIC_DICTIONARY;
    case "volume":
      return VOLUME_DICTIONARY;
    case "weight":
      return WEIGHT_DICTIONARY;
    case "time":
      return TIME_DICTIONARY;
    default:
      return [];
  }
}

/** 字典所有锚点条目（扁平化），便于搜索 / 关联跳转。 */
export function getAllDictItems(dimension: string): DictItem[] {
  const scales = getDictionaryForDimension(dimension);
  return scales.flatMap((s) => s.items);
}
