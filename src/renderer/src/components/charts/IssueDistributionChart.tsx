import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface IssueDistributionItem {
  type: 'error' | 'warning' | 'suggestion'
  count: number
}

interface IssueDistributionChartProps {
  data: IssueDistributionItem[]
}

const ISSUE_COLORS: Record<string, string> = {
  error: '#EF4444',
  warning: '#F59E0B',
  suggestion: '#3B82F6',
}

const ISSUE_LABELS: Record<string, string> = {
  error: '错误',
  warning: '警告',
  suggestion: '建议',
}

export function IssueDistributionChart({ data }: IssueDistributionChartProps) {
  const filtered = data.filter((d) => d.count > 0)

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-[hsl(var(--muted-foreground))]">
        暂无数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="count"
          nameKey="type"
          cx="50%"
          cy="45%"
          outerRadius={70}
          innerRadius={40}
          paddingAngle={2}
        >
          {filtered.map((entry) => (
            <Cell
              key={entry.type}
              fill={ISSUE_COLORS[entry.type] ?? '#6B7280'}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [value, ISSUE_LABELS[name as string] ?? name]}
          contentStyle={{
            background: '#1E293B',
            border: 'none',
            borderRadius: '8px',
            color: '#FFFFFF',
            fontSize: '12px',
            padding: '8px 12px',
          }}
        />
        <Legend
          formatter={(value) => ISSUE_LABELS[value] ?? value}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ 
            fontSize: '11px', 
            color: '#6B7280',
            paddingTop: '10px'
          }}
          verticalAlign="bottom"
          align="center"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
