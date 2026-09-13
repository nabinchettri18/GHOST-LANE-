import { DataPage } from '@/components/data-page'
export default function Shipments(){return <DataPage resource="shipments" title="Shipments" description="Review actual freight movements and their source records." columns={['Shipment','Lane','Carrier','Date','Volume','Status']}/>}
