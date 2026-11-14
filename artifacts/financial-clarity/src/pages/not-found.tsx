import { Link } from 'wouter';
import { buttonVariants } from '@/components/ui/button';

/** DESIGN §13.15: title, one sentence, primary "Go to Dashboard". No illustration. */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This screen doesn't exist. Your data is unchanged.</p>
        <Link href="/" className={buttonVariants({ className: 'mt-6 w-full' })}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}