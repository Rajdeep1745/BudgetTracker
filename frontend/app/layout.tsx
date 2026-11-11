import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'PocketPlan Budget Tracker', description: 'Monthly budget dashboard' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
