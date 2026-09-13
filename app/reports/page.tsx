import { DataPage } from '@/components/data-page'
export default function Reports(){return <DataPage title="Reports" description="Generate operational reports from your connected GhostLane workspace." action="Create report" columns={['Report','Period','Coverage','Status','Created','Owner']}/>}
