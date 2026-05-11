import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

interface LowScoreProject {
  projectId: string
  projectName: string
  score: number
}

interface ProjectHealthChartProps {
  data: LowScoreProject[]
}

const getScoreColor = (score: number) => {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#F59E0B'
  return '#EF4444'
}

export function ProjectHealthChart({ data }: ProjectHealthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-[hsl(var(--muted-foreground))]">
        暂无数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#F3F4F6"
          horizontal={false}
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: '#6B7280', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="projectName"
          tick={{ fill: '#374151', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          formatter={(value) => [`${value} 分`, '最新评分']}
          contentStyle={{
            background: '#1E293B',
            border: 'none',
            borderRadius: '8px',
            color: '#FFFFFF',
            fontSize: '12px',
            padding: '8px 12px',
          }}
          cursor={{ fill: 'rgba(0,0,0,0.02)' }}
        />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((entry) => (
            <Cell
              key={entry.projectId}
              fill={getScoreColor(entry.score)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
