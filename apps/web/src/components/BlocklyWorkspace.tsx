import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import type { utils } from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { islandTheme } from '../blocks/theme.ts';
import '../blocks/definitions.ts'; // 注册积木（副作用）
import '../blocks/generator.ts'; // 注册生成器（副作用）

export interface WorkspaceApi {
  workspace: Blockly.WorkspaceSvg;
  getXml(): string;
  getBlockCounts(): Record<string, number>;
  /** 当前积木编译出的 JS 代码（魔法代码预览用） */
  getCode(): string;
  /** 清空画布并载入一份 XML（草稿恢复用） */
  loadXml(xml: string): void;
}

interface Props {
  toolbox: utils.toolbox.ToolboxDefinition;
  /** 挂载时载入的积木（课程初始积木或自动草稿） */
  initialXml?: string;
  onReady: (api: WorkspaceApi) => void;
  onChange?: () => void;
  /** 组件销毁前同步回调最终 XML（草稿的最后一道保存保险），此时 workspace 仍可用 */
  onFlush?: (xml: string) => void;
}

export default function BlocklyWorkspace({ toolbox, initialXml, onReady, onChange, onFlush }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    const div = holder.current;
    if (!div) return;

    const ws = Blockly.inject(div, {
      toolbox,
      theme: islandTheme,
      renderer: 'zelos',
      grid: { spacing: 28, length: 2, colour: '#e2e8f0', snap: true },
      trashcan: true,
      move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
      zoom: { controls: true, wheel: false, pinch: true, startScale: 1, maxScale: 1.5, minScale: 0.6, scaleSpeed: 1.1 },
    });

    if (initialXml) {
      try {
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(initialXml), ws);
      } catch (e) {
        console.warn('初始积木加载失败：', e);
      }
    }

    onReady({
      workspace: ws,
      getXml: () => Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws)),
      getBlockCounts: () => {
        const counts: Record<string, number> = {};
        for (const b of ws.getAllBlocks(false)) counts[b.type] = (counts[b.type] ?? 0) + 1;
        return counts;
      },
      getCode: () => {
        try {
          return javascriptGenerator.workspaceToCode(ws)
            .split('\n').filter((l) => l.trim()).join('\n');
        } catch {
          return '';
        }
      },
      loadXml: (xml: string) => {
        try {
          ws.clear();
          Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws);
          ws.render();
        } catch (e) {
          console.warn('XML 载入失败：', e);
        }
      },
    });

    // 拖完积木 300ms 后通知（防抖），供任务校验、AI 上下文和草稿保存
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChangeCb = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current?.(), 300);
    };
    ws.addChangeListener((ev) => {
      // UI 事件（点击/选中）不算改动；其余（建块/移动/删除/改字段，含 API 注入）都通知
      if (!(ev as { isUiEvent?: boolean }).isUiEvent) onChangeCb();
    });

    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(div);

    return () => {
      clearTimeout(timer);
      // 销毁前立即把最终画布交给父组件保存（不走防抖，防止切课竞态）
      try {
        onFlushRef.current?.(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws)));
      } catch { /* 已销毁则跳过 */ }
      ro.disconnect();
      ws.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={holder} className="blockly-wrap blocklyWrap" />;
}
