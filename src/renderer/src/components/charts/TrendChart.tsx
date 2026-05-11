import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendDataPoint {
  date: string
  avgScore: number
}

interface TrendChartProps {
  data: TrendDataPoint[]
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#E5E7EB" 
          vertical={false}
        />
        
        <XAxis 
          dataKey="date"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        
        <YAxis 
          domain={[0, 100]}
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        
        <Tooltip 
          contentStyle={{
            background: '#1E293B',
            border: 'none',
            borderRadius: '8px',
            color: '#FFFFFF',
            fontSize: '12px',
            padding: '8px 12px'
          }}
        />
        
        <Line 
          type="monotone"
          dataKey="avgScore"
          stroke="#8B5CF6"
          strokeWidth={2.5}
          fill="url(#colorScore)"
          dot={false}
          activeDot={{ r: 4, fill: '#8B5CF6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
