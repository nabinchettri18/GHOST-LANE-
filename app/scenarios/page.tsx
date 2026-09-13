import { DataPage } from '@/components/data-page'
export default function Scenarios(){return <DataPage title="Scenario analysis" description="Compare procurement strategies against your connected lane and contract data." action="Create scenario" columns={['Scenario','Lane','Strategy','Exposure','Expected realization','Created']}/>}
