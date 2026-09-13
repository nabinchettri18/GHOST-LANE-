import { DataPage } from '@/components/data-page'
export default function Carriers(){return <DataPage title="Carriers" description="Measure carrier acceptance, cancellations and realized capacity from your records." columns={['Carrier','Loads','Acceptance','Rejection','Cancellation','Realization','Risk']}/>}
