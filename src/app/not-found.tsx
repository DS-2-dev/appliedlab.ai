import Link from "next/link";
import { copy } from "@/content/copy";
import { MessagePage, onward } from "@/components/home/MessagePage";

export default function NotFound() {
  return (
    <MessagePage kicker="404" title={copy.notFound.title} body={copy.notFound.line}>
      <Link href="/" className={onward}>
        ↳ {copy.notFound.cta}
      </Link>
    </MessagePage>
  );
}
