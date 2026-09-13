import { DataPage } from '@/components/data-page'
export default function Carriers(){return <DataPage resource="carriers" title="Carriers" description="Measure carrier acceptance, cancellations and realized capacity from your records." columns={['Carrier','Acceptance','Rejection','Cancellation','Realization']}/>}
