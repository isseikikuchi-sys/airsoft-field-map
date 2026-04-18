import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '全国サバゲーフィールドマップ',
  description: '日本全国のサバゲーフィールドを地図・天気・直近スケジュールでまとめて確認',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-dive-bg text-white min-h-screen antialiased">{children}</body>
    </html>
  );
}
