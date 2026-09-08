"use client";

import Link from "next/link";
import { LogOut, UserCog } from "lucide-react";
import { signOutAction } from "@/features/auth/actions/sign-out.action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ userName, userRole }: { userName: string; userRole: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="min-w-0 rounded text-right outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="max-w-48 truncate text-sm font-medium leading-none">{userName}</div>
        <div className="text-xs text-muted-foreground">{userRole}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/account" className="cursor-pointer">
            <UserCog className="h-4 w-4" /> Minha conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-status-critical" onSelect={() => signOutAction()}>
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
