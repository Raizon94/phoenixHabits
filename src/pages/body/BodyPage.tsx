import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Controls'
import { WeightTab } from '@/components/body/WeightTab'
import { PhotosTab } from '@/components/body/PhotosTab'
import { CompareTab } from '@/components/body/CompareTab'

type Tab = 'weight' | 'photos' | 'compare'

export default function BodyPage() {
  const [tab, setTab] = useState<Tab>('weight')
  return (
    <div className="animate-fade-in">
      <PageHeader title="Cuerpo" subtitle="Peso y progreso físico" />
      <Segmented<Tab>
        label="Sección"
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'weight', label: 'Peso' },
          { value: 'photos', label: 'Fotos' },
          { value: 'compare', label: 'Comparar' },
        ]}
      />
      {tab === 'weight' && <WeightTab />}
      {tab === 'photos' && <PhotosTab />}
      {tab === 'compare' && <CompareTab />}
    </div>
  )
}
