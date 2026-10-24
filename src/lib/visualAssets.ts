import { ALL_REFERENCES, type ReferenceObject } from "@/lib/references";

export type VisualAxis = "horizontal" | "vertical" | "either" | "square";

export interface VisualAsset {
  id: string;
  label: string;
  aliases: string[];
  category: string;
  axis: VisualAxis;
  iconId: string;
}

export interface ResolvedVisual {
  assetId: string;
  label: string;
  iconId: string;
  source: "asset" | "reference" | "generated";
}

const VISUAL_ALIAS_ASSETS: VisualAsset[] = [
  {
    id: "vehicle_truck",
    label: "卡车",
    aliases: ["卡车", "货车", "水罐车", "洒水车", "运输车", "载重汽车"],
    category: "vehicle",
    axis: "horizontal",
    iconId: "pixel-png:water_tanker_truck",
  },
  {
    id: "vehicle_car",
    label: "小汽车",
    aliases: ["小汽车", "汽车", "轿车", "车子", "出租车"],
    category: "vehicle",
    axis: "horizontal",
    iconId: "pixel-png:car",
  },
  {
    id: "vehicle_bus",
    label: "校车",
    aliases: ["校车", "公交车", "公交", "巴士", "大巴"],
    category: "vehicle",
    axis: "horizontal",
    iconId: "pixel-png:school_bus",
  },
  {
    id: "building_highrise",
    label: "高楼",
    aliases: ["高楼", "大楼", "写字楼", "摩天楼", "商场", "酒店", "住宅楼"],
    category: "building",
    axis: "vertical",
    iconId: "pixel-png:haikou_dayuecheng",
  },
  {
    id: "building_school",
    label: "学校建筑",
    aliases: ["学校", "教学楼", "教室", "教室楼", "校园"],
    category: "building",
    axis: "vertical",
    iconId: "pixel-png:school_building",
  },
  {
    id: "bridge",
    label: "桥",
    aliases: ["桥", "大桥", "跨海大桥", "桥梁"],
    category: "building",
    axis: "horizontal",
    iconId: "pixel-png:haikou_bay_bridge",
  },
  {
    id: "tree_palm",
    label: "椰子树",
    aliases: ["椰子树", "椰树", "棕榈树"],
    category: "nature",
    axis: "vertical",
    iconId: "pixel-png:coconut_tree",
  },
  {
    id: "animal_ant",
    label: "蚂蚁",
    aliases: ["蚂蚁"],
    category: "animal",
    axis: "horizontal",
    iconId: "pixel-png:ant",
  },
  {
    id: "animal_whale",
    label: "鲸鱼",
    aliases: ["鲸鱼", "蓝鲸"],
    category: "animal",
    axis: "horizontal",
    iconId: "pixel-png:blue_whale",
  },
  {
    id: "stationery_pencil",
    label: "铅笔",
    aliases: ["铅笔", "笔"],
    category: "stationery",
    axis: "horizontal",
    iconId: "pixel-png:pencil",
  },
  {
    id: "container_bottle",
    label: "瓶子",
    aliases: ["瓶子", "水瓶", "矿泉水瓶", "矿泉水"],
    category: "container",
    axis: "vertical",
    iconId: "pixel-png:mineral_water_bottle",
  },
  {
    id: "furniture_bed",
    label: "床",
    aliases: ["床", "双人床"],
    category: "furniture",
    axis: "horizontal",
    iconId: "pixel-png:bed",
  },
  {
    id: "sports_court",
    label: "球场",
    aliases: ["球场", "篮球场", "足球场", "操场", "体育场"],
    category: "sports",
    axis: "horizontal",
    iconId: "pixel-png:basketball_court",
  },
];

const REF_VISUAL_OVERRIDES: Record<string, string> = {
  school_desk_top: "school_desk",
  double_bed: "bed",
  classroom_floor: "school_building",
  classroom_volume: "school_building",
  ten_floor_building_volume: "haikou_dayuecheng",
  small_car_volume: "car",
  small_car_weight: "car",
  mineral_bottle_full: "mineral_water_bottle",
  apple_weight: "apple_weight",
  cat_weight: "cat_weight",
  blue_whale_weight: "blue_whale",
  water_tanker_truck: "water_tanker_truck",
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s·・,，。\.]/g, "");
}

function iconIdForReference(ref: ReferenceObject): string {
  return `pixel-png:${REF_VISUAL_OVERRIDES[ref.id] ?? ref.id}`;
}

export function resolveVisualForReference(ref: ReferenceObject): ResolvedVisual {
  return {
    assetId: REF_VISUAL_OVERRIDES[ref.id] ?? ref.id,
    label: ref.label,
    iconId: iconIdForReference(ref),
    source: "reference",
  };
}

export function resolveVisualForTarget(label: string): ResolvedVisual {
  const normalized = normalizeText(label);
  const asset = VISUAL_ALIAS_ASSETS.find((candidate) =>
    candidate.aliases.some((alias) => {
      const a = normalizeText(alias);
      return normalized === a || normalized.includes(a) || a.includes(normalized);
    }),
  );
  if (asset) {
    return {
      assetId: asset.id,
      label: asset.label,
      iconId: asset.iconId,
      source: "asset",
    };
  }

  const ref = ALL_REFERENCES.find((candidate) => {
    const refLabel = normalizeText(candidate.label);
    return normalized === refLabel || normalized.includes(refLabel) || refLabel.includes(normalized);
  });
  if (ref) return resolveVisualForReference(ref);

  return {
    assetId: `generated:${encodeURIComponent(label.trim())}`,
    label,
    iconId: label.trim() ? `pixel-ai:${encodeURIComponent(label.trim())}` : "fluent-emoji:triangular-ruler",
    source: "generated",
  };
}
