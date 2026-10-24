"use client";

import * as React from "react";
import { Settings, Check, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { resolveAsset } from "@/lib/utils";

interface Preset {
  name: string;
  baseUrl: string;
  model: string;
}

const PRESETS: Record<string, Preset> = {
  mimo: {
    name: "Xiaomi MiMo",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    model: "mimo-v2.5-pro",
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  zhipu: {
    name: "Zhipu GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4",
  },
  moonshot: {
    name: "Moonshot Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
  qwen: {
    name: "Alibaba Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
};

export default function FooterSettings() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form states
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [hasKey, setHasKey] = React.useState(false);

  // Fetch current config when opening the modal
  const fetchConfig = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(resolveAsset("/api/llm-config"));
      const data = await res.json();
      if (!res.ok || !data.success || !data.config) {
        throw new Error("Unable to load model settings");
      }
      if (data.success && data.config) {
        setBaseUrl(data.config.baseUrl || "");
        setModel(data.config.model || "");
        setHasKey(data.config.hasKey || false);
        // Keep the secret input empty; the server preserves an unchanged key.
        setApiKey("");
      }
    } catch {
      setError("Unable to load model settings. Please try again.");
    } finally {
      setFetching(false);
    }
  };


  const handlePresetChange = (presetKey: string) => {
    if (presetKey === "custom") return;
    const preset = PRESETS[presetKey];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModel(preset.model);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // A blank input preserves the saved key; it does not clear credentials.
    const keyToSubmit = apiKey.trim() || (hasKey ? "____KEEP_EXISTING____" : "");

    try {
      const res = await fetch(resolveAsset("/api/llm-config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: keyToSubmit,
          baseUrl: baseUrl.trim(),
          model: model.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 1200);
      } else {
        setError(data.error || "Unable to save settings.");
      }
    } catch {
      setError("Network error. Unable to save settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <footer lang="en" className="mt-10 flex items-center justify-center gap-2 text-xs text-[color:var(--foreground)]/45">
        <span>AI-assisted illustrations and attributed open-source icons</span>
        <button
          onClick={() => { setIsOpen(true); void fetchConfig(); }}
          className="p-1.5 rounded-full text-[color:var(--foreground)]/45 hover:text-[#B57BFF] hover:bg-[#F4EEFF] active:scale-95 transition-all"
          title="Local AI settings"
          aria-label="Open local AI settings"
        >
          <Settings size={14} className="animate-hover-spin" />
        </button>
      </footer>

      {isOpen && (
        <div lang="en" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-3xl bg-[#FFFDF6] border-4 border-[#8B6B4F]/20 shadow-2xl p-6 text-[color:var(--foreground)] animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b-2 border-dashed border-[#8B6B4F]/10 pb-4 mb-4">
              <div className="p-2 bg-[#F4EEFF] rounded-2xl text-[#B57BFF]">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#8B6B4F]">Local AI settings</h3>
                <p className="text-xs text-[#8B6B4F]/60">For your local instance. Bring your own compatible provider.</p>
              </div>
            </div>

            {fetching ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-[#B57BFF]" size={32} />
                <span className="text-sm text-[#8B6B4F]/60">Loading settings...</span>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                
                {/* Preset Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#8B6B4F]">Provider preset</label>
                  <select
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border-2 border-[#8B6B4F]/10 bg-white text-sm focus:outline-none focus:border-[#B57BFF] cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Choose a provider preset --</option>
                    {Object.entries(PRESETS).map(([key, p]) => (
                      <option key={key} value={key}>{p.name}</option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#8B6B4F]">API key</label>
                    {hasKey && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAF8F5] text-[#2EC4B6] font-bold">
                        Key configured
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder={hasKey ? "Leave blank to keep the saved key" : "Enter your provider API key"}
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border-2 border-[#8B6B4F]/10 bg-white text-sm focus:outline-none focus:border-[#B57BFF]"
                  />
                </div>

                {/* Base URL */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#8B6B4F]">API base URL</label>
                  <input
                    type="text"
                    required
                    placeholder="https://api.deepseek.com"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border-2 border-[#8B6B4F]/10 bg-white text-sm focus:outline-none focus:border-[#B57BFF]"
                  />
                </div>

                {/* Model Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#8B6B4F]">Model identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="deepseek-chat"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border-2 border-[#8B6B4F]/10 bg-white text-sm focus:outline-none focus:border-[#B57BFF]"
                  />
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#FFEAEA] text-[#FF5B5B] text-xs">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t-2 border-dashed border-[#8B6B4F]/10 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2 text-sm rounded-2xl border-2 border-[#8B6B4F]/20 text-[#8B6B4F]/60 font-bold hover:bg-[#8B6B4F]/5 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || success}
                    className="flex-1 px-4 py-2 text-sm rounded-2xl bg-[#B57BFF] text-white font-bold hover:bg-[#9E62F2] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : success ? (
                      <>
                        <Check size={16} />
                        <span>Saved</span>
                      </>
                    ) : (
                      <span>Save settings</span>
                    )}
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}
    </>
  );
}
