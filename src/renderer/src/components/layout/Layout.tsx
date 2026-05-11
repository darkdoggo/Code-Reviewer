import { Sidebar } from './Sidebar'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <main className="flex-1 overflow-auto p-6 min-h-0">{children}</main>
      </div>
    </div>
  )
}
