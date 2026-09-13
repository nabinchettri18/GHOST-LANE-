import { DataPage } from '@/components/data-page'
export default function DataSources(){return <DataPage title="Data sources" description="Connect and manage the operational sources that feed GhostLane analysis." action="Connect source" columns={['Source','Type','Status','Last sync','Records','Owner']}/>}
