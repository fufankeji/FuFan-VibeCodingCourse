"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Bot, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className: (args: { isActive: boolean }) => string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link href={href} className={className({ isActive })}>
      {children}
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-[64px] items-center border-b border-border-subtle bg-bg-base/80 px-[24px] backdrop-blur-md">
      <div className="flex flex-1 items-center gap-[32px]">
        <Link href="/" className="flex items-center gap-[8px] text-[16px] font-semibold text-fg-default">
          <Bot className="h-[24px] w-[24px] text-primary-default" />
          <span className="font-mono">AgentHub</span>
        </Link>
        <nav className="flex gap-[24px] text-[14px]">
          <NavLink
            href="/gallery"
            className={({ isActive }) => cn('transition-colors hover:text-fg-default', isActive ? 'text-fg-default font-medium' : 'text-fg-secondary')}
          >
            商店
          </NavLink>
          <NavLink
            href="/runs"
            className={({ isActive }) => cn('transition-colors hover:text-fg-default', isActive ? 'text-fg-default font-medium' : 'text-fg-secondary')}
          >
            运行记录
          </NavLink>
          <NavLink
            href="/pipeline"
            className={({ isActive }) => cn('transition-colors hover:text-fg-default', isActive ? 'text-fg-default font-medium' : 'text-fg-secondary')}
          >
            编排
          </NavLink>
          <NavLink
            href="/pricing"
            className={({ isActive }) => cn('transition-colors hover:text-fg-default', isActive ? 'text-fg-default font-medium' : 'text-fg-secondary')}
          >
            定价
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-[16px]">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <Settings className="mr-[8px] h-[16px] w-[16px]" />
            设置
          </Link>
        </Button>
        <Button variant="outline" size="sm">登录</Button>
        <Button size="sm">免费开始</Button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border-default bg-bg-subtle py-[48px] px-[24px]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-[48px] lg:grid-cols-4">
        <div className="flex flex-col gap-[16px] lg:col-span-1">
          <Link href="/" className="flex items-center gap-[8px] text-[16px] font-semibold text-fg-default">
            <Bot className="h-[24px] w-[24px] text-primary-default" />
            <span className="font-mono">AgentHub</span>
          </Link>
          <p className="text-[14px] text-fg-secondary">
            你的下一代 AI Agent 构建、编排与分发平台。
          </p>
        </div>
        <div className="flex flex-col gap-[12px]">
          <h4 className="text-[14px] font-medium text-fg-default">产品</h4>
          <Link href="/gallery" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">商店</Link>
          <Link href="/pricing" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">定价</Link>
          <Link href="/pipeline" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">编排</Link>
        </div>
        <div className="flex flex-col gap-[12px]">
          <h4 className="text-[14px] font-medium text-fg-default">资源</h4>
          <a href="#" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">文档</a>
          <a href="#" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">API 参考</a>
          <a href="#" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">博客</a>
        </div>
        <div className="flex flex-col gap-[12px]">
          <h4 className="text-[14px] font-medium text-fg-default">法律</h4>
          <a href="#" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">隐私政策</a>
          <a href="#" className="text-[14px] text-fg-secondary transition-colors hover:text-primary-default">服务条款</a>
        </div>
      </div>
    </footer>
  );
}
