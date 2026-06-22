/**
 * Swagger UI 暗色主题。
 *
 * 实现方式：所有暗色规则都加 `html:not(.swagger-light)` 前缀。
 * - 默认（<html> 无 .swagger-light 类）即暗色，页面打开就是暗色，避免白屏闪烁。
 * - 切到日间时由脚本给 <html> 添加 .swagger-light 类，所有暗色规则自动失效，
 *   回退到 Swagger UI 原生亮色主题，无需逐条覆盖。
 */
export const swaggerDarkCss = `
html:not(.swagger-light) {
  --sg-bg: #1b1b1f;
  --sg-bg-soft: #232329;
  --sg-bg-card: #26262d;
  --sg-bg-inset: #15151a;
  --sg-border: #3a3a45;
  --sg-text: #e6e6ea;
  --sg-text-dim: #a6a6b3;
  --sg-link: #79c0ff;
  --sg-code: #e6e6ea;
}

html:not(.swagger-light) body { background: var(--sg-bg); }
html:not(.swagger-light) .swagger-ui { color: var(--sg-text); }
html:not(.swagger-light) .swagger-ui .wrapper { color: var(--sg-text); }
html:not(.swagger-light) .swagger-ui .scheme-container,
html:not(.swagger-light) .swagger-ui .opblock-tag,
html:not(.swagger-light) .swagger-ui section.models {
  background: var(--sg-bg);
}

/* 标题 / 文字 */
html:not(.swagger-light) .swagger-ui .info .title,
html:not(.swagger-light) .swagger-ui .info li,
html:not(.swagger-light) .swagger-ui .info p,
html:not(.swagger-light) .swagger-ui .info table,
html:not(.swagger-light) .swagger-ui .info h1,
html:not(.swagger-light) .swagger-ui .info h2,
html:not(.swagger-light) .swagger-ui .info h3,
html:not(.swagger-light) .swagger-ui label,
html:not(.swagger-light) .swagger-ui .opblock-tag,
html:not(.swagger-light) .swagger-ui .opblock-tag small,
html:not(.swagger-light) .swagger-ui .opblock .opblock-summary-operation-id,
html:not(.swagger-light) .swagger-ui .opblock .opblock-summary-path,
html:not(.swagger-light) .swagger-ui .opblock .opblock-summary-path__deprecated,
html:not(.swagger-light) .swagger-ui .opblock .opblock-summary-description,
html:not(.swagger-light) .swagger-ui .opblock-description-wrapper p,
html:not(.swagger-light) .swagger-ui .opblock-external-docs-wrapper p,
html:not(.swagger-light) .swagger-ui .opblock-title_normal p,
html:not(.swagger-light) .swagger-ui .opblock .opblock-section-header h4,
html:not(.swagger-light) .swagger-ui .opblock .opblock-section-header > label,
html:not(.swagger-light) .swagger-ui .tab li,
html:not(.swagger-light) .swagger-ui .parameter__name,
html:not(.swagger-light) .swagger-ui .parameters-col_description p,
html:not(.swagger-light) .swagger-ui table thead tr td,
html:not(.swagger-light) .swagger-ui table thead tr th,
html:not(.swagger-light) .swagger-ui .response-col_status,
html:not(.swagger-light) .swagger-ui .response-col_links,
html:not(.swagger-light) .swagger-ui .responses-inner h4,
html:not(.swagger-light) .swagger-ui .responses-inner h5,
html:not(.swagger-light) .swagger-ui .model-title,
html:not(.swagger-light) .swagger-ui .model,
html:not(.swagger-light) .swagger-ui section.models h4,
html:not(.swagger-light) .swagger-ui .renderedMarkdown p,
html:not(.swagger-light) .swagger-ui .renderedMarkdown li {
  color: var(--sg-text);
}

html:not(.swagger-light) .swagger-ui .parameter__type,
html:not(.swagger-light) .swagger-ui .parameter__in,
html:not(.swagger-light) .swagger-ui .parameter__extension,
html:not(.swagger-light) .swagger-ui .prop-format,
html:not(.swagger-light) .swagger-ui .opblock-tag small,
html:not(.swagger-light) .swagger-ui .tab li.tabitem:not(.active) {
  color: var(--sg-text-dim);
}

/* 链接 */
html:not(.swagger-light) .swagger-ui .info a,
html:not(.swagger-light) .swagger-ui .info a:hover,
html:not(.swagger-light) .swagger-ui a.nostyle,
html:not(.swagger-light) .swagger-ui .opblock-summary-path a {
  color: var(--sg-link);
}

/* 分组标题下边框 */
html:not(.swagger-light) .swagger-ui .opblock-tag {
  border-bottom: 1px solid var(--sg-border);
}

/* 顶部 explorer 栏 */
html:not(.swagger-light) .swagger-ui .topbar { background: var(--sg-bg-inset); }

/* scheme / Authorize 容器 */
html:not(.swagger-light) .swagger-ui .scheme-container {
  background: var(--sg-bg-soft);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

/* 接口块 */
html:not(.swagger-light) .swagger-ui .opblock {
  background: var(--sg-bg-card);
  border-color: var(--sg-border);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.35);
}
html:not(.swagger-light) .swagger-ui .opblock .opblock-section-header {
  background: var(--sg-bg-soft);
  box-shadow: none;
}
html:not(.swagger-light) .swagger-ui .opblock.opblock-get { background: rgba(97, 175, 254, 0.08); border-color: #61affe; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-post { background: rgba(73, 204, 144, 0.08); border-color: #49cc90; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-put { background: rgba(252, 161, 48, 0.08); border-color: #fca130; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-delete { background: rgba(249, 62, 62, 0.08); border-color: #f93e3e; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-patch { background: rgba(80, 227, 194, 0.08); border-color: #50e3c2; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-head { background: rgba(144, 18, 254, 0.08); border-color: #9012fe; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-options { background: rgba(13, 90, 167, 0.1); border-color: #0d5aa7; }
html:not(.swagger-light) .swagger-ui .opblock.opblock-deprecated { background: rgba(150, 150, 150, 0.08); border-color: #666; }

/* 表格 */
html:not(.swagger-light) .swagger-ui table thead tr td,
html:not(.swagger-light) .swagger-ui table thead tr th {
  border-bottom: 1px solid var(--sg-border);
}
html:not(.swagger-light) .swagger-ui .parameters-col_description,
html:not(.swagger-light) .swagger-ui table.model tbody tr td {
  border-color: var(--sg-border);
}

/* 表单控件 */
html:not(.swagger-light) .swagger-ui input[type=text],
html:not(.swagger-light) .swagger-ui input[type=password],
html:not(.swagger-light) .swagger-ui input[type=email],
html:not(.swagger-light) .swagger-ui input[type=number],
html:not(.swagger-light) .swagger-ui input[type=search],
html:not(.swagger-light) .swagger-ui textarea,
html:not(.swagger-light) .swagger-ui select {
  background: var(--sg-bg-inset);
  color: var(--sg-text);
  border: 1px solid var(--sg-border);
}
html:not(.swagger-light) .swagger-ui textarea { color: var(--sg-text); }
html:not(.swagger-light) .swagger-ui input::placeholder,
html:not(.swagger-light) .swagger-ui textarea::placeholder { color: var(--sg-text-dim); }

/* 代码 / 示例区 */
html:not(.swagger-light) .swagger-ui .highlight-code,
html:not(.swagger-light) .swagger-ui .microlight,
html:not(.swagger-light) .swagger-ui .opblock-body pre.microlight {
  background: var(--sg-bg-inset) !important;
}
html:not(.swagger-light) .swagger-ui .microlight,
html:not(.swagger-light) .swagger-ui .opblock-body pre.microlight,
html:not(.swagger-light) .swagger-ui .opblock-body pre.microlight code {
  color: var(--sg-code);
}
html:not(.swagger-light) .swagger-ui .renderedMarkdown code,
html:not(.swagger-light) .swagger-ui .markdown code {
  background: var(--sg-bg-inset);
  color: #f0a868;
}

/* 按钮 */
html:not(.swagger-light) .swagger-ui .btn {
  color: var(--sg-text);
  border-color: var(--sg-border);
  background: transparent;
}
html:not(.swagger-light) .swagger-ui .btn:hover { background: rgba(255, 255, 255, 0.05); }
html:not(.swagger-light) .swagger-ui .btn.cancel { color: #f93e3e; border-color: #f93e3e; }

/* 模型区 */
html:not(.swagger-light) .swagger-ui section.models {
  border-color: var(--sg-border);
}
html:not(.swagger-light) .swagger-ui section.models.is-open h4 {
  border-bottom: 1px solid var(--sg-border);
}
html:not(.swagger-light) .swagger-ui .model-box {
  background: var(--sg-bg-soft);
}
html:not(.swagger-light) .swagger-ui .prop-type { color: #9b87f5; }
html:not(.swagger-light) .swagger-ui .model .property.primitive { color: var(--sg-text-dim); }

/* Authorize 等弹窗 */
html:not(.swagger-light) .swagger-ui .dialog-ux .modal-ux {
  background: var(--sg-bg-card);
  border: 1px solid var(--sg-border);
}
html:not(.swagger-light) .swagger-ui .dialog-ux .modal-ux-header {
  border-bottom: 1px solid var(--sg-border);
}
html:not(.swagger-light) .swagger-ui .dialog-ux .modal-ux-header h3,
html:not(.swagger-light) .swagger-ui .dialog-ux .modal-ux-content h4,
html:not(.swagger-light) .swagger-ui .dialog-ux .modal-ux-content p,
html:not(.swagger-light) .swagger-ui .dialog-ux .modal-ux-content label {
  color: var(--sg-text);
}

/* 箭头等图标 */
html:not(.swagger-light) .swagger-ui .expand-methods svg,
html:not(.swagger-light) .swagger-ui .expand-operation svg,
html:not(.swagger-light) .swagger-ui section.models h4 svg,
html:not(.swagger-light) .swagger-ui .model-toggle:after { fill: var(--sg-text-dim); }
html:not(.swagger-light) .swagger-ui .opblock-summary-control svg { fill: var(--sg-text-dim); }

/* 分隔线 */
html:not(.swagger-light) .swagger-ui hr { border-color: var(--sg-border); }

/* 主题切换按钮（日间 / 夜间通用） */
#swagger-theme-toggle {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 99999;
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid rgba(127, 127, 140, 0.5);
  background: rgba(40, 40, 48, 0.92);
  color: #f2f2f5;
  font-size: 13px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, background 0.15s ease;
}
#swagger-theme-toggle:hover { transform: translateY(-1px); background: rgba(60, 60, 70, 0.95); }
#swagger-theme-toggle:active { transform: translateY(0); }
`;

/**
 * 主题切换脚本：
 * - 读取 localStorage（默认 dark），尽早给 <html> 设置类，减少切换闪烁。
 * - 在页面右上角注入一个切换按钮，点击在 dark/light 间切换并持久化。
 */
export const swaggerThemeToggleJs = `
(function () {
  var KEY = 'swagger-color-theme';
  var html = document.documentElement;

  function apply(theme) {
    if (theme === 'light') html.classList.add('swagger-light');
    else html.classList.remove('swagger-light');
  }

  apply(localStorage.getItem(KEY) || 'dark');

  function mountButton() {
    if (document.getElementById('swagger-theme-toggle')) return;
    if (!document.body) { setTimeout(mountButton, 50); return; }

    var btn = document.createElement('button');
    btn.id = 'swagger-theme-toggle';
    btn.type = 'button';

    function refresh() {
      var isLight = html.classList.contains('swagger-light');
      btn.textContent = isLight ? '\\u2600\\uFE0F 日间' : '\\u{1F319} 夜间';
      btn.title = isLight ? '点击切换到夜间模式' : '点击切换到日间模式';
    }

    btn.addEventListener('click', function () {
      var next = html.classList.contains('swagger-light') ? 'dark' : 'light';
      localStorage.setItem(KEY, next);
      apply(next);
      refresh();
    });

    document.body.appendChild(btn);
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountButton);
  } else {
    mountButton();
  }
})();
`;
