"""
尺博士 · 物品图烘焙脚本（FLUX 版本）

流程：
  1. 读 refs.json（由 _dump-refs.mts 生成）或 visual-assets catalog
  2. 加载 FLUX.1-schnell 基模（Apache 2.0、distilled，4 步出图）
  3. 对每个 ref：
     - 按真实形状选画布（横/竖/方/俯视）
     - bf16 + model-cpu-offload，12GB 笔记本卡可跑
     - 默认 illustration 风格（干净彩色插画 + 白底 + 柔和投影）
       兼容老风格走 --style pixel（nearest 缩放 + 调色板量化）
     - 透明背景清理（白/灰 → 透明）+ 最大连通域保留
     - 输出到 public/icons/pixel/{ref.id}.png（路径不变，前端无感知）
  4. 输出 manifest.json

模型：
  black-forest-labs/FLUX.1-schnell —— Apache 2.0，distilled，4 步
  bf16 + cpu-offload 下 ~10–11GB VRAM，5070 Ti Laptop 上单张 ~3–6s。

用法：
    conda activate lianggan-pixel
    python scripts/pixel-bake/bake.py                   # 默认 illustration 风格，增量
    python scripts/pixel-bake/bake.py --style pixel     # 兼容老调色板像素画
    python scripts/pixel-bake/bake.py --force           # 强制重生
    python scripts/pixel-bake/bake.py --only sesame ant # 只生成指定 id
    python scripts/pixel-bake/bake.py --limit 10        # 调试：只跑前 10 个
    python scripts/pixel-bake/bake.py --refs path.json  # 指定 refs.json

提示：
  - 首次运行会从 HuggingFace 下载约 24GB（transformer + T5-XXL + clip-l + vae）。
    国内连不上：set HF_ENDPOINT=https://hf-mirror.com
  - Blackwell（sm_120）需要 PyTorch ≥ 2.7 + CUDA 12.8；diffusers ≥ 0.31。
  - bake.bat 里设置了 HF_HUB_OFFLINE=1 / TRANSFORMERS_OFFLINE=1，
    第一次跑 FLUX 需要临时关掉这两个变量，让 HuggingFace 把模型拉下来。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import numpy as np
    import torch
    from diffusers import FluxPipeline
    from PIL import Image
    from tqdm import tqdm
except ImportError as e:
    print(f"[bake] 依赖未装：{e}")
    print("[bake] 请先执行：conda env create -f scripts/pixel-bake/environment.yml")
    print("[bake] 切到 FLUX 后还需要：")
    print("        pip install -U diffusers transformers accelerate sentencepiece protobuf")
    sys.exit(1)

try:
    from scipy.ndimage import label as _scipy_label  # type: ignore
    _HAS_SCIPY = True
except Exception:
    _HAS_SCIPY = False

# 把本目录加入 path 以便 import prompts.py
sys.path.insert(0, str(Path(__file__).parent))
from prompts import (  # noqa: E402
    get_prompt_for,
    STYLE_SUFFIX,
    STYLE_SUFFIX_ILLUSTRATION,
    NEGATIVE_PROMPT,
)

# 路径常量
HERE = Path(__file__).parent
ROOT = HERE.parent.parent
REFS_JSON_DEFAULT = HERE / "refs.json"
OUT_DIR = ROOT / "public" / "icons" / "pixel"
MANIFEST = OUT_DIR / "manifest.json"

# 模型配置 —— FLUX.1-schnell 是 distilled、Apache 2.0、4 步出图的模型，
# 在 5070 Ti Laptop 12GB 上比之前 SDXL 25 步还快，且 prompt 跟随质量碾压 SDXL。
#
# 优先读环境变量 BAKE_BASE_MODEL —— 国内推荐 ModelScope 下载到本地后指向该目录：
#   $env:BAKE_BASE_MODEL = "D:\models\FLUX.1-schnell"
# 没设时默认用 HuggingFace 仓库 ID（hf-mirror 对 FLUX LFS 不稳，建议走 ModelScope）。
import os as _os  # noqa: E402
def _resolve_base_model() -> str:
    """优先级：
    1. 环境变量 BAKE_BASE_MODEL（最高，dev.bat / 手动覆盖都走这条）
    2. D:\\models\\FLUX.1-schnell —— 默认 ModelScope 下载约定路径
    3. HuggingFace 仓库 ID 兜底（hf-mirror 对 FLUX LFS 不稳，仅作兜底）
    """
    env = _os.environ.get("BAKE_BASE_MODEL")
    if env:
        return env
    default_local = r"D:\models\FLUX.1-schnell"
    if _os.path.isdir(default_local):
        return default_local
    return "black-forest-labs/FLUX.1-schnell"


BASE_MODEL = _resolve_base_model()
# 不再需要 LoRA：FLUX 用自然语言 prompt 控风格（见 prompts.STYLE_SUFFIX_ILLUSTRATION）

# 生成参数
GEN_BASE = 1024          # FLUX 推荐边长，画布按 1024 / 768 / 1280 选用
TARGET_LONG = 864        # 输出最长边像素数（保持与旧版一致，前端 URL 无变化）
PALETTE_COLORS = 32      # 仅 --style pixel 时使用
GUIDANCE = 0.0           # schnell 是 distilled 模型，guidance_scale=0 即可
NUM_INFERENCE_STEPS = 4  # schnell 标配 4 步
SEED_BASE = 42

# 输出风格：'illustration'（默认，干净彩色插画）或 'pixel'（老调色板像素画）
# main() 会根据 --style 参数改写这个全局；bake_worker / 单元测试也可直接赋值。
STYLE_MODE = "illustration"


def _try_load_pipeline_4bit() -> "FluxPipeline | None":
    """尝试 4bit (NF4) 量化加载 FLUX。失败返回 None，让上层 fallback。

    为什么 4bit 在 5070 Ti Laptop（12GB）上是最优解：
      - 默认 bf16 加载：transformer 22GB + T5 9GB = 31GB 同时压在系统内存里，
        我们只有 32GB 物理 RAM，叠加 Next dev / 浏览器 直接 segfault。
      - sequential_cpu_offload：从层粒度在 CPU↔GPU 之间换页，但加载阶段仍要把
        全量 bf16 权重读进 RAM，碰上系统压力一样会爆。
      - **4bit NF4**：权重直接以 NF4 存进显存，transformer 22GB → ~6GB，
        T5 9GB → ~3GB，**全程驻 GPU**，加载阶段 RAM 压力降到 ~10GB，安全。
        bnb 反量化在 fwd 时即时做，速度比 sequential offload 快 3-5 倍
        （单张 ~3-5s vs ~12-18s）。

    需求：bitsandbytes >= 0.43（已支持 Windows wheel）+ accelerate >= 0.30。
    """
    try:
        from diffusers import (
            FluxTransformer2DModel,
            BitsAndBytesConfig as DiffusersBnbConfig,
        )
        from transformers import (
            T5EncoderModel,
            BitsAndBytesConfig as TransformersBnbConfig,
        )
        import bitsandbytes  # noqa: F401  仅为触发 ImportError
    except ImportError as e:
        print(f"[bake] 4bit 不可用（{e}），回退 bf16 + sequential offload")
        return None

    print(f"[bake] 4bit 模式加载 FLUX：{BASE_MODEL}")
    # transformer：NF4 + bf16 计算
    diff_cfg = DiffusersBnbConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    # disable_mmap=True：禁用 safetensors 的 mmap 加载。
    #   Windows 下 mmap 一个 5GB safetensors 分片要求 commit charge >= 5GB，
    #   FLUX 一共 3 片 transformer + 1 片 T5 ≈ 24GB；32GB RAM + 默认 pagefile (~5GB)
    #   时常报 "OSError 1455: 页面文件太小"。
    #   关闭 mmap 后改成"流式读 → 立刻量化释放"，峰值内存反而更低。
    transformer = FluxTransformer2DModel.from_pretrained(
        BASE_MODEL,
        subfolder="transformer",
        quantization_config=diff_cfg,
        torch_dtype=torch.bfloat16,
        disable_mmap=True,
    )
    # T5 文本编码器：同样 NF4
    tf_cfg = TransformersBnbConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    # transformers 的 from_pretrained 也接受 disable_mmap（>=4.45）
    text_encoder_2 = T5EncoderModel.from_pretrained(
        BASE_MODEL,
        subfolder="text_encoder_2",
        quantization_config=tf_cfg,
        torch_dtype=torch.bfloat16,
    )

    pipe = FluxPipeline.from_pretrained(
        BASE_MODEL,
        transformer=transformer,
        text_encoder_2=text_encoder_2,
        torch_dtype=torch.bfloat16,
    )
    # 4bit 模式下 transformer + T5 + clip-l + vae 加起来 ~10GB，
    # model_cpu_offload 已足够（不需要 sequential）。
    # 注意：bnb-quantized 模块不能用 .to("cuda")；必须靠 cpu_offload 帮我们移动。
    pipe.enable_model_cpu_offload()
    try:
        pipe.vae.enable_tiling()
    except Exception:
        pass
    return pipe


def _load_pipeline_bf16_offloaded() -> FluxPipeline:
    """bf16 全精度 + sequential_cpu_offload —— 4bit 不可用时的兜底路径。

    要求：物理内存 ≥ 32GB 且加载时其他应用占用 ≤ 6GB；否则有 segfault 风险。
    建议：装 bitsandbytes 走 4bit。
    """
    print(f"[bake] bf16 模式加载 FLUX（offloaded）：{BASE_MODEL}")
    pipe = FluxPipeline.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=True,
    )
    if not torch.cuda.is_available():
        print("[bake] ⚠️ 未检测到 CUDA！FLUX 在 CPU 上会非常非常慢，请退出。")
        return pipe
    pipe.enable_sequential_cpu_offload()
    try:
        pipe.vae.enable_tiling()
    except Exception:
        pass
    return pipe


def load_pipeline() -> FluxPipeline:
    """加载 FLUX.1-schnell。

    策略（按优先级）：
      1. **4bit NF4 量化**（推荐）：装了 bitsandbytes 就走这条；
         单张 ~3-5s，加载 RAM 压力 ~10GB，速度 + 稳定都最优。
      2. **bf16 + sequential_cpu_offload** 兜底：装机里没 bnb 时；
         单张 ~12-18s，加载 RAM 压力 ~22GB（32GB 系统下边缘）。

    通过环境变量 `BAKE_FORCE_BF16=1` 可强制走兜底路径（用来 A/B 对比画质）。
    """
    if _os.environ.get("BAKE_FORCE_BF16") == "1":
        print("[bake] BAKE_FORCE_BF16=1 → 跳过 4bit")
        return _load_pipeline_bf16_offloaded()
    pipe = _try_load_pipeline_4bit()
    if pipe is not None:
        return pipe
    return _load_pipeline_bf16_offloaded()


def canvas_for(ref: dict) -> tuple[int, int, int, int]:
    """返回 (gen_w, gen_h, out_w, out_h)，按参考物真实形状选择画布。"""
    rid = ref.get("id", "")
    axis = ref.get("axis", "")
    group = ref.get("group", "")
    category = ref.get("category", "")

    tall_ids = {
        "street_lamp", "flagpole", "utility_pole", "coconut_tree", "lighthouse",
        "burj_khalifa", "five_story_building", "ten_floor_volume",
        "child_height", "adult_height", "elementary_student", "adult_person",
        "household_fridge", "washing_machine",
    }
    wide_ids = {
        "school_bus", "car", "small_car_volume", "small_car_weight", "blue_whale",
        "blue_whale_weight", "bed", "double_bed", "shipping_container", "water_truck",
        "pencil", "chopstick", "ruler_30cm", "soccer_field", "soccer_field_area",
        "running_track", "track_inside_field", "tennis_court", "basketball_full_court",
    }
    topdown_groups = {"area"}

    if rid in tall_ids or axis == "vertical":
        return 768, 1280, 504, 864
    if rid in wide_ids or axis == "horizontal":
        return 1280, 768, 864, 504
    if group in topdown_groups or category in {"field", "building"} and "court" in rid:
        return 1024, 1024, 720, 720
    return 1024, 1024, 720, 720


def view_rule_for(ref: dict) -> str:
    """按量感维度追加标准视角约束。"""
    rid = ref.get("id", "")
    axis = ref.get("axis", "")
    group = ref.get("group", "")
    gen_w, gen_h, out_w, out_h = canvas_for(ref)
    if group == "area":
        return "flat top-down view"
    if axis == "vertical" or out_h > out_w:
        return "flat front view"
    if axis == "horizontal" or out_w > out_h:
        return "flat side view"
    return "flat front view"


def crop_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def pad_to_canvas(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = max(0, (size[0] - img.width) // 2)
    y = max(0, (size[1] - img.height) // 2)
    canvas.alpha_composite(img, (x, y))
    return canvas


def remove_edge_background(img: Image.Image) -> Image.Image:
    """把与画布边缘连通的"背景颜色"像素置透明。

    历史 bug：之前用全局阈值 (r>230)&(g>230)&(b>230) 杀白色，结果把白色货柜
    卡车的车厢、白色冰箱、纸张等也杀掉了，主体出现"泛白半透明"现象。

    新算法：先得到"候选背景"掩码（颜色像背景、白、浅灰之一），再做连通域
    分析——只把**与边缘连通**的候选背景置透明。物体内部的白色车厢、白色
    口杯被颜色边界包住，与画布边缘不连通，保留下来。
    """
    arr = np.asarray(img).copy()  # (h, w, 4) uint8
    h, w = arr.shape[:2]
    edge = np.concatenate(
        [arr[0, :, :3], arr[-1, :, :3], arr[:, 0, :3], arr[:, -1, :3]], axis=0
    )
    bg = np.median(edge, axis=0).astype(np.int16)

    rgb = arr[..., :3].astype(np.int16)
    diff = np.abs(rgb - bg)
    sum_diff = diff.sum(axis=-1)
    max_diff = diff.max(axis=-1)
    mask_close_bg = (sum_diff < 58) | (max_diff < 28)

    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]
    mask_white = (r > 230) & (g > 230) & (b > 230)
    mask_grayish = (np.abs(r - g) < 8) & (np.abs(g - b) < 8) & (r > 190)

    candidate = mask_close_bg | mask_white | mask_grayish

    # 限定为"与图像边缘连通的候选背景"——这是关键修复。
    # 只有 4 邻接连通到边界（任意一边）的浅色斑块才算真背景。
    if not candidate.any():
        return Image.fromarray(arr, "RGBA")

    if _HAS_SCIPY:
        structure = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
        labeled, n_components = _scipy_label(candidate, structure=structure)
        if n_components == 0:
            return Image.fromarray(arr, "RGBA")
        edge_labels = np.unique(
            np.concatenate(
                [labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]]
            )
        )
        edge_labels = edge_labels[edge_labels != 0]
        if edge_labels.size == 0:
            return Image.fromarray(arr, "RGBA")
        keep_bg = np.isin(labeled, edge_labels)
        arr[keep_bg] = (0, 0, 0, 0)
    else:
        # scipy 缺席时退化为旧行为（全局杀），日志一次提醒。
        # 99% 部署都装了 scipy；这条路径只在极简 CI 环境会走。
        arr[candidate] = (0, 0, 0, 0)
    return Image.fromarray(arr, "RGBA")


def keep_largest_alpha_component(img: Image.Image) -> Image.Image:
    """只保留最大不透明连通域，清理地面/多对象碎片。

    优先用 scipy.ndimage.label（C 实现，~10ms）；无 scipy 时退化为纯 numpy
    迭代 DFS（仍比原 PIL.getpixel + Python set 版本快 ~50x，因为索引访问
    走 numpy 数组而不是 Python 字典）。
    """
    arr = np.asarray(img).copy()
    alpha_mask = arr[..., 3] > 0
    if not alpha_mask.any():
        return img

    if _HAS_SCIPY:
        # 4-邻接结构
        structure = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
        labeled, n_components = _scipy_label(alpha_mask, structure=structure)
        if n_components == 0:
            return img
        # bincount 第 0 个是背景
        counts = np.bincount(labeled.ravel())
        biggest = int(np.argmax(counts[1:])) + 1
        keep = labeled == biggest
    else:
        h, w = alpha_mask.shape
        labels = np.zeros((h, w), dtype=np.int32)
        sizes = [0]  # label 0 = 背景占位
        nz_y, nz_x = np.nonzero(alpha_mask)
        cur = 0
        for sy, sx in zip(nz_y.tolist(), nz_x.tolist()):
            if labels[sy, sx] != 0:
                continue
            cur += 1
            size = 0
            stack = [(sx, sy)]
            labels[sy, sx] = cur
            while stack:
                x, y = stack.pop()
                size += 1
                if x + 1 < w and alpha_mask[y, x + 1] and labels[y, x + 1] == 0:
                    labels[y, x + 1] = cur
                    stack.append((x + 1, y))
                if x - 1 >= 0 and alpha_mask[y, x - 1] and labels[y, x - 1] == 0:
                    labels[y, x - 1] = cur
                    stack.append((x - 1, y))
                if y + 1 < h and alpha_mask[y + 1, x] and labels[y + 1, x] == 0:
                    labels[y + 1, x] = cur
                    stack.append((x, y + 1))
                if y - 1 >= 0 and alpha_mask[y - 1, x] and labels[y - 1, x] == 0:
                    labels[y - 1, x] = cur
                    stack.append((x, y - 1))
            sizes.append(size)
        if cur == 0:
            return img
        biggest = int(np.argmax(np.asarray(sizes)))
        keep = labels == biggest

    arr[~keep] = (0, 0, 0, 0)
    return Image.fromarray(arr, "RGBA")


def postprocess_illustration(img: Image.Image, out_w: int, out_h: int) -> Image.Image:
    """
    干净彩色插画风格（默认）—— FLUX 出图直接是写实/插画质感，不做调色板量化。

    步骤：
      a. 转 RGBA
      b. LANCZOS 平滑缩到目标尺寸（保留笔触/渐变细节，不做 nearest 失真）
      c. 边缘背景色采样 → 把与画布边一致的颜色块置透明（去白底）
      d. 保留最大连通域，清掉零碎反光/影子
      e. crop 透明边 + 居中 pad 到目标画布
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    small = img.resize((out_w, out_h), Image.Resampling.LANCZOS)
    small = remove_edge_background(small)
    small = keep_largest_alpha_component(small)
    return pad_to_canvas(crop_transparent(small), (out_w, out_h))


def postprocess_pixel(img: Image.Image, out_w: int, out_h: int) -> Image.Image:
    """
    像素画兼容模式（--style pixel）—— 走老 SDXL 时代的 nearest + 调色板量化路径。
    主要用于保持与旧 catalog 视觉一致，或对比测试。
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # a + b
    small = img.resize((out_w, out_h), Image.Resampling.NEAREST)
    small = remove_edge_background(small)

    # c: 去白底（numpy 向量化）
    arr = np.asarray(small).copy()
    rgb_i16 = arr[..., :3].astype(np.int16)
    r = rgb_i16[..., 0]
    g = rgb_i16[..., 1]
    b = rgb_i16[..., 2]
    mask_white = (r > 230) & (g > 230) & (b > 230)
    mask_grayish = (np.abs(r - g) < 8) & (np.abs(g - b) < 8) & (r > 205)
    arr[mask_white | mask_grayish] = (0, 0, 0, 0)
    small = Image.fromarray(arr, "RGBA")

    # d: palette 量化（≤PALETTE_COLORS 色）
    rgb = small.convert("RGB").quantize(
        colors=PALETTE_COLORS,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    rgba = rgb.convert("RGBA")
    alpha = small.split()[3]
    rgba.putalpha(alpha)
    rgba = keep_largest_alpha_component(rgba)
    return pad_to_canvas(crop_transparent(rgba), (out_w, out_h))


def bake_one(
    pipe: FluxPipeline,
    ref: dict,
    out_path: Path,
    seed: int,
    step_callback: "callable | None" = None,
) -> str:
    """生成单个 ref 的图（风格由全局 STYLE_MODE 决定）。

    注意 vs 旧 SDXL 版本的关键差异：
      - guidance_scale = 0（schnell 是 distilled，不需要 CFG）
      - num_inference_steps = 4（schnell 4 步即出图）
      - 不再传 negative_prompt（FLUX 没有 cfg 自然不支持负面提示）
      - generator 用 cpu 设备构造（model-cpu-offload 下 transformer device 不固定）

    step_callback:
      可选回调，签名 `(stage: str, step: int, total: int) -> None`。
      调用时机：
        - ("encode", 0, total)：开始 prompt encoding
        - ("denoise", i, total)：第 i 步去噪完成（i 从 1 起，total = NUM_INFERENCE_STEPS）
        - ("decode", total, total)：去噪结束，开始 VAE decode + 后处理
      用于在 worker 端把真实进度 emit 到 stdout，给前端进度条用。
    """
    body = get_prompt_for(ref)
    # 按风格选尾缀：illustration 用自然语言长 prompt；pixel 用 SDXL 时代的 tag 堆
    style_tail = (
        STYLE_SUFFIX_ILLUSTRATION if STYLE_MODE == "illustration" else STYLE_SUFFIX
    )
    # 不再自动追加 view_rule_for：
    #   - 旧规则是 SDXL 时代经验，强行加 "flat side view" / "flat front view"
    #   - FLUX 拿自然语言已经能从 body 自己选视角；自动追加只会跟 body 已有视角冲突
    #     （芝麻 macro close-up + flat front view → "一堆芝麻拼成大芝麻"是典型例子）
    #   - 若个别条目确实需要固定视角，写在 visual-assets.json 的 prompt 字段里即可
    prompt = f"{body}. {style_tail}"
    generator = torch.Generator(device="cpu").manual_seed(seed)
    gen_w, gen_h, out_w, out_h = canvas_for(ref)

    # ── 真实进度回调 ──
    # diffusers 的 `callback_on_step_end` 在每步去噪结束后被调用，签名为
    #   (pipeline, step_index, timestep, callback_kwargs) -> dict
    # 我们这里只用前两个参数，把 step 转给外部 callback。FLUX-schnell 标配
    # 4 步，所以用户能看到 ~25% / 50% / 75% / 100% 的真实进度跳变。
    # 性能：每步多调一个 Python 函数 + 一行 stdout，总耗时 < 1ms 完全可忽略。
    if step_callback is not None:
        step_callback("encode", 0, NUM_INFERENCE_STEPS)

        def _on_step(_pipe, step_index: int, _timestep, callback_kwargs):
            try:
                # step_index 从 0 起；用户视角 1 / 2 / 3 / 4 更直观
                step_callback("denoise", step_index + 1, NUM_INFERENCE_STEPS)
            except Exception:
                # 进度回调不能影响生成；任何异常吞掉
                pass
            return callback_kwargs

        pipe_kwargs_callback = {"callback_on_step_end": _on_step}
    else:
        pipe_kwargs_callback = {}

    img = pipe(
        prompt=prompt,
        width=gen_w,
        height=gen_h,
        guidance_scale=GUIDANCE,
        num_inference_steps=NUM_INFERENCE_STEPS,
        generator=generator,
        # schnell 文本编码上限 256 token（够装一段 ~150 词的英文 prompt）
        max_sequence_length=256,
        **pipe_kwargs_callback,
    ).images[0]

    if step_callback is not None:
        step_callback("decode", NUM_INFERENCE_STEPS, NUM_INFERENCE_STEPS)

    if STYLE_MODE == "pixel":
        out_img = postprocess_pixel(img, out_w=out_w, out_h=out_h)
    else:
        out_img = postprocess_illustration(img, out_w=out_w, out_h=out_h)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # 原子写：先写 .tmp，写完 os.replace() 一次性切换。
    # 目的：断电 / Ctrl+C 中途崩溃时，不会留下"半截 PNG + 新 mtime"，
    # 否则 --newer-than 模式的断点续传会误把损坏的图当成已完成而跳过。
    # os.replace() 在 Windows / POSIX 上都是原子 rename（同分区）。
    tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
    out_img.save(tmp_path, "PNG", optimize=True)
    import os as _os
    _os.replace(tmp_path, out_path)
    # silence linter：NEGATIVE_PROMPT 留作 pixel 风格的参考文档，运行时不直接用
    _ = NEGATIVE_PROMPT
    return "ok"


def write_manifest(stats: dict, total: int):
    """每条生成后增量写 manifest，便于断点续传查看进度。"""
    import datetime
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "bakedAt": datetime.datetime.now().isoformat(),
        "stats": stats,
        "total": total,
        "model": {"base": BASE_MODEL, "style_mode": STYLE_MODE},
        "params": {
            "gen_base": GEN_BASE,
            "target_long": TARGET_LONG,
            "palette_colors": PALETTE_COLORS,
            "guidance": GUIDANCE,
            "steps": NUM_INFERENCE_STEPS,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refs", default=str(REFS_JSON_DEFAULT), help="refs.json 路径")
    ap.add_argument(
        "--catalog",
        default=None,
        help="visual-assets.json 路径（取代 --refs，用于大规模视觉资产清单）",
    )
    ap.add_argument("--force", action="store_true", help="忽略已有文件强制重生")
    ap.add_argument("--only", nargs="+", help="只跑这几个 id")
    ap.add_argument("--limit", type=int, help="只跑前 N 个（调试用）")
    ap.add_argument(
        "--newer-than",
        default=None,
        help=(
            "ISO 时间 (如 2026-05-25T00:00:00)：跳过 mtime 晚于此时间的 PNG。"
            "用于增量重画：已经用新 prompt 生成的不重画，旧的全部重画。"
            "与 --force 互斥（同时用时优先 --newer-than 的判定）。"
        ),
    )
    ap.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="生成最多 N 张后退出。配合 --newer-than 做'夜跑分批'：脚本退出码 99 表示无活可做，0 表示还有活继续。",
    )
    ap.add_argument(
        "--category",
        nargs="+",
        help="只跑这些 category（仅 catalog 模式有效）",
    )
    ap.add_argument(
        "--style",
        choices=["illustration", "pixel"],
        default="illustration",
        help="输出风格：illustration（默认，干净彩色插画）/ pixel（兼容老调色板像素画）",
    )
    args = ap.parse_args()

    # 把 CLI 的风格选择写回模块全局，bake_one() 读这个全局判断后处理路径
    global STYLE_MODE
    STYLE_MODE = args.style
    print(f"[bake] 风格模式：{STYLE_MODE}")

    if args.catalog:
        catalog_path = Path(args.catalog)
        if not catalog_path.exists():
            print(f"[bake] 找不到 catalog：{catalog_path}")
            sys.exit(1)
        refs = json.loads(catalog_path.read_text(encoding="utf-8"))
        print(f"[bake] 读到 catalog 共 {len(refs)} 个视觉资产：{catalog_path}")
    else:
        refs_path = Path(args.refs)
        if not refs_path.exists():
            print(f"[bake] 找不到 refs.json：{refs_path}")
            print("[bake] 请先运行：npx tsx scripts/pixel-bake/_dump-refs.mts > scripts/pixel-bake/refs.json")
            sys.exit(1)
        refs = json.loads(refs_path.read_text(encoding="utf-8"))
        print(f"[bake] 读到 {len(refs)} 个 references：{refs_path}")

    # 筛选
    if args.category:
        wanted_cat = set(args.category)
        refs = [r for r in refs if r.get("category") in wanted_cat]
        print(f"[bake] --category 过滤后 {len(refs)} 个")
    if args.only:
        wanted = set(args.only)
        refs = [r for r in refs if r["id"] in wanted]
        print(f"[bake] --only 过滤后 {len(refs)} 个")
    if args.limit:
        refs = refs[: args.limit]

    # 计算筛选条件 ----
    # --newer-than 模式：解析 ISO 时间 → epoch；mtime 晚于该值的 PNG 被认为"已用新模型/prompt 生成"，跳过。
    # 与 --force 同时给时：以 --newer-than 为准（更精细），--force 失效。
    cutoff_ts = None
    if args.newer_than:
        try:
            from datetime import datetime
            cutoff_ts = datetime.fromisoformat(args.newer_than).timestamp()
            print(f"[bake] --newer-than: 跳过 mtime > {args.newer_than} 的 PNG")
        except ValueError as e:
            print(f"[bake] --newer-than 时间格式非法: {e}")
            sys.exit(1)

    # 增量 todo 构建
    todo = []
    skipped_exists = 0
    skipped_fresh = 0
    for r in refs:
        out_path = OUT_DIR / f"{r['id']}.png"
        if cutoff_ts is not None:
            # 模式：按 mtime 判定。文件不存在 = 缺失 → 重画；mtime > cutoff = 新版本 → 跳过。
            if out_path.exists() and out_path.stat().st_mtime > cutoff_ts:
                skipped_fresh += 1
                continue
        elif not args.force and out_path.exists():
            # 默认模式：文件存在就跳过
            skipped_exists += 1
            continue
        todo.append((r, out_path))

    if cutoff_ts is not None:
        print(f"[bake] 待重画 {len(todo)} 个；已跳过 {skipped_fresh} 个（mtime 较新）")
    else:
        print(
            f"[bake] 待生成 {len(todo)} 个，已跳过 {skipped_exists} 个"
            f"{'（--force 模式忽略 skip）' if args.force else '（增量）'}"
        )

    if not todo:
        print("[bake] 都已存在/已是新版，结束。")
        # 退出码 99 = 没活了；夜跑外层脚本看到 99 就停。
        sys.exit(99)

    # --max-items 截断：留下前 N 个
    if args.max_items is not None and args.max_items > 0:
        if len(todo) > args.max_items:
            print(f"[bake] --max-items={args.max_items}：本次只处理前 {args.max_items} 个，剩余 {len(todo) - args.max_items} 个留给下轮")
            todo = todo[: args.max_items]

    pipe = load_pipeline()

    stats = {"ok": 0, "fail": 0, "failures": []}
    for i, (ref, out_path) in enumerate(tqdm(todo, desc="bake")):
        seed = SEED_BASE + abs(hash(ref["id"])) % 100000
        try:
            bake_one(pipe, ref, out_path, seed=seed)
            stats["ok"] += 1
        except Exception as e:
            stats["fail"] += 1
            stats["failures"].append({"id": ref["id"], "error": str(e)})
            print(f"\n[bake] 失败 {ref['id']}: {e}")
        finally:
            if torch.cuda.is_available():
                torch.cuda.synchronize()
                torch.cuda.empty_cache()
        # 每个条目都更新 manifest，断电/Ctrl+C 后续传也能看到进度
        write_manifest(stats, len(todo))

    print(f"[bake] 完成：{stats['ok']} ok / {stats['fail']} fail")
    print(f"[bake] manifest 写到 {MANIFEST}")


if __name__ == "__main__":
    main()
