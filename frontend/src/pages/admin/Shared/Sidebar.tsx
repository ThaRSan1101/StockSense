import BaseSidebar, { NavLink } from '@/components/shared/BaseSidebar';

export default function Sidebar() {
  const isLinkActive = (path: string, currentPath: string, search: string) => {
    if (path.includes('?tab=')) {
      const [basePath, searchStr] = path.split('?');
      return currentPath === basePath && search.includes(searchStr);
    }
    return currentPath === path;
  };

  const navLinks: NavLink[] = [
    { name: 'Dashboard', path: '/admin', icon: 'dashboard' },
    { name: 'AI Optimizations', path: '/admin/ai-optimizations', icon: 'auto_awesome' },
    { name: 'Accounts', path: '/admin/accounts', icon: 'manage_accounts' },
    { name: 'Alerts', path: '/alerts', icon: 'notifications' },
    { name: 'Reports', path: '/admin/reports', icon: 'analytics' },
    { name: 'Settings', path: '/admin/settings', icon: 'settings' },
  ];

  return <BaseSidebar navLinks={navLinks} isLinkActive={isLinkActive} />;
}
