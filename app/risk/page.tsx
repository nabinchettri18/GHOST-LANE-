import { DataPage } from '@/components/data-page'
export default function Risk(){return <DataPage title="Risk analysis" description="Review evidence-based lane risk once sufficient operational history is available." action="Import data" columns={['Lane','Risk score','Realization','Carrier signal','Demand signal','Status']}/>}
