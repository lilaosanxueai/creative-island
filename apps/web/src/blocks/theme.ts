import * as Blockly from 'blockly';

/** 儿童化主题：大字、明亮、圆角（配合 zelos 渲染器） */

export const islandTheme = Blockly.Theme.defineTheme('islandKid', {
  name: 'islandKid',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#ffffff',
    toolboxBackgroundColour: '#f1f5f9',
    toolboxForegroundColour: '#334155',
    flyoutBackgroundColour: '#f8fafc',
    flyoutForegroundColour: '#334155',
    flyoutOpacity: 1,
    scrollbarColour: '#cbd5e1',
    insertionMarkerColour: '#94a3b8',
    insertionMarkerOpacity: 0.5,
    cursorColour: '#f59e0b',
  },
  fontStyle: { family: 'inherit', weight: '600', size: 16 },
});
