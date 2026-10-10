import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Controls'
import { HabitStats } from '@/components/stats/HabitStats'
import { TrainingStats } from '@/components/stats/TrainingStats'
import { BodyStats } from '@/components/stats/BodyStats'
import { useSettings } from '@/contexts/SettingsContext'
import { RANGE_OPTIONS, rangeStart, type RangeKey } from '@/utils/weight'

type Tab = 'habits' | 'training' | 'body'

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>('habits')
  const [range, setRange] = useState<RangeKey>('90d')
  const { today } = useSettings()
  const from = rangeStart(range, today)

  return (
    <div className="animate-fade-in">
      <PageHeader title="Estadísticas" />
      <div className="mb-5 space-y-2">
        <Segmented<Tab>
          label="Sección"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'habits', label: 'Hábitos' },
            { value: 'training', label: 'Entreno' },
            { value: 'body', label: 'Cuerpo' },
          ]}
        />
        <Segmented<RangeKey> label="Periodo" value={range} onChange={setRange} options={RANGE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))} />
      </div>
      {tab === 'habits' && <HabitStats from={from} />}
      {tab === 'training' && <TrainingStats from={from} />}
      {tab === 'body' && <BodyStats from={from} />}
    </div>
  )
}
