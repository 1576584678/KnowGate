"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { useContent } from "@/components/content-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { gradeWorld, gradeWorlds, setGradeWorld } = useContent();

  function changeGradeWorld(gradeWorldId: string) {
    setGradeWorld(gradeWorldId);
    if (pathname !== "/") router.push("/");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="知关首页">
          <span className="brand__mark" aria-hidden="true">
            <BookOpenCheck size={21} strokeWidth={2.4} />
          </span>
          <span className="brand__text">
            <strong>知关</strong>
            <small>KnowGate</small>
          </span>
        </Link>
        <div className="world-badge" aria-label="当前世界">
          <span className="world-badge__dot" aria-hidden="true" />
          <select
            aria-label="选择数学年级"
            onChange={(event) => changeGradeWorld(event.target.value)}
            value={gradeWorld.id}
          >
            {gradeWorlds.map((world) => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
