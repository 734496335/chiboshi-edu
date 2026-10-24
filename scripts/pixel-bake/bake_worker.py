"""
尺博士 · 像素图标常驻烘焙 Worker

为什么需要这个：
  bake.py 每次只烘 N 张就退出，进程下次启动还要再加载 ~10GB SDXL 权重
  （即使 HuggingFace 缓存命中，也要 30~60s 的"导入 + to(cuda) + warmup"开销）。
  对话式"无限物品生成"场景下，每加一个新物就让用户等 1 分钟很糟糕。

  本脚本作为一个守护进程：启动时加载一次 pipeline，然后用 stdin/stdout 的
  line-delimited JSON 协议接收烘焙任务并即时回包。常态下烘一张 ≈ 8~15s。

协议（stdin → stdout，每行一个 JSON 对象）：
  入：{"op":"bake", "jobId":"abc", "ref": {... full catalog entry ...}}
  入：{"op":"ping", "id":"x"}
  入：{"op":"shutdown"}
  出：{"event":"starting"}                                  启动一次
  出：{"event":"loading", "stage":"base|lora|gpu"}          加载阶段
  出：{"event":"ready"}                                      可接活了
  出：{"event":"baked",   "jobId":"abc", "id":"...", "elapsedMs":N}
  出:  {"event":"bake_failed", "jobId":"abc", "id":"...", "error":"..."}
  出:  {"event":"pong",   "id":"x"}
  出:  {"event":"bye"}                                       优雅退出

  为了便于调试，所有诊断日志都写到 **stderr**，stdout 只走结构化 JSON。
"""
from __future__ import annotations

import json
import sys
import time
import traceback
from pathlib import Path

# 复用 bake.py 里的所有图像处理与 ref 解析逻辑
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

# 让 stdout 完全无缓冲，否则 Node 端拿不到事件
try:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)  # type: ignore[attr-defined]
except Exception:
    pass


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(msg: str) -> None:
    sys.stderr.write(f"[bake-worker] {msg}\n")
    sys.stderr.flush()


def main() -> int:
    emit({"event": "starting"})
    try:
        import torch  # noqa: F401  (导入即占显存，单独捕错以便友好提示)
    except Exception as e:
        emit({"event": "fatal", "error": f"torch import failed: {e}"})
        return 2

    try:
        emit({"event": "loading", "stage": "base"})
        from bake import (
            OUT_DIR,
            bake_one,
            load_pipeline,
            SEED_BASE,
        )
        emit({"event": "loading", "stage": "lora"})
        pipe = load_pipeline()
        emit({"event": "loading", "stage": "gpu"})
        # warmup: 用一个空 prompt 跑一遍真实步数，把 cuda kernels JIT 编完
        # （避免第一张真实任务多花 5~10s）
        # FLUX-schnell 标配 4 步 + guidance=0；以前 SDXL 时代是 25 步 + guidance=8。
        # 用 bake.py 的常量保持一致，不需要在两处维护。
        try:
            import torch as _torch
            from bake import GUIDANCE, NUM_INFERENCE_STEPS  # noqa: WPS433
            with _torch.no_grad():
                pipe(
                    prompt="warmup",
                    num_inference_steps=NUM_INFERENCE_STEPS,
                    guidance_scale=GUIDANCE,
                    width=512,
                    height=512,
                ).images
            if _torch.cuda.is_available():
                _torch.cuda.synchronize()
                _torch.cuda.empty_cache()
        except Exception as e:
            log(f"warmup pass failed (non-fatal): {e}")
    except Exception as e:
        emit(
            {
                "event": "fatal",
                "error": f"pipeline load failed: {e}",
                "trace": traceback.format_exc(),
            }
        )
        return 3

    emit({"event": "ready"})

    # 主循环：每行一条 JSON 任务
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except Exception as e:
            emit({"event": "error", "error": f"bad json: {e}", "raw": line[:200]})
            continue

        op = job.get("op")
        if op == "ping":
            emit({"event": "pong", "id": job.get("id")})
            continue
        if op == "shutdown":
            emit({"event": "bye"})
            return 0
        if op != "bake":
            emit({"event": "error", "error": f"unknown op: {op}"})
            continue

        ref = job.get("ref") or {}
        rid = ref.get("id")
        job_id = job.get("jobId")
        if not rid:
            emit(
                {
                    "event": "bake_failed",
                    "jobId": job_id,
                    "error": "ref.id missing",
                }
            )
            continue

        out_path = OUT_DIR / f"{rid}.png"
        t0 = time.time()
        try:
            seed = SEED_BASE + abs(hash(rid)) % 100000

            # 真实进度回调：把 bake_one 抛出的 (stage, step, total) 转成
            # {event:"progress", jobId, stage, step, total} 行写到 stdout。
            # Node 侧 bakeWorker.ts 会解析后转发给前端 SSE。
            def _emit_progress(stage: str, step: int, total: int) -> None:
                emit(
                    {
                        "event": "progress",
                        "jobId": job_id,
                        "id": rid,
                        "stage": stage,
                        "step": step,
                        "total": total,
                    }
                )

            bake_one(
                pipe,
                ref,
                out_path,
                seed=seed,
                step_callback=_emit_progress,
            )
            elapsed_ms = int((time.time() - t0) * 1000)
            emit(
                {
                    "event": "baked",
                    "jobId": job_id,
                    "id": rid,
                    "path": str(out_path),
                    "elapsedMs": elapsed_ms,
                }
            )
        except Exception as e:
            elapsed_ms = int((time.time() - t0) * 1000)
            emit(
                {
                    "event": "bake_failed",
                    "jobId": job_id,
                    "id": rid,
                    "error": str(e),
                    "trace": traceback.format_exc(),
                    "elapsedMs": elapsed_ms,
                }
            )
        finally:
            try:
                import torch as _torch
                if _torch.cuda.is_available():
                    _torch.cuda.synchronize()
                    _torch.cuda.empty_cache()
            except Exception:
                pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
