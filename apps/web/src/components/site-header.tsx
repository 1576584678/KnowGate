import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

export function SiteHeader() {
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
          四年级数学世界
        </div>
      </div>
    </header>
  );
}
