import { describe, expect, it } from 'vitest';
import { checkKidInput, containsPersonalInfo, containsSensitive, stripUrls } from './safety.ts';

describe('敏感词过滤', () => {
  it('命中敏感词返回拒绝话术', () => {
    expect(containsSensitive('我想知道怎么赌博')).toBe(true);
    expect(checkKidInput('我想知道怎么赌博')).toContain('这个话题');
  });
  it('正常创作对话放行', () => {
    expect(containsSensitive('帮我做一个打怪兽的游戏')).toBe(false);
    expect(checkKidInput('怎么让小机器人跳舞？')).toBeNull();
  });
});

describe('个人信息保护', () => {
  it('识别手机号', () => {
    expect(containsPersonalInfo('我的手机号是13812345678')).toBe(true);
  });
  it('识别住址类表述', () => {
    expect(containsPersonalInfo('我家在幸福路3栋2单元')).toBe(true);
  });
  it('正常对话不误伤', () => {
    expect(containsPersonalInfo('我想让小猫移到 x:100 的位置')).toBe(false);
  });
});

describe('输出剥链接', () => {
  it('去掉 http/https 链接', () => {
    expect(stripUrls('看看 https://example.com/abc 这个')).not.toContain('https://example.com');
    expect(stripUrls('去 www.baidu.com 查')).not.toContain('baidu');
  });
  it('普通文本不受影响', () => {
    expect(stripUrls('我们把移动改成 200 试试')).toBe('我们把移动改成 200 试试');
  });
});
