"use client";

import { Session } from "next-auth";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface UserNavProps {
  user: Session["user"];
}

export function UserNav({ user }: UserNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0].toUpperCase() || "U";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {initials}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-card shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">{user.name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {user.role && (
              <p className="text-xs text-primary mt-1 capitalize">
                {user.role.replace("_", " ")}
              </p>
            )}
          </div>
          <div className="py-1">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
              onClick={() => setIsOpen(false)}
            >
              Settings
            </Link>
          </div>
          <div className="py-1 border-t border-border">
            <Link
              href="/auth/signout"
              className="block px-4 py-2 text-sm text-red-700 hover:bg-muted"
              onClick={() => setIsOpen(false)}
            >
              Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
