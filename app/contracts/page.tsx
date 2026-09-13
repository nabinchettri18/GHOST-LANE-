import { DataPage } from '@/components/data-page'
export default function Contracts(){return <DataPage resource="contracts" title="Contracts" description="Manage committed freight capacity and measure whether contracted volume materializes." columns={['Contract','Lane','Carrier','Volume','Rate','Start','End']}/>}
