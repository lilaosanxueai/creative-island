import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import type { utils } from 'blockly';
import { islandTheme } from '../blocks/theme.ts';
import '../blocks/definitions.ts'; // 注册积木（副作用）
import '../blocks/generator.ts'; // 注册生成器（副作用）

export interface WorkspaceApi {
  workspace: Blockly.WorkspaceSvg;
  getXml(): string;
  getBlockCounts(): Record<string, number>;
}

interface Props {
  toolbox: utils.toolbox.ToolboxDefinition;
  starterXml?: string;
  onReady: (api: WorkspaceApi) => void;
  onChange?: () => void;
}

export default function BlocklyWorkspace({ toolbox, starterXml, onReady, onChange }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

    if (starterXml) {
      try {
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(starterXml), ws);
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
    });

    // 拖完积木 300ms 后通知（防抖），供任务校验和 AI 上下文
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChangeCb = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current?.(), 300);
    };
    ws.addChangeListener((ev) => {
      if (ev.type === Blockly.Events.BLOCK_MOVE || ev.type === Blockly.Events.BLOCK_CHANGE ||
          ev.type === Blockly.Events.BLOCK_CREATE || ev.type === Blockly.Events.BLOCK_DELETE) {
        onChangeCb();
      }
    });

    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(div);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      ws.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={holder} className="blockly-wrap blocklyWrap" />;
}
