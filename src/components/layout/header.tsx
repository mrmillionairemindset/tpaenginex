'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Menu, LogOut, User, Settings, HelpCircle, FileText, Scale, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { ProfileModal } from '@/components/profile-modal';
import { OrganizationSettingsModal } from '@/components/organization-settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOut } from 'next-auth/react';

interface HeaderProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    organization: {
      id: string;
      name: string;
      type: 'platform' | 'tpa' | 'client';
      slug: string;
    } | null;
  };
  onMobileMenuToggle?: () => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  orderId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function Header({ user, onMobileMenuToggle }: HeaderProps) {
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [orgSettingsModalOpen, setOrgSettingsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <>
      <ProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        user={user}
      />
      <OrganizationSettingsModal
        open={orgSettingsModalOpen}
        onOpenChange={setOrgSettingsModalOpen}
        user={user}
      />
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/tpa-engine-x-logo.png" alt="TPAEngineX" className="h-8" />
          <span className="hidden font-semibold sm:inline-block">
            TPAEngine<span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">X</span>
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-end gap-4">
          {/* Organization Switcher removed — platform admin manages TPAs via /platform */}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
              <div className="p-3 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.orderId ? `/orders/${notification.orderId}` : '#'}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification.id);
                        }
                      }}
                      className={`block p-3 hover:bg-muted transition-colors ${
                        !notification.isRead ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1">
                  {user.name && (
                    <p className="text-sm font-medium">{user.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setProfileModalOpen(true)}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() => setOrgSettingsModalOpen(true)}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Organization Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/help" target="_blank" className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help Center
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/privacy" target="_blank" className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  Privacy Policy
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/terms" target="_blank" className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Terms of Service
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/hipaa" target="_blank" className="cursor-pointer">
                  <Scale className="mr-2 h-4 w-4" />
                  HIPAA Compliance
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/baa" target="_blank" className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  BAA
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="cursor-pointer text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    </>
  );
}
