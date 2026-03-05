import { useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  keyPrefix: string;
  fullKey: string;
  isActive: boolean;
}

export default function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([
    {
      id: "default",
      name: "默认账号",
      keyPrefix: "sk-ant-...****",
      fullKey: "",
      isActive: true,
    },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const maskKey = (key: string) => {
    if (key.length < 12) return "****";
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  };

  const handleAdd = () => {
    if (!newName || !newKey) return;
    const id = `account_${Date.now()}`;
    setAccounts([
      ...accounts,
      {
        id,
        name: newName,
        keyPrefix: maskKey(newKey),
        fullKey: newKey,
        isActive: false,
      },
    ]);
    setShowAdd(false);
    setNewName("");
    setNewKey("");
  };

  const handleActivate = (id: string) => {
    setAccounts(
      accounts.map((a) => ({ ...a, isActive: a.id === id }))
    );
    // In real implementation: update ANTHROPIC_API_KEY env var via backend
  };

  const handleDelete = (id: string) => {
    if (accounts.find((a) => a.id === id)?.isActive) return;
    setAccounts(accounts.filter((a) => a.id !== id));
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-obsidian-300 font-medium">
        API Key 管理
      </div>

      {/* Account list */}
      <div className="space-y-1.5">
        {accounts.map((a) => (
          <div
            key={a.id}
            className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
              a.isActive
                ? "border-amber-glow/30 bg-amber-glow/5"
                : "border-obsidian-700/40 bg-obsidian-800/30 hover:border-obsidian-600/50"
            }`}
            onClick={() => handleActivate(a.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    a.isActive
                      ? "bg-emerald-ok shadow-[0_0_6px] shadow-emerald-ok/50"
                      : "bg-obsidian-500"
                  }`}
                />
                <span className="text-xs font-medium text-obsidian-100">
                  {a.name}
                </span>
                {a.isActive && (
                  <Check size={11} className="text-emerald-ok" />
                )}
              </div>
              {!a.isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(a.id);
                  }}
                  className="p-1 rounded hover:bg-obsidian-700/50 text-obsidian-400 hover:text-rose-err transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 pl-4">
              <Key size={10} className="text-obsidian-400" />
              <span className="text-[10px] font-mono text-obsidian-400">
                {a.keyPrefix}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd ? (
        <div className="p-3 rounded-lg border border-obsidian-600/40 bg-obsidian-800/40 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="账号名称（如：生产环境）"
            className="w-full text-xs bg-obsidian-700/50 border border-obsidian-600/30 rounded-md px-2.5 py-1.5 text-obsidian-100 placeholder-obsidian-400 focus:outline-none focus:border-amber-glow/30"
          />
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full text-xs font-mono bg-obsidian-700/50 border border-obsidian-600/30 rounded-md px-2.5 py-1.5 pr-8 text-obsidian-100 placeholder-obsidian-400 focus:outline-none focus:border-amber-glow/30"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-obsidian-400"
            >
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs px-3 py-1.5 text-obsidian-300"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-obsidian-300 hover:text-amber-glow transition-colors"
        >
          <Plus size={12} /> 添加 API Key
        </button>
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-glow/5 border border-amber-glow/10">
        <AlertTriangle size={12} className="text-amber-glow flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-obsidian-300 leading-relaxed">
          API Key 仅保存在本地，不会上传到任何服务器。切换账号将修改当前进程的环境变量。
        </p>
      </div>
    </div>
  );
}
