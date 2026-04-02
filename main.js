import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import mermaid from 'mermaid';

let editor = null;
let currentFilename = '';
let currentContent = '';

const dropZone = document.getElementById('drop-zone');
const editorEl = document.getElementById('editor');
const filenameEl = document.getElementById('filename');
const fileInput = document.getElementById('file-input');

// 初始化 Mermaid
mermaid.initialize({ startOnLoad: false, theme: 'default' });

let mermaidCounter = 0;

// 渲染 Mermaid 图表
async function renderMermaid() {
  // 尝试多种选择器匹配 Milkdown 渲染的代码块
  const selectors = [
    'pre code.language-mermaid',
    'pre[data-language="mermaid"] code',
    'code[data-language="mermaid"]',
    'pre[class*="mermaid"] code',
  ];
  
  let codeBlocks = [];
  for (const sel of selectors) {
    codeBlocks = editorEl.querySelectorAll(sel);
    if (codeBlocks.length > 0) break;
  }
  
  // 如果上面的都没匹配到，遍历所有 pre > code 看内容是否像 mermaid
  if (codeBlocks.length === 0) {
    const allPres = editorEl.querySelectorAll('pre');
    const mermaidPres = [];
    allPres.forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      const text = code.textContent.trim();
      // 检查是否有 data-type="mermaid" 或 data-language="mermaid"
      if (pre.dataset.language === 'mermaid' || pre.dataset.type === 'mermaid' ||
          code.dataset.language === 'mermaid' || code.dataset.type === 'mermaid') {
        mermaidPres.push(code);
        return;
      }
      // 检查内容是否像 mermaid 语法
      if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)\b/m.test(text)) {
        mermaidPres.push(code);
      }
    });
    codeBlocks = mermaidPres;
  }
  
  for (let i = 0; i < codeBlocks.length; i++) {
    const code = codeBlocks[i] instanceof HTMLElement ? codeBlocks[i] : codeBlocks[i];
    const pre = code.closest('pre') || code.parentElement;
    const mermaidCode = code.textContent.trim();
    
    try {
      const id = `mermaid-${Date.now()}-${mermaidCounter++}`;
      const { svg } = await mermaid.render(id, mermaidCode);
      const div = document.createElement('div');
      div.className = 'mermaid-diagram';
      div.innerHTML = svg;
      // 保存原始代码，双击可编辑
      div.dataset.mermaidCode = mermaidCode;
      pre.replaceWith(div);
    } catch (e) {
      console.error('Mermaid render error:', e, mermaidCode);
    }
  }
}

const welcomeMarkdown = `# 欢迎使用 BrainDown

一个专为 AI 生成内容设计的 Markdown 编辑器。

## 快速开始

- **拖拽文件**：将 \`.md\` 文件拖到这里
- **打开文件**：点击工具栏的"打开文件"按钮
- **开始写作**：点击"新建"创建新文档

## 特性

- ✨ **所见即所得**：无语法符号干扰，专注内容
- 🎨 **精美排版**：大三度音阶字号，1.7 倍行高
- 📝 **完整支持**：标题、列表、表格、代码块、引用
- 💾 **本地优先**：文件保存在你的设备上

## 示例

### 文本格式

这是**粗体**，这是*斜体*，这是\`行内代码\`。

### 代码块

\`\`\`javascript
function hello() {
  console.log("Hello, BrainDown!");
}
\`\`\`

### 表格

| 功能 | 状态 |
|------|------|
| 编辑 | ✅ |
| 保存 | ✅ |

---

现在就开始使用吧！点击工具栏的"打开文件"或拖拽文件到这里。
`;

// 初始化编辑器
async function initEditor(markdown = welcomeMarkdown) {
  if (editor) {
    await editor.destroy();
  }
  
  dropZone.style.display = 'none';
  editorEl.style.display = 'block';
  editorEl.innerHTML = '';
  
  editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, editorEl);
      ctx.set(defaultValueCtx, markdown);
      ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
        currentContent = markdown;
      });
    })
    .use(commonmark)
    .use(gfm)
    .use(listener)
    .create();
  
  currentContent = markdown;
  
  // 渲染 Mermaid 图表（等 Milkdown 渲染完）
  setTimeout(() => renderMermaid(), 500);
}

// 打开文件
async function openFile(file) {
  const text = await file.text();
  currentFilename = file.name;
  filenameEl.textContent = currentFilename;
  await initEditor(text);
}

// 保存文件
function saveFile() {
  const blob = new Blob([currentContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename || 'untitled.md';
  a.click();
  URL.revokeObjectURL(url);
}

// 事件监听
document.getElementById('new-btn').onclick = () => {
  currentFilename = 'untitled.md';
  filenameEl.textContent = currentFilename;
  initEditor();
};

document.getElementById('open-btn').onclick = () => fileInput.click();
document.getElementById('save-btn').onclick = saveFile;

fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) openFile(file);
};

// 拖拽支持
dropZone.ondragover = (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
};

dropZone.ondragleave = () => {
  dropZone.classList.remove('drag-over');
};

dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.match(/\.(md|markdown)$/i)) {
    openFile(file);
  }
};

// 全局拖拽支持（编辑器打开后也能拖拽）
document.body.ondragover = (e) => {
  e.preventDefault();
};

document.body.ondrop = (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.name.match(/\.(md|markdown)$/i)) {
    openFile(file);
  }
};

// 页面加载时自动显示欢迎页
window.addEventListener('DOMContentLoaded', () => {
  currentFilename = 'welcome.md';
  filenameEl.textContent = currentFilename;
  initEditor();
});
