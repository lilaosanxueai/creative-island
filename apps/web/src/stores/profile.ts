import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@shared/types.ts';

/** 当前登录的孩子（家庭内无需密码，localStorage 记住上次选择） */
interface ProfileState {
  current: Profile | null;
  setCurrent: (p: Profile | null) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({ current: null, setCurrent: (p) => set({ current: p }) }),
    { name: 'island-current-profile' },
  ),
);
