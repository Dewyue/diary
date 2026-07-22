import type { TabId } from '../types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'calendar', label: '日历' },
  { id: 'data', label: '数据' },
];

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bottom-nav__item${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
