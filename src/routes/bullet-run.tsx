import { createFileRoute } from '@tanstack/react-router';
import BulletRun from '@/components/BulletRun';
export const Route = createFileRoute('/bullet-run')({
  head: () => ({ meta: [{ title: 'Bullet Run — Alien Force Arena' }] }),
  component: BulletRun,
});
