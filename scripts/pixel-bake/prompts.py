"""
中文 ref label → 英文 prompt 描述。

策略：
  1. 大部分参考物用通用 dict 直译（"蚂蚁" → "ant"）
  2. 中国/海南本地概念用描述性英文（"海口骑楼" → "Chinese arcade-style building, multi-story"）
  3. 抽象概念（"一节课"、"一觉睡到天亮"）用代表性场景（"clock showing 40 minutes"）
  4. 没在表里的 ref 直接用 label——SDXL 多少懂一点中文

每个 prompt 最后会被 bake.py 拼上风格后缀：
    ", 16x16 pixel art, retro 8-bit game sprite, transparent background,
     clean silhouette, centered, simple shapes, vibrant colors"
"""

# 仅放中英差异较大、或需要明确视觉描述的 ref。其他直接走 label。
PROMPT_OVERRIDES: dict[str, str] = {
    # 长度 - 极小
    # 极小物体在 FLUX 里容易"复合化"（用一堆 sesame 拼成一个大 sesame 形状）。
    # 解法：明确说"macro photograph of one grain"+"natural shape"，避免风格尾缀里
    # 的 "full object visible" 被解读成"主体要占满画面 → 要画大"。
    "sesame": (
        "one single tiny sesame seed grain, macro close-up, "
        "natural flat oval shape, pale beige color, "
        "smooth surface, lying on its side"
    ),
    "ant": "side view of an ant, 6 legs visible",
    "coin": "Chinese 1 yuan coin, gold-silver, side view",
    "thumb_width": "human thumb showing width measurement",
    "pencil": "wooden pencil with pink eraser, horizontal",
    "chopstick": "single bamboo chopstick, horizontal",
    "ruler_30cm": "wooden ruler, 30 cm marked, horizontal",
    "school_desk": "side view of a wooden school desk",
    "arm_span_child": "child standing with arms spread wide",
    "child_height": "front view of a small child standing",
    "adult_height": "front view of an adult standing",
    "bed": "side view of a single bed with pillow and blanket",
    # 长度 - 车 / 动物 / 树
    "car": "small red sedan car, strict flat 2D side profile, no perspective",
    "school_bus": "single yellow school bus centered on empty transparent canvas, flat 2D side profile, horizontal, full body, blue windows, black wheels",
    "coconut_tree": "tall coconut palm tree with green leaves and brown trunk",
    "blue_whale": "side view of a blue whale, full body",
    # 长度 - 建筑
    "basketball_court": "top-down view of a basketball court with hoop",
    "school_building": "front view of a multi-story school building",
    "soccer_field": "top-down view of a soccer field with green grass",
    "haikou_dayuecheng": "front view of a tall modern shopping mall skyscraper",
    "burj_khalifa": "side view of Burj Khalifa, very tall pointed skyscraper",
    "running_track": "top-down view of a red running track oval",
    # 长度 - 千米级（已删除桥）
    "mount_everest": "snowy mountain peak with clouds, triangular",
    "wuzhi_mountain": "five-peaked mountain range, green forest",
    "hainan_island_width": "tropical island shape, palm tree, water",
    # 新增竖向参考物
    "street_lamp": "one street lamp, strict flat front elevation, vertical pole, lamp head at top, no perspective, no ground",
    "flagpole": "one flagpole, strict flat front elevation, vertical pole, one small red flag near top, no perspective, no ground",
    "utility_pole": "wooden utility pole with electric wires",
    "haikou_arcade": "Chinese arcade-style 3-story building with arched front",
    "five_story_building": "front view of a 5-story residential building",
    "lighthouse": "white and red striped lighthouse on rocks",
    "tower_crane": "yellow construction tower crane with hook",
    # 面积
    "stamp": "small postage stamp, square shape",
    "business_card": "rectangular business card with text",
    "phone_screen": "smartphone with bright display screen, top-down",
    "math_book": "blue math textbook cover, top-down view",
    "a4_paper": "white A4 paper sheet, top-down",
    "newspaper": "open newspaper with text, top-down",
    "desk_top": "top-down view of wooden desk surface",
    "double_bed": "top-down view of a double bed with pillows",
    "pingpong_table": "top-down view of a green ping pong table with white lines",
    "parking_spot": "top-down view of a single parking space with white lines",
    "bedroom": "top-down floor plan of a small bedroom",
    "classroom_floor": "top-down floor plan of a classroom with desks",
    "basketball_half_court": "top-down view of half basketball court",
    "tennis_court": "top-down view of a green tennis court",
    "basketball_full_court": "top-down view of full basketball court with center circle",
    "track_inside_field": "top-down view of running track around grass field",
    "soccer_field_area": "top-down view of full soccer field, grass with markings",
    "birds_nest": "top-down view of Beijing National Stadium, oval",
    "tiananmen_square": "top-down view of huge plaza with red building",
    "forbidden_city": "top-down view of Forbidden City roof complex",
    "central_park": "top-down view of green park with trees and lake",
    "haikou_meilan_airport": "top-down view of an airport with runways",
    # 容积 (mL/L)
    "water_drop": "single blue water droplet",
    "tea_spoon": "small silver tea spoon",
    "table_spoon": "metal soup spoon",
    "yogurt_cup": "small white yogurt cup",
    "tea_cup": "ceramic tea cup with handle",
    "soda_can": "red aluminum soda can",
    "water_bottle": "clear plastic water bottle with label",
    "milk_carton": "white milk carton with handle",
    "kettle": "stainless steel electric kettle",
    "rice_cooker": "white rice cooker with display",
    "household_bucket": "blue plastic household bucket with handle",
    "fish_tank": "rectangular glass fish tank with water and fish",
    "bathtub": "white porcelain bathtub, side view",
    "kids_pool": "round inflatable kids pool, blue",
    "water_truck": "side view of a green water tank truck",
    # 体积 (cubic m³)
    "rice_grain": "single white rice grain",
    "dice": "small white cube dice with black dots",
    "ping_pong_ball": "white ping pong ball",
    "tennis_ball": "yellow-green tennis ball",
    "rubiks_cube": "colorful 3x3 Rubik's cube",
    "shoe_box": "rectangular cardboard shoe box, brown",
    "basketball": "orange basketball with black lines",
    "school_backpack_volume": "blue child backpack",
    "microwave": "white microwave oven",
    "washing_machine": "front-loading white washing machine",
    "household_fridge": "tall white refrigerator",
    "small_car_volume": "side view of a small sedan",
    "shipping_container": "rust-red metal shipping container, side view",
    "classroom_volume": "front view of an empty classroom",
    "school_pool_volume": "rectangular outdoor swimming pool",
    "ten_floor_volume": "tall 10-story residential building",
    # 重量
    "feather": "single white feather floating",
    "paperclip": "small silver paperclip",
    "egg": "single brown egg",
    "apple": "shiny red apple with leaf",
    "textbook": "stack of math textbooks",
    "school_backpack_weight": "blue child backpack with straps",
    "house_cat": "side view of a sitting tabby cat",
    "watermelon": "whole green watermelon with stripes",
    "big_dog": "side view of a large brown dog",
    "elementary_student": "small child wearing school uniform",
    "adult_person": "front view of an adult person",
    "panda": "cute giant panda sitting",
    "dolphin": "side view of a gray dolphin jumping",
    "small_car_weight": "side view of a small red sedan car",
    "asian_elephant": "side view of a large gray elephant with trunk",
    "blue_whale_weight": "side view of a huge blue whale",
    # 时间 - 用代表性物或场景
    "blink": "human eye closing, eyelash visible",
    "snap": "fingers snapping with sound waves",
    "heartbeat": "red anatomical heart icon",
    "deep_breath": "blue lungs with air flowing",
    "brush_teeth": "toothbrush with toothpaste foam",
    "boil_egg": "egg in boiling water with steam",
    "class_break": "school clock showing 10 minute break",
    "school_lesson": "wall clock showing 40 minutes",
    "animation_movie": "movie clapboard with film reel",
    "morning_classes": "bright sun rising over school",
    "full_night_sleep": "moon and stars over a sleeping bed",
    "one_day": "sun in middle of sky, day cycle",
    "one_week": "calendar showing 7 days",
    "winter_vacation": "snowman wearing scarf, snow falling",
    "summer_vacation": "beach umbrella with sun and sand",
    "school_year": "open calendar with September circled",
    "one_year": "Earth orbiting around sun, full circle",
}


def get_prompt_for(ref: dict) -> str:
    """根据 ref 字典生成 prompt 主体。优先级：
    1. ref["prompt"] —— catalog 内联（visual-assets.json）
    2. PROMPT_OVERRIDES[id] —— 内置中英差异较大的覆盖表
    3. label 兜底
    """
    inline = ref.get("prompt")
    if inline:
        return inline
    rid = ref.get("id", "")
    label = ref.get("label", "")
    if rid in PROMPT_OVERRIDES:
        return PROMPT_OVERRIDES[rid]
    return label


# 全局风格后缀——所有 ref 共用，保证视觉一致
STYLE_SUFFIX = (
    "isolated pixel art cutout, transparent background, one complete physical object, "
    "orthographic view, real aspect ratio, centered, crisp pixels"
)

NEGATIVE_PROMPT = (
    "background, ground, road, street, scenery, perspective, angled, isometric, "
    "icon, logo, frame, blur, antialias, gradient, photorealistic, text, watermark, cropped"
)

# FLUX 用自然语言长 prompt 控风格，不再走 SDXL 的 tag 堆叠 / negative prompt。
# 这套尾缀是为儿童量感字典调的——目标：让"椰子、铅笔、硬币、蚂蚁"等具体物体
# 呈现"教科书贴纸"质感，跟字典 UI 设计稿一致：
#   - **浅灰底**：方便前端 chroma-key 去背景做透明 PNG。
#     早期版本用纯白底，但白色物体（牛奶盒、冰箱、纸张、瓷器、白卡车货柜）
#     会和背景融合，模型直接画出几乎空白的图。改成 #e8e8e8 浅灰后：
#     * 白色主体有清晰的对比可以正常画出
#     * 边缘 chroma-key 仍能识别（edge-connected 浅色 → 透明）
#     * 物体内部如有白色部分，因不与边缘连通，保留下来
#   - **不要任何地面/影子/桌面**：之前用 "gentle drop shadow underneath"，FLUX
#     经常会脑补出一块木桌/地板/书页当落影面，违反"无装饰"原则。改成显式禁止。
#   - **绝对孤立**：除主体外画面里什么都不能有，否则 chroma-key 后会留下杂色像素
#   - 写实但不照片化，色彩饱和度略高，对儿童视觉友好
#   - 单一主体居中、原比例
#
# 注意：之前曾用 "full object visible"，对小物体（芝麻/蚂蚁等）会被理解成"主体
# 占满画面"，于是 FLUX 用同类物复合填充。移除后由 body prompt 自己决定 framing。
STYLE_SUFFIX_ILLUSTRATION = (
    # 主语：sticker/decal 比 "illustration" 更强烈地暗示孤立+扁平
    "clean editorial children's textbook sticker illustration of a single subject, "
    # 背景：浅灰平涂。带颜色码让 FLUX 更"听话"，且故意避开 white——
    # 白色物体（牛奶盒、冰箱、纸张）和白底会糊在一起出空图。
    "the background is a flat solid light gray #e8e8e8, completely empty plain background, "
    # 显式列出不要的元素：表面 / 影子 / 道具 / 装饰
    "no ground, no floor, no table, no surface beneath the subject, "
    "no cast shadow, no drop shadow, no shadow on the floor, "
    "no props, no decorative elements, no second object, "
    "no text, no labels, no watermark, no signature, no border, no frame, "
    "no people, no hands holding it, "
    # 渲染：扁平柔和阴影（在物体本体上）；强调 isolated
    "the subject is fully isolated, floating alone in empty space, "
    "soft cel-shading on the subject itself, no rim light, "
    "accurate real-world proportions and natural colors, "
    "vibrant but child-friendly palette, "
    "centered composition, single subject only"
)
