import { useEffect, useState } from "react";

// 支持多个图标库地址
const ICONS_URLS = [
  "https://raw.githubusercontent.com/gfw-list/pxy-icon/main/icons.json",
  "https://raw.githubusercontent.com/Koolson/Qure/master/Other/QureColor-All.json",
  "https://raw.githubusercontent.com/Orz-3/mini/master/miniColor.json",
];

function normalizeName(name) {
  return String(name || "")
    .trim() // 去掉前后空格
    .replace(/\.[^/.]+$/, "") // 去掉扩展名 .png/.svg/.jpg 等
    .toLowerCase(); // 统一小写
}

/**
 * Hook: 加载远程图标库，并格式化为 { name, url, nameNorm, source }
 */
export function useProxyIconLibrary() {
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      ICONS_URLS.map((url) =>
        fetch(url)
          .then((res) => res.json())
          .then((data) => ({ url, data }))
          .catch((err) => {
            console.error("Failed to load icons", url, err);
            return null;
          }),
      ),
    ).then((results) => {
      const merged = (results || [])
        .filter(Boolean)
        .flatMap(({ url, data }) => {
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.icons)
              ? data.icons
              : [];

          return list
            .filter((icon) => icon && icon.url && icon.name)
            .map((icon) => ({
              name: icon.name,
              url: icon.url,
              nameNorm: normalizeName(icon.name),
              source: url,
            }));
        });

      setIcons(merged);
      setLoading(false);
    });
  }, []);

  return { icons, loading };
}

/**
 * group name 前的小图标（固定 32×32）
 */
export function ProxyGroupIcon({ src }) {
  if (!src) return null;
  return <img src={src} alt="" className="w-8 h-8 object-contain" />;
}

/**
 * 右键菜单里的图标（固定 32×32，带最大高度 + 滚动条 + 固定关闭按钮）
 */
export function ProxyIconMenu({ x, y, group, icons, onSelect, onClose }) {
  if (!group) return null;

  const [query, setQuery] = useState("");

  const OFFSET_X = 12;
  const OFFSET_Y = 8;
  const MENU_WIDTH = 320;
  const MENU_HEIGHT = 384;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x + OFFSET_X;
  let top = y + OFFSET_Y;

  if (x + MENU_WIDTH + OFFSET_X > viewportWidth) {
    left = x - MENU_WIDTH - OFFSET_X;
    if (left < 8) left = 8;
  }
  if (top + MENU_HEIGHT > viewportHeight) {
    top = viewportHeight - MENU_HEIGHT - 8;
  }
  if (top < 8) top = 8;

  const q = query.trim().toLowerCase();

  // 只按名称关键词匹配（使用标准化后的 nameNorm）
  const filteredIcons = icons.filter((icon) => {
    const nameNorm = icon.nameNorm ?? icon.name?.toLowerCase() ?? "";
    return q === "" ? true : nameNorm.includes(q);
  });

  return (
    <div
      className="fixed bg-[#26333a] text-white rounded shadow-lg z-50 w-80"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      {/* 关闭按钮 */}
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-white text-lg font-bold z-10"
        onClick={onClose}
        title="Close"
      >
        ×
      </button>

      {/* 搜索框 */}
      <div className="p-2 flex items-center justify-between gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons..."
          className="w-2/3 px-2 py-1 rounded bg-gray-700/60 text-sm text-white placeholder-gray-400/40 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* 内容区域：有关键词时不显示分组标题，只显示结果 */}
      <div className="p-4 pt-2 max-h-80 overflow-y-auto grid grid-cols-6 gap-2">
        {q === "" && (
          <div className="col-span-6 text-sm mb-2 font-semibold">{group}</div>
        )}

        {filteredIcons.map((icon) => (
          <img
            key={`${icon.name}-${icon.url}`}
            src={icon.url}
            alt={icon.name}
            className="w-10 h-10 object-contain cursor-pointer hover:scale-110 transition"
            onClick={() => onSelect(group, icon.url)}
            title={icon.name}
          />
        ))}

        {filteredIcons.length === 0 && (
          <div className="col-span-6 text-xs text-gray-400">No results</div>
        )}
      </div>
    </div>
  );
}
