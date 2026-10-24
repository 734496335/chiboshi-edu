/**
 * 中文 → 英文关键词映射
 *
 * 用于把学生 / 老师输入的中文物体名翻译成英文 token，
 * 进而在 Iconify 各集合（OpenMoji / Game-Icons / MDI）里搜索。
 *
 * 维护原则：
 * - 一个中文词 → 一组英文 token（按相关度排序）
 * - 优先选 Iconify 集合里**真实存在**的图标名词根
 * - 涵盖 references.ts 全集 + 小学常见物体
 */
export const ZH_ALIASES: Record<string, string[]> = {
  // ===== 动物 =====
  狗: ["dog"],
  小狗: ["dog", "puppy"],
  猫: ["cat"],
  小猫: ["cat", "kitten"],
  兔: ["rabbit"],
  兔子: ["rabbit"],
  马: ["horse"],
  牛: ["cow", "ox"],
  羊: ["sheep", "ram"],
  猪: ["pig"],
  鸡: ["chicken", "rooster"],
  鸭: ["duck"],
  鹅: ["goose"],
  鱼: ["fish"],
  鸟: ["bird"],
  鲨鱼: ["shark"],
  鲸: ["whale"],
  鲸鱼: ["whale"],
  大象: ["elephant"],
  长颈鹿: ["giraffe"],
  老虎: ["tiger"],
  狮子: ["lion"],
  熊: ["bear"],
  熊猫: ["panda"],
  猴: ["monkey"],
  猴子: ["monkey"],
  蛇: ["snake"],
  蚂蚁: ["ant"],
  蜜蜂: ["bee", "honeybee"],
  蝴蝶: ["butterfly"],
  乌龟: ["turtle"],
  鳄鱼: ["crocodile"],
  鹰: ["eagle"],
  企鹅: ["penguin"],
  袋鼠: ["kangaroo"],
  恐龙: ["dinosaur", "t-rex", "sauropod"],
  霸王龙: ["t-rex", "trex", "dinosaur"],

  // ===== 植物 =====
  树: ["tree", "deciduous-tree"],
  大树: ["tree", "deciduous-tree"],
  椰子树: ["palm-tree", "coconut"],
  棕榈树: ["palm-tree"],
  松树: ["evergreen-tree", "pine-tree"],
  竹子: ["bamboo"],
  花: ["flower", "blossom"],
  草: ["grass", "herb"],
  仙人掌: ["cactus"],

  // ===== 交通 =====
  车: ["car", "automobile"],
  汽车: ["automobile", "car"],
  小汽车: ["automobile", "car"],
  轿车: ["automobile", "car"],
  卡车: ["truck", "articulated-lorry"],
  货车: ["truck", "delivery-truck"],
  公交: ["bus"],
  公交车: ["bus"],
  巴士: ["bus"],
  校车: ["bus", "school-bus"],
  自行车: ["bicycle", "bike"],
  单车: ["bicycle"],
  摩托车: ["motorcycle", "motorbike"],
  电瓶车: ["motor-scooter"],
  火车: ["train", "locomotive"],
  高铁: ["bullet-train", "high-speed-train", "train"],
  动车: ["bullet-train", "train"],
  地铁: ["metro", "train"],
  飞机: ["airplane", "aeroplane"],
  船: ["ship", "boat", "ferry"],
  轮船: ["ship", "ferry"],
  帆船: ["sailboat"],

  // ===== 建筑 =====
  房子: ["house", "home"],
  楼: ["office-building", "building"],
  楼房: ["office-building", "building"],
  大楼: ["office-building", "building"],
  学校: ["school"],
  医院: ["hospital"],
  教堂: ["church"],
  塔: ["tower", "tokyo-tower"],
  铁塔: ["tokyo-tower", "tower"],
  桥: ["bridge", "bridge-at-night"],
  大桥: ["bridge", "bridge-at-night", "arch-bridge"],
  港珠澳大桥: ["bridge", "bridge-at-night"],
  办公楼: ["office-building"],
  城堡: ["castle"],
  长城: ["great-wall", "wall"],
  埃菲尔铁塔: ["eiffel-tower", "tower"],
  金字塔: ["pyramid"],

  // ===== 文具 =====
  铅笔: ["pencil"],
  钢笔: ["pen", "fountain-pen"],
  橡皮: ["eraser"],
  尺: ["ruler", "straight-ruler"],
  尺子: ["ruler", "straight-ruler"],
  直尺: ["straight-ruler", "ruler"],
  三角尺: ["triangular-ruler"],
  书: ["book"],
  课本: ["book", "open-book"],
  本子: ["notebook"],
  书包: ["backpack", "school-bag"],

  // ===== 食物 =====
  苹果: ["red-apple", "apple"],
  香蕉: ["banana"],
  橙子: ["orange", "tangerine"],
  橘子: ["tangerine", "orange"],
  葡萄: ["grapes"],
  西瓜: ["watermelon"],
  草莓: ["strawberry"],
  米饭: ["cooked-rice", "rice"],
  面包: ["bread"],
  鸡蛋: ["egg"],
  披萨: ["pizza"],
  汉堡: ["hamburger"],

  // ===== 人体 / 人物 =====
  人: ["person", "person-standing"],
  老师: ["teacher", "person-standing"],
  学生: ["student", "graduation-cap"],
  小朋友: ["child", "boy", "girl"],
  孩子: ["child", "boy", "girl"],
  大人: ["adult", "person-standing"],
  男孩: ["boy"],
  女孩: ["girl"],
  婴儿: ["baby"],

  // ===== 自然 =====
  山: ["mountain", "snow-capped-mountain"],
  海: ["ocean", "water-wave"],
  河: ["river", "water-wave"],
  太阳: ["sun", "sun-with-face"],
  月亮: ["moon", "crescent-moon"],
  星星: ["star"],
  云: ["cloud"],
  雨: ["rain", "cloud-with-rain"],
  雪: ["snow", "snowflake"],
  火: ["fire", "flame"],
  彩虹: ["rainbow"],

  // ===== 电子 / 工具 =====
  手机: ["mobile-phone", "phone"],
  电脑: ["laptop", "computer"],
  电视: ["television", "tv"],
  钟: ["clock"],
  灯: ["lamp", "light-bulb"],
  椅子: ["chair"],
  桌子: ["desk", "table"],
  床: ["bed"],

  // ===== 球类 / 运动 =====
  足球: ["soccer-ball", "soccer", "football"],
  足球场: ["stadium", "soccer-ball"],
  篮球: ["basketball"],
  篮球场: ["stadium", "basketball"],
  乒乓球: ["ping-pong"],
  跑道: ["running-track", "person-running"],
  操场: ["stadium", "running-track"],
  体育场: ["stadium"],
  运动场: ["stadium"],

  // ===== 杂项小物（references.ts 覆盖） =====
  芝麻: ["sesame"],
  硬币: ["coin"],
  一元硬币: ["coin"],
  钱币: ["coin"],
  大拇指: ["thumbs-up"],
  拇指: ["thumbs-up"],
  筷子: ["chopsticks"],
  一双筷子: ["chopsticks"],
  课桌: ["chair", "school-desk"],
  教学楼: ["school", "office-building"],
  教室: ["classroom", "school"],
  大悦城: ["shopping-mall", "office-building", "department-store"],
  商场: ["shopping-mall", "department-store"],
  购物中心: ["shopping-mall"],
  珠穆朗玛峰: ["snow-capped-mountain", "mountain", "mount-fuji"],
  珠峰: ["snow-capped-mountain", "mountain"],
  海南岛宽度: ["desert-island", "island"],
  哈利法塔: ["tokyo-tower", "tower"],
  迪拜塔: ["tokyo-tower", "tower"],

  // ===== 地标 / 大尺度 =====
  海岛: ["desert-island", "island"],
  岛: ["island", "desert-island"],
  地球: ["earth-globe", "globe"],
  月球: ["full-moon", "moon"],
};

/**
 * 把中文输入翻译成英文 token 数组。
 * - 找到完全匹配（"学校"）→ 直接返回
 * - 找不到 → 尝试拆字（"小狗" 可能命中 "狗"）
 * - 还找不到 → 返回原字符（让上游模型 fallback 处理）
 */
export function chineseToTokens(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 完全匹配
  if (ZH_ALIASES[trimmed]) return ZH_ALIASES[trimmed];

  // 子串匹配：找一个最长的命中
  let bestKey: string | null = null;
  for (const key of Object.keys(ZH_ALIASES)) {
    if (trimmed.includes(key)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  if (bestKey) return ZH_ALIASES[bestKey];

  // 没翻译——若是英文输入直接返回 token，中文则返回空
  if (/^[a-zA-Z\s-]+$/.test(trimmed)) {
    return trimmed.toLowerCase().split(/\s+/).flatMap((t) => t.split("-"));
  }
  return [];
}
