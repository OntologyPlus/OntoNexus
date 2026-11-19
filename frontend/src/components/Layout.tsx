
import React, { ReactNode, useState, useEffect, useMemo } from 'react';
import { Settings, Bell, Network, X, CheckCircle, AlertTriangle, Info, Lightbulb, MessageSquare, LogOut, HelpCircle, ChevronDown, ChevronRight, Sparkles, Brain, Target, Inbox, Clock, FileText, ClipboardList, BadgeCheck, Shield, PenLine, Bot, Scale } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useOntologyContext } from '../contexts/OntologyContext';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocketChat } from '../api/hooks';
import GlobalSearch from './GlobalSearch';
import { COPY, isAdmin, roleLabel } from '../copy';

interface NavChildDef {
  tab: string;
  label: string;
  icon: ReactNode;
}

interface NavGroupDef {
  id: string;
  label: string;
  children: NavChildDef[];
}

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNavigateToOntology?: (objectId: string) => void;
  onShowHelp?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onNavigateToOntology, onShowHelp }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    decide: true,
    loop: true,
    analyze: true,
    graph: true,
    system: true,
  });
  const { state, getUnreadNotifications, markNotificationRead, dismissSuggestion, dismissReminder } = useOntologyContext();
  const { user, logout } = useAuth();
  const wsChat = useWebSocketChat(user?.id || 'default_user');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: string }[]>([]);

  useEffect(() => {
    wsChat.connect();
    return () => wsChat.disconnect();
  }, []);

  useEffect(() => {
    const wsMessages = wsChat.messages || [];
    const lastMessage = wsMessages[wsMessages.length - 1];
    if (!lastMessage) return;
    if (lastMessage.type === 'new_alert') {
      const toastId = `toast_${Date.now()}`;
      setToasts(prev => [...prev, { id: toastId, message: lastMessage.message || '新告警', type: 'alert' }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4000);
    } else if (lastMessage.type === 'action_status_change') {
      const toastId = `toast_${Date.now()}`;
      setToasts(prev => [...prev, { id: toastId, message: lastMessage.message || '动作状态变更', type: 'action' }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4000);
    } else if (lastMessage.type === 'reminder_update') {
      const toastId = `toast_${Date.now()}`;
      setToasts(prev => [...prev, { id: toastId, message: lastMessage.message || '提醒更新', type: 'reminder' }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4000);
    }
  }, [wsChat.messages]);

  const unreadNotifications = getUnreadNotifications();
  const notificationCount = unreadNotifications.length + state.cognitive.suggestions.length + state.cognitive.reminders.length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'risk_alert': return <AlertTriangle size={14} className="text-alert-500" />;
      case 'compliance_warning': return <AlertTriangle size={14} className="text-warning-500" />;
      case 'action_approved': return <CheckCircle size={14} className="text-compliance-500" />;
      default: return <Info size={14} className="text-medical-500" />;
    }
  };

  const navGroups: NavGroupDef[] = useMemo(() => [
    {
      id: 'decide',
      label: COPY.nav.groups.decide,
      children: [
        { tab: 'agent', label: 'AI 作战室', icon: <Bot size={16} /> },
        { tab: 'compare', label: 'OAG 对比', icon: <Scale size={16} /> },
        { tab: 'brief', label: COPY.nav.brief, icon: <FileText size={16} /> },
        { tab: 'cases', label: '案件驾驶舱', icon: <ClipboardList size={16} /> },
        { tab: 'watch', label: COPY.nav.watch, icon: <AlertTriangle size={16} /> },
        { tab: 'approve', label: COPY.nav.approve, icon: <Inbox size={16} /> },
        { tab: 'chat', label: COPY.nav.ask, icon: <MessageSquare size={16} /> },
      ],
    },
    {
      id: 'loop',
      label: COPY.nav.groups.loop,
      children: [
        { tab: 'checked', label: COPY.nav.checked, icon: <BadgeCheck size={16} /> },
        { tab: 'guard', label: COPY.nav.guard, icon: <Shield size={16} /> },
        { tab: 'written', label: COPY.nav.written, icon: <PenLine size={16} /> },
        { tab: 'effect', label: COPY.nav.effect, icon: <Clock size={16} /> },
      ],
    },
    {
      id: 'analyze',
      label: COPY.nav.groups.analyze,
      children: [
        { tab: 'insights', label: COPY.nav.why, icon: <Sparkles size={16} /> },
        { tab: 'scenario', label: COPY.nav.whatIf, icon: <Target size={16} /> },
      ],
    },
    {
      id: 'graph',
      label: COPY.nav.groups.graph,
      children: [
        { tab: 'ontology', label: COPY.nav.graph, icon: <Network size={16} /> },
        { tab: 'trust', label: '治理与可信', icon: <Shield size={16} /> },
      ],
    },
  ], []);

  const activeGroup = navGroups.find((g) => g.children.some((c) => c.tab === activeTab))
    || (activeTab === 'rules' ? { id: 'system', label: COPY.nav.groups.system } : null);
  const activeChild = navGroups.flatMap((g) => g.children).find((c) => c.tab === activeTab)
    || (activeTab === 'rules' ? { label: COPY.nav.system } : null);

  useEffect(() => {
    const gid = navGroups.find((g) => g.children.some((c) => c.tab === activeTab))?.id
      || (activeTab === 'rules' ? 'system' : null);
    if (gid) setOpenGroups((prev) => (prev[gid] ? prev : { ...prev, [gid]: true }));
  }, [activeTab, navGroups]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'risk_alert': return <AlertTriangle size={14} className="text-alert-500" />;
      case 'opportunity': return <Lightbulb size={14} className="text-warning-500" />;
      case 'churn_warning': return <AlertTriangle size={14} className="text-alert-400" />;
      default: return <Lightbulb size={14} className="text-medical-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-50 text-slate-800 overflow-hidden font-sans antialiased selection:bg-medical-200 selection:text-medical-900 relative">
      <aside className="w-16 md:w-72 bg-white border-r border-slate-200/60 flex flex-col z-20 shadow-medical relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-medical-100/40 to-health-100/20 blur-3xl -z-10" />

        <div className="p-4 md:p-5 flex items-center justify-center md:justify-start space-x-3 border-b border-slate-100 h-16 md:h-16 bg-gradient-to-r from-medical-50/40 to-transparent">
          <img
            src="/logo.png"
            alt="OntoNexus"
            className="w-9 h-9 rounded-[22%] shadow-glow ring-2 ring-medical-200 object-cover"
          />
          <span className="hidden md:block font-display font-bold text-xl tracking-tight text-slate-900">OntoNexus</span>
        </div>

        <nav className="flex-1 py-4 space-y-3 px-2 md:px-3 relative z-10 overflow-y-auto">
          {navGroups.map((group) => {
            const open = openGroups[group.id] !== false;
            const groupActive = group.children.some((c) => c.tab === activeTab);
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={clsx(
                    'w-full hidden md:flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold tracking-wide',
                    groupActive ? 'text-medical-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span>{group.label}</span>
                  {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <div className={clsx('mt-0.5 space-y-0.5', !open && 'md:hidden')}>
                    {group.children.map((child) => (
                      <NavItem
                        key={child.tab}
                        icon={child.icon}
                        label={child.label}
                        nested
                        active={activeTab === child.tab}
                        onClick={() => onTabChange(child.tab)}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-3 md:p-4 border-t border-slate-100 bg-gradient-to-t from-slate-50/80 to-transparent space-y-0.5">
          {isAdmin(user?.role) ? (
            <div>
              <div className="hidden md:block px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-500">
                {COPY.nav.groups.system}
              </div>
              <NavItem
                icon={<Brain size={16} />}
                label={COPY.nav.system}
                nested
                active={activeTab === 'rules'}
                onClick={() => onTabChange('rules')}
              />
            </div>
          ) : null}
          <NavItem icon={<HelpCircle size={16} />} label="帮助" nested={Boolean(isAdmin(user?.role))} onClick={onShowHelp} />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] opacity-15 blur-[120px]"
            style={{
              background: 'radial-gradient(circle, rgba(12, 135, 235, 0.08) 0%, transparent 60%)',
              animation: 'ambientPulse 12s ease-in-out infinite'
            }}
          />
          <div 
            className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] opacity-10 blur-[100px]"
            style={{
              background: 'radial-gradient(circle, rgba(12, 193, 126, 0.06) 0%, transparent 60%)',
              animation: 'ambientPulse 16s ease-in-out infinite 4s'
            }}
          />
        </div>
        <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-6 md:px-8 sticky top-0 z-10 shadow-medical">
          <div className="flex items-center text-slate-600 text-sm font-medium">
            <span className="mr-3 hover:text-slate-800 transition-colors">{activeGroup?.label || '销售'}</span>
            <span className="text-slate-400">/</span>
            <span className="ml-3 text-slate-800 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-xs font-medium">
              {activeChild?.label || COPY.nav.brief}
            </span>
            <span className="ml-3 hidden lg:inline text-xs text-slate-400">华东 · 2026</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:block">
              <GlobalSearch onSelectObject={(obj) => {
                onNavigateToOntology?.(obj.id);
                onTabChange('ontology');
              }} />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1.5 text-slate-600 hover:text-medical-600 hover:bg-medical-50 rounded-lg transition-all duration-200"
              >
                <Bell size={19} />
                {notificationCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-alert-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 top-10 w-80 md:w-96 bg-white rounded-xl shadow-medical-lg border border-slate-200/60 overflow-hidden z-50"
                  >
                    <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800 text-sm">通知中心</h3>
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="text-slate-600 hover:text-slate-800"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {state.cognitive.suggestions.length > 0 && (
                        <div className="p-2">
                          <div className="text-xs font-medium text-slate-600 px-2 py-1">智能建议</div>
                          {state.cognitive.suggestions.slice(0, 3).map((suggestion) => (
                            <div 
                              key={suggestion.id}
                              className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer group"
                            >
                              <div className="flex items-start gap-2">
                                {getSuggestionIcon(suggestion.type)}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-800">{suggestion.title}</div>
                                  <div className="text-xs text-slate-600 truncate">{suggestion.description}</div>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissSuggestion(suggestion.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-800"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {state.cognitive.reminders.length > 0 && (
                        <div className="p-2 border-t border-slate-100">
                          <div className="text-xs font-medium text-slate-600 px-2 py-1">待办提醒</div>
                          {state.cognitive.reminders.slice(0, 3).map((reminder) => (
                            <div 
                              key={reminder.id}
                              className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer group"
                            >
                              <div className="flex items-start gap-2">
                                <CheckCircle size={13} className="text-medical-500 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-800">{reminder.title}</div>
                                  <div className="text-xs text-slate-600">{reminder.description}</div>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissReminder(reminder.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-800"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {unreadNotifications.length > 0 && (
                        <div className="p-2 border-t border-slate-100">
                          <div className="text-xs font-medium text-slate-600 px-2 py-1">系统通知</div>
                          {unreadNotifications.slice(0, 5).map((notification) => (
                            <div 
                              key={notification.id}
                              onClick={() => markNotificationRead(notification.id)}
                              className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer"
                            >
                              <div className="flex items-start gap-2">
                                {getNotificationIcon(notification.type)}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-800">{notification.title}</div>
                                  <div className="text-xs text-slate-600 truncate">{notification.message}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {notificationCount === 0 && (
                        <div className="p-6 text-center text-slate-600">
                          <Bell size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">暂无新通知</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <span
                  title={
                    wsChat.connectionStatus === 'connected' ? '实时连接正常'
                    : wsChat.connectionStatus === 'reconnecting' ? '正在重连'
                    : wsChat.connectionStatus === 'failed' ? '实时连接已断开'
                    : '未连接'
                  }
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    wsChat.connectionStatus === 'connected' ? 'bg-emerald-500'
                    : wsChat.connectionStatus === 'reconnecting' || wsChat.connectionStatus === 'connecting' ? 'bg-amber-400'
                    : 'bg-slate-300'
                  }`}
                />
                <span className="text-xs font-medium text-slate-600">{user?.displayName || '管理员'}{user?.role ? ` · ${roleLabel(user.role)}` : ''}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 top-8 w-36 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => { setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Settings size={14} />
                      <span>系统设置</span>
                    </button>
                    <div className="border-t border-slate-100" />
                    <button
                      onClick={() => { setShowUserMenu(false); logout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={14} />
                      <span>退出登录</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-5 md:p-6 relative">
          <div className="max-w-[1500px] mx-auto h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>

      {/* Toast 通知叠加层 */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`pointer-events-auto max-w-sm px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm flex items-center gap-3 ${
                toast.type === 'alert'
                  ? 'bg-white/80 border-rose-200 text-rose-700'
                  : toast.type === 'action'
                  ? 'bg-white/80 border-brand-200 text-brand-400'
                  : 'bg-white/80 border-white0/20 text-emerald-400'
              }`}
            >
              {toast.type === 'alert' ? (
                <AlertTriangle size={18} className="text-rose-700 flex-shrink-0" />
              ) : toast.type === 'action' ? (
                <CheckCircle size={18} className="text-brand-400 flex-shrink-0" />
              ) : (
                <Lightbulb size={18} className="text-emerald-400 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active = false, badge, nested = false, onClick }: { icon: ReactNode, label: string, active?: boolean, badge?: string, nested?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={clsx(
    "w-full flex items-center space-x-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden",
    nested ? "px-3 md:pl-4 md:pr-3 py-2" : "px-3 md:px-3.5 py-2.5",
    active 
      ? "bg-medical-50 text-medical-700 shadow-sm ring-1 ring-medical-200" 
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
  )}>
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-medical-100/40 to-transparent opacity-50" />
    )}
    <span className={clsx("transition-all duration-200 relative z-10", active ? "text-medical-600" : "text-slate-600 group-hover:text-slate-800")}>
      {icon}
    </span>
    <span className={clsx("hidden md:block flex-1 text-left tracking-wide relative z-10", nested ? "text-sm" : "text-base", active ? "font-bold" : "font-semibold")}>{label}</span>
    {badge && (
      <span className="hidden md:flex bg-alert-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.1rem] items-center justify-center shadow-sm">
        {badge}
      </span>
    )}
  </button>
);

export default Layout;
